import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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

    const goalId = body?.goalId;
    const userId = body?.userId;
    const imageUrl = body?.imageUrl;

    if (!goalId || !ObjectId.isValid(goalId)) {
      return NextResponse.json(
        { error: 'Field "goalId" must be a valid MongoDB ObjectId string' },
        { status: 400 }
      );
    }

    if (!userId || !ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Field "userId" must be a valid MongoDB ObjectId string' },
        { status: 400 }
      );
    }

    if (!isNonEmptyString(imageUrl) || !isHttpUrl(imageUrl.trim())) {
      return NextResponse.json(
        {
          error:
            'Field "imageUrl" must be a non-empty http(s) URL string',
        },
        { status: 400 }
      );
    }

    const db = await getDb();
    const goals = db.collection("goals");
    const proofs = db.collection("proofs");

    const goal = await goals.findOne({ _id: new ObjectId(goalId) });

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const userObjectId = new ObjectId(userId);
    if (!goal.userId.equals(userObjectId)) {
      return NextResponse.json(
        { error: "Goal does not belong to this user" },
        { status: 403 }
      );
    }

    await proofs.createIndex({ goalId: 1 });

    const createdAt = new Date();
    const doc = {
      goalId: new ObjectId(goalId),
      userId: userObjectId,
      imageUrl: imageUrl.trim(),
      createdAt,
    };

    const result = await proofs.insertOne(doc);

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        goalId: doc.goalId.toString(),
        userId: doc.userId.toString(),
        imageUrl: doc.imageUrl,
        createdAt: doc.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/proofs/upload]", err);
    return NextResponse.json(
      { error: "Failed to store proof" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
