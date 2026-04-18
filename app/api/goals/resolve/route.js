import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

const ALLOWED = new Set(["success", "failed"]);

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

    const goalId = body?.goalId;
    const status = body?.status;

    if (!goalId || !ObjectId.isValid(goalId)) {
      return NextResponse.json(
        { error: 'Field "goalId" must be a valid MongoDB ObjectId string' },
        { status: 400 }
      );
    }

    if (typeof status !== "string" || !ALLOWED.has(status)) {
      return NextResponse.json(
        { error: 'Field "status" must be "success" or "failed"' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const goals = db.collection("goals");

    const updated = await goals.findOneAndUpdate(
      { _id: new ObjectId(goalId), status: "active" },
      { $set: { status } },
      { returnDocument: "after" }
    );

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Goal not found or already resolved (only active goals can be resolved)",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updated._id.toString(),
      userId: updated.userId.toString(),
      title: updated.title,
      stakeAmount: updated.stakeAmount,
      deadline: updated.deadline?.toISOString?.() ?? null,
      status: updated.status,
      createdAt: updated.createdAt?.toISOString?.() ?? null,
    });
  } catch (err) {
    console.error("[POST /api/goals/resolve]", err);
    return NextResponse.json(
      { error: "Failed to resolve goal" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
