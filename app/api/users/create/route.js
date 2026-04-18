import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    const email = body?.email;
    const walletAddress = body?.walletAddress;

    if (!isNonEmptyString(email) || !isNonEmptyString(walletAddress)) {
      return NextResponse.json(
        { error: 'Fields "email" and "walletAddress" are required strings' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedWallet = walletAddress.trim();

    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection("users");

    await users.createIndex({ email: 1 }, { unique: true });

    const createdAt = new Date();
    const doc = {
      email: trimmedEmail,
      walletAddress: trimmedWallet,
      createdAt,
    };

    const result = await users.insertOne(doc);

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        email: doc.email,
        walletAddress: doc.walletAddress,
        createdAt: doc.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    console.error("[POST /api/users/create]", err);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
