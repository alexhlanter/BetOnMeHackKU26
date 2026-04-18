import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function GET(_request, context) {
  const { userId } = await context.params;

  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const goals = db.collection("goals");

    const cursor = goals
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 });

    const list = await cursor.toArray();

    const goalsJson = list.map((g) => ({
      id: g._id.toString(),
      userId: g.userId.toString(),
      title: g.title,
      stakeAmount: g.stakeAmount,
      deadline: g.deadline?.toISOString?.() ?? null,
      status: g.status,
      createdAt: g.createdAt?.toISOString?.() ?? null,
    }));

    return NextResponse.json({ goals: goalsJson });
  } catch (err) {
    console.error("[GET /api/goals/user/[userId]]", err);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
