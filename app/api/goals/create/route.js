import { NextResponse } from "next/server";
import { Wallet } from "xrpl";
import { getDb } from "@/lib/mongodb";
import { createEscrow } from "@/lib/xrpl";
import { getCharityById } from "@/lib/charities";
import { getSessionUser } from "@/lib/auth";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

let cachedOwnerAddress = null;
function getSharedOwnerAddress() {
  if (cachedOwnerAddress) return cachedOwnerAddress;
  const seed = process.env.USER_WALLET_SEED;
  if (!seed) throw new Error("USER_WALLET_SEED is not set");
  cachedOwnerAddress = Wallet.fromSeed(seed).address;
  return cachedOwnerAddress;
}

function validateLocation(loc) {
  if (!loc || typeof loc !== "object") return "location is required";
  if (!isFiniteNumber(loc.lat) || loc.lat < -90 || loc.lat > 90) {
    return "location.lat must be a number in [-90, 90]";
  }
  if (!isFiniteNumber(loc.lng) || loc.lng < -180 || loc.lng > 180) {
    return "location.lng must be a number in [-180, 180]";
  }
  if (loc.radiusMeters != null && (!isFiniteNumber(loc.radiusMeters) || loc.radiusMeters <= 0)) {
    return "location.radiusMeters must be a positive number if provided";
  }
  return null;
}

function validateSingleTarget(target) {
  if (!target || typeof target !== "object") return "target is required";
  const targetAt = parseDate(target.targetAt);
  if (!targetAt) return "target.targetAt must be a valid date";
  const { windowMinutes } = target;
  if (windowMinutes != null && (!isFiniteNumber(windowMinutes) || windowMinutes <= 0)) {
    return "target.windowMinutes must be a positive number if provided";
  }
  return null;
}

// Recurring goals send the schedule (for display) plus a list of pre-computed
// scheduled instants (for verification). The client expands days-of-week +
// time-of-day + weeks into the actual ISO timestamps because only the browser
// knows the user's timezone — the server never tries to derive instants from
// the human-friendly schedule fields.
//
// Hard caps: ≤ 4 weeks, ≤ 28 sessions total. Keeps a single bet from locking
// stake into something that takes a month+ to clear.
const MAX_RECURRING_WEEKS = 4;
const MAX_RECURRING_SESSIONS = 28;

function validateRecurringTarget(target) {
  if (!target || typeof target !== "object") return "target is required";
  const { scheduledTimes: times, windowMinutes } = target;
  if (!Array.isArray(times) || times.length === 0) {
    return "target.scheduledTimes must be a non-empty array of ISO timestamps";
  }
  if (times.length > MAX_RECURRING_SESSIONS) {
    return `target.scheduledTimes has too many entries (${times.length} > ${MAX_RECURRING_SESSIONS})`;
  }
  const parsed = [];
  for (const t of times) {
    const d = parseDate(t);
    if (!d) return "target.scheduledTimes contains an invalid timestamp";
    parsed.push(d);
  }
  parsed.sort((a, b) => a.getTime() - b.getTime());
  // First slot must be in the future (with small skew). A schedule that
  // starts in the past can never be fully completed.
  if (parsed[0].getTime() < Date.now() - 5 * 60 * 1000) {
    return "target.scheduledTimes starts in the past";
  }
  if (windowMinutes != null && (!isFiniteNumber(windowMinutes) || windowMinutes <= 0)) {
    return "target.windowMinutes must be a positive number if provided";
  }
  return { parsedTimes: parsed };
}

// Schedule is metadata for display ("Mon/Wed/Fri @ 7am × 2 weeks"). The
// authoritative truth for verification is target.scheduledTimes — we only
// validate shapes here, never use these fields to compute timing.
function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") return "schedule is required";
  if (
    !Array.isArray(schedule.daysOfWeek) ||
    schedule.daysOfWeek.length === 0 ||
    !schedule.daysOfWeek.every(
      (d) => Number.isInteger(d) && d >= 0 && d <= 6
    )
  ) {
    return "schedule.daysOfWeek must be a non-empty array of integers in [0, 6]";
  }
  if (
    !Number.isInteger(schedule.weeks) ||
    schedule.weeks < 1 ||
    schedule.weeks > MAX_RECURRING_WEEKS
  ) {
    return `schedule.weeks must be an integer in [1, ${MAX_RECURRING_WEEKS}]`;
  }
  if (
    schedule.timeMode !== "same" &&
    schedule.timeMode !== "perDay"
  ) {
    return 'schedule.timeMode must be "same" or "perDay"';
  }
  return null;
}

