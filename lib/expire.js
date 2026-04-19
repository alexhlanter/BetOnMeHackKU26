// Per-user lazy expiry. Mirrors the scan logic of
// app/api/goals/expire/route.js but scoped to one user and bounded so a
// cold list load can't balloon unbounded. Called from GET /api/goals/mine
// (and /api/goals/user/[userId]) so stakes actually move to charity when
// the user revisits the app after a missed window — no cron needed.

import { resolveGoal } from "@/lib/resolve";

const DEFAULT_WINDOW_MINUTES = 30;

/**
 * Resolve any of this user's active goals whose proof window has passed.
 * Per-goal XRPL failures are swallowed (logged) so one stuck goal can't
 * break the caller's list response.
 *
 * @param {import("mongodb").Db} db
 * @param {import("mongodb").ObjectId} userId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ scanned: number, expired: string[], errors: Array<{id:string,error:string}> }>}
 */
export async function expireUserGoalsIfDue(db, userId, opts = {}) {
  const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 5;
  const goals = db.collection("goals");
  const now = Date.now();

  const candidates = await goals
    .find({ userId, status: "active" })
    .limit(limit)
    .toArray();

  const expired = [];
  const errors = [];

  for (const goal of candidates) {
    let windowEnd = null;

    if (goal.type === "recurring") {
      // Recurring goals fail when the whole contract window is over and the
      // user still hasn't accumulated requiredCount verified proofs. We use
      // target.endAt directly — it's already "last slot + windowMinutes" from
      // the create route.
      const endAt = goal?.target?.endAt
        ? new Date(goal.target.endAt).getTime()
        : null;
      if (endAt === null) continue;
      const completed = goal?.progress?.completedCount ?? 0;
      const required = goal?.target?.requiredCount ?? Infinity;
      if (completed >= required) continue; // would have been resolved on the proof that completed it
      windowEnd = endAt;
    } else {
      const targetAt = goal?.target?.targetAt
        ? new Date(goal.target.targetAt).getTime()
        : null;
      const windowMinutes =
        typeof goal?.target?.windowMinutes === "number" && goal.target.windowMinutes > 0
          ? goal.target.windowMinutes
          : DEFAULT_WINDOW_MINUTES;
      if (targetAt === null) continue;
      windowEnd = targetAt + windowMinutes * 60 * 1000;
    }

    if (windowEnd === null || now < windowEnd) continue;

    const id = goal._id.toString();
    try {
      await resolveGoal(id, "failed", "cron");
      expired.push(id);
    } catch (err) {
      console.error("[expireUserGoalsIfDue] failed to expire", id, err);
      errors.push({ id, error: String(err?.message || err) });
    }
  }

  return { scanned: candidates.length, expired, errors };
}
