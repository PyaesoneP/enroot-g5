import { NextResponse } from "next/server";
import { rateLimitPurge } from "@/lib/db";
import { cronAuthorized } from "@/lib/secrets";

// Daily (vercel.json, 19:00 UTC = 03:00 SGT): removes rate-limit windows
// older than a day, so retention holds even when no one is signing up
// (migration 0010, doc 05).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const removed = await rateLimitPurge();
  if (removed === null) return NextResponse.json({ error: "Purge failed." }, { status: 502 });
  return NextResponse.json({ removed });
}
