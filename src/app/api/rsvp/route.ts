import { NextResponse } from "next/server";
import type { VibeId } from "@/lib/content";
import { parsePicks, vibeOf } from "@/activities/charm-builder/picks";
import { rsvp } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// Issue #15: sign-up rides the bracelet builder. Everything is validated
// server-side; the vibe is recomputed from the picks here and never taken
// from the client. No email, phone or student ID is collected (PDPA).
const MAX_BODY = 4 * 1024;

const clientIp = (req: Request): string => {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown") ?? "unknown";
};

export async function POST(req: Request) {
  const limit = rateLimit(clientIp(req));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-ups from here. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // Nickname optional: 1..40 chars, or empty -> "anonymous" (the DB CHECK
  // enforces length; strip control characters first).
  const rawName = typeof b.nickname === "string" ? b.nickname.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  if (rawName.length > 40) {
    return NextResponse.json({ error: "Nickname is at most 40 characters." }, { status: 400 });
  }
  const nickname = rawName.length > 0 ? rawName : "anonymous";

  const groupSize = typeof b.groupSize === "number" && Number.isInteger(b.groupSize) ? b.groupSize : 1;
  if (groupSize < 1 || groupSize > 5) {
    return NextResponse.json({ error: "Group size is between 1 and 5." }, { status: 400 });
  }

  const consent = b.consent === true;
  if (!consent) {
    return NextResponse.json({ error: "Consent is required to sign up." }, { status: 400 });
  }

  // Picks arrive in the builder's URL format; parsePicks sanitises (unknown
  // ids, dupes, bad slots dropped, capped at pickCount). Vibe is derived
  // from the parsed picks, exactly as the builder shows it.
  const picks = typeof b.picks === "string" ? parsePicks(b.picks) : null;
  const vibe = vibeOf(picks ?? []);

  let result;
  try {
    result = await rsvp({
      nickname,
      consent,
      groupSize,
      vibe: vibe ? (vibe.id as VibeId) : null,
      picks,
    });
  } catch {
    return NextResponse.json({ error: "Could not save your sign-up. Try again." }, { status: 502 });
  }
  if (!result.ok) {
    if (result.reason === "closed") {
      return NextResponse.json({ error: "Sign-ups are closed for now." }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not save your sign-up. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, vibe: vibe?.id ?? null });
}
