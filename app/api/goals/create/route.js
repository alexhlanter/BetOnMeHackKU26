import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const userId = body?.userId;
    const title = body?.title;
    const stakeAmount = body?.stakeAmount;
    const deadlineRaw = body?.deadline;

    if (!isNonEmptyString(userId) || !ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Field "userId" must be a valid MongoDB ObjectId string' },
        { status: 400 }
      );
    }

    if (!isNonEmptyString(title)) {
      return NextResponse.json(
        { error: 'Field "title" is required' },
        { status: 400 }
      );
    }

    const stake =
      typeof stakeAmount === "number" && Number.isFinite(stakeAmount)
        ? stakeAmount
        : typeof stakeAmount === "string"
          ? Number.parseFloat(stakeAmount)
          : NaN;

    if (!Number.isFinite(stake) || stake < 0) {
      return NextResponse.json(
        { error: 'Field "stakeAmount" must be a non-negative number' },
        { status: 400 }
      );
    }

    const deadline =
      deadlineRaw instanceof Date
        ? deadlineRaw
        : typeof deadlineRaw === "string" || typeof deadlineRaw === "number"
          ? new Date(deadlineRaw)
          : null;

    if (!deadline || Number.isNaN(deadline.getTime())) {
      return NextResponse.json(
        { error: 'Field "deadline" must be a valid date string or timestamp' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const users = db.collection("users");
    const goals = db.collection("goals");

    const owner = await users.findOne({ _id: new ObjectId(userId) });
    if (!owner) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await goals.createIndex({ userId: 1 });

    const createdAt = new Date();
    const doc = {
      userId: new ObjectId(userId),
      title: title.trim(),
      stakeAmount: stake,
      deadline,
      status: "active",
      createdAt,
    };

    const result = await goals.insertOne(doc);

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        userId: doc.userId.toString(),
        title: doc.title,
        stakeAmount: doc.stakeAmount,
        deadline: doc.deadline.toISOString(),
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/goals/create]", err);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