export async function POST(request) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const title = body?.title;
    const stakeAmount = body?.stakeAmount;
    const type = body?.type;
    const location = body?.location;
    const target = body?.target;
    const charityId = body?.charityId;

    if (!isNonEmptyString(title)) {
      return NextResponse.json(
        { error: 'Field "title" is required' },
        { status: 400 }
      );
    }

    if (type !== "single" && type !== "recurring") {
      return NextResponse.json(
        { error: 'Field "type" must be "single" or "recurring"' },
        { status: 400 }
      );
    }

    const stake =
      typeof stakeAmount === "number" && Number.isFinite(stakeAmount)
        ? stakeAmount
        : typeof stakeAmount === "string"
          ? Number.parseFloat(stakeAmount)
          : NaN;

    if (!Number.isFinite(stake) || stake <= 0) {
      return NextResponse.json(
        { error: 'Field "stakeAmount" must be a positive number of XRP' },
        { status: 400 }
      );
    }

    const locErr = validateLocation(location);
    if (locErr) {
      return NextResponse.json({ error: locErr }, { status: 400 });
    }

    // The shape of `target`, the deadline calculation, and the per-goal
    // metadata vary between single and recurring goals. We do all of that
    // branching up-front so the XRPL + DB code below can stay one path.
    let goalTargetDoc; // what we persist under doc.target
    let scheduleDoc = null; // recurring only — UI display metadata
    let progressDoc = null; // recurring only — verified-slot ledger
    let deadline; // becomes escrow CancelAfter

    if (type === "single") {
      const targetErr = validateSingleTarget(target);
      if (targetErr) {
        return NextResponse.json({ error: targetErr }, { status: 400 });
      }
      const targetAt = parseDate(target.targetAt);
      const windowMinutes =
        isFiniteNumber(target.windowMinutes) && target.windowMinutes > 0
          ? target.windowMinutes
          : 30;

      // Decision #10: for single goals, deadline = targetAt + 24h. This is
      // the escrow's CancelAfter, not the judgment time.
      deadline = new Date(targetAt.getTime() + 24 * 60 * 60 * 1000);
      if (deadline.getTime() <= Date.now() + 15_000) {
        return NextResponse.json(
          {
            error:
              'Computed deadline (targetAt + 24h) must be at least ~15s in the future',
          },
          { status: 400 }
        );
      }

      goalTargetDoc = { targetAt, windowMinutes };
    } else {
      // recurring
      const scheduleErr = validateSchedule(body?.schedule);
      if (scheduleErr) {
        return NextResponse.json({ error: scheduleErr }, { status: 400 });
      }
      const targetResult = validateRecurringTarget(target);
      if (typeof targetResult === "string") {
        return NextResponse.json({ error: targetResult }, { status: 400 });
      }
      const { parsedTimes } = targetResult;
      const windowMinutes =
        isFiniteNumber(target.windowMinutes) && target.windowMinutes > 0
          ? target.windowMinutes
          : 120;

      const lastSlot = parsedTimes[parsedTimes.length - 1];
      // CancelAfter sits past the latest slot's window so a successful user
      // can refund only after the whole contract is over. +1h safety margin.
      deadline = new Date(
        lastSlot.getTime() + windowMinutes * 60 * 1000 + 60 * 60 * 1000
      );
      if (deadline.getTime() <= Date.now() + 15_000) {
        return NextResponse.json(
          { error: "Computed deadline must be at least ~15s in the future" },
          { status: 400 }
        );
      }

      goalTargetDoc = {
        startAt: parsedTimes[0],
        endAt: new Date(lastSlot.getTime() + windowMinutes * 60 * 1000),
        scheduledTimes: parsedTimes,
        windowMinutes,
        requiredCount: parsedTimes.length,
      };

      scheduleDoc = {
        daysOfWeek: body.schedule.daysOfWeek,
        weeks: body.schedule.weeks,
        timeMode: body.schedule.timeMode,
        // Echo back the user's chosen times as plain {hour,minute} so the
        // UI can re-render "Mon/Wed/Fri @ 7am" without re-deriving it from
        // the raw scheduled instants.
        same:
          body.schedule.timeMode === "same" && body.schedule.same
            ? {
                hour: Number(body.schedule.same.hour) || 0,
                minute: Number(body.schedule.same.minute) || 0,
              }
            : null,
        perDay:
          body.schedule.timeMode === "perDay" && body.schedule.perDay
            ? body.schedule.perDay
            : null,
      };
      progressDoc = { completedCount: 0, creditedTimes: [] };
    }

    const charity = getCharityById(charityId);
    if (!charity) {
      return NextResponse.json(
        { error: 'Field "charityId" does not match any known charity' },
        { status: 400 }
      );
    }
    if (!isNonEmptyString(charity.address)) {
      return NextResponse.json(
        {
          error:
            "Selected charity is missing an XRPL address. Check XRPL_CHARITY_ADDRESS env.",
        },
        { status: 500 }
      );
    }

    const userSeed = process.env.USER_WALLET_SEED;
    if (!userSeed) {
      return NextResponse.json(
        { error: "Server missing XRPL config (USER_WALLET_SEED)" },
        { status: 500 }
      );
    }

    let ownerAddress;
    try {
      ownerAddress = getSharedOwnerAddress();
    } catch {
      return NextResponse.json(
        { error: "Server XRPL config invalid (USER_WALLET_SEED)" },
        { status: 500 }
      );
    }

    const db = await getDb();
    const goals = db.collection("goals");

    // Decision #8: compound index for fast "any active goal?" lookups.
    await goals.createIndex({ userId: 1 });
    await goals.createIndex({ userId: 1, status: 1 });

    // XRPL first — if this throws, we never touch Mongo.
    const escrow = await createEscrow({
      userSeed,
      destinationAddress: charity.address,
      amountXRP: String(stake),
      deadline,
    });

    const createdAt = new Date();
    const doc = {
      userId: sessionUser._id,
      title: title.trim(),
      stakeAmount: stake,
      deadline,
      status: "active", // business state (decision #5)
      escrowState: "locked", // chain state
      createdAt,
      type,
      location: {
        name: isNonEmptyString(location.name) ? location.name.trim() : null,
        lat: location.lat,
        lng: location.lng,
        radiusMeters: isFiniteNumber(location.radiusMeters) ? location.radiusMeters : 75,
      },
      target: goalTargetDoc,
      charity: {
        id: charity.id,
        name: charity.name,
        address: charity.address,
      },
      ownerAddress,
      escrow: {
        sequence: escrow.escrowSequence,
        createTxHash: escrow.txHash,
        destinationAddress: charity.address,
      },
    };
    if (scheduleDoc) doc.schedule = scheduleDoc;
    if (progressDoc) doc.progress = progressDoc;

    let insertedId;
    try {
      const result = await goals.insertOne(doc);
      insertedId = result.insertedId;
    } catch (dbErr) {
      console.error(
        "[POST /api/goals/create] DB insert failed AFTER escrow created",
        { escrowSequence: escrow.escrowSequence, txHash: escrow.txHash, dbErr }
      );
      return NextResponse.json(
        {
          error:
            "Escrow created on-chain but failed to save goal. Funds are recoverable after deadline via EscrowCancel.",
          escrowSequence: escrow.escrowSequence,
          txHash: escrow.txHash,
        },
        { status: 500 }
      );
    }

    const targetForResponse =
      type === "single"
        ? {
            targetAt: doc.target.targetAt.toISOString(),
            windowMinutes: doc.target.windowMinutes,
          }
        : {
            startAt: doc.target.startAt.toISOString(),
            endAt: doc.target.endAt.toISOString(),
            scheduledTimes: doc.target.scheduledTimes.map((d) => d.toISOString()),
            windowMinutes: doc.target.windowMinutes,
            requiredCount: doc.target.requiredCount,
          };

    return NextResponse.json(
      {
        id: insertedId.toString(),
        userId: doc.userId.toString(),
        title: doc.title,
        stakeAmount: doc.stakeAmount,
        deadline: doc.deadline.toISOString(),
        status: doc.status,
        escrowState: doc.escrowState,
        createdAt: doc.createdAt.toISOString(),
        type: doc.type,
        location: doc.location,
        target: targetForResponse,
        schedule: doc.schedule ?? null,
        progress: doc.progress ?? null,
        charity: doc.charity,
        ownerAddress: doc.ownerAddress,
        escrow: doc.escrow,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/goals/create]", err);
    return NextResponse.json(
      { error: "Failed to create goal", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
