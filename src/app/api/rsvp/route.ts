import { NextResponse } from "next/server";
import type { VibeId } from "@/lib/content";
import { parsePicks, vibeOf } from "@/activities/charm-builder/picks";
import { rsvp } from "@/lib/db";
import { releaseSignup, reserveSignup } from "@/lib/rate-limit";

// Issue #15: sign-up rides the bracelet builder. Everything is validated
// server-side; the vibe is recomputed from the picks here and never taken
// from the client. No email, phone or student ID is collected (PDPA).
const MAX_BODY_BYTES = 4 * 1024;

// x-forwarded-for is the only client-IP source on Vercel. When it is
// absent, bucket by user agent instead of one shared "unknown" bucket.
const clientIp = (req: Request): string => {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim();
  if (ip) return ip;
  return `ua:${req.headers.get("user-agent") ?? "none"}`.slice(0, 128);
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    const raw = await req.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    }
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  // Nickname optional: 1..40 chars, or empty -> "anonymous" (the DB
  // function re-checks length; strip control characters first).
  const rawName = typeof b.nickname === "string" ? b.nickname.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  if (rawName.length > 40) {
    return NextResponse.json({ error: "Nickname is at most 40 characters." }, { status: 400 });
  }
  const nickname = rawName.length > 0 ? rawName : "anonymous";

  const groupSize = typeof b.groupSize === "number" && Number.isInteger(b.groupSize) ? b.groupSize : 1;
  if (groupSize < 1 || groupSize > 5) {
    return NextResponse.json({ error: "Group size is between 1 and 5." }, { status: 400 });
  }

  // Consent must be ticked; submit_rsvp() stores consent_given = true
  // unconditionally, so a stored row always carries consent.
  if (b.consent !== true) {
    return NextResponse.json({ error: "Consent is required to sign up." }, { status: 400 });
  }

  // Picks arrive in the builder's URL format; parsePicks sanitises (unknown
  // ids, dupes, bad slots dropped, capped at pickCount). Vibe is derived
  // from the parsed picks, exactly as the builder shows it.
  const picks = typeof b.picks === "string" ? parsePicks(b.picks) : null;
  const vibe = vibeOf(picks ?? []);

  // The window slot is reserved BEFORE the database call so parallel
  // requests cannot all pass the check, and released when the row is not
  // stored (failed validation, closed, full) — round-2 finding 1.
  const ip = clientIp(req);
  const limit = reserveSignup(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-ups from here. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let result;
  try {
    result = await rsvp({
      nickname,
      groupSize,
      vibe: vibe ? (vibe.id as VibeId) : null,
      picks,
    });
  } catch (e) {
    releaseSignup(ip);
    // Missing SUPABASE_SERVICE_ROLE_KEY and transport failures both land
    // here: answer with JSON, never the framework's HTML 500.
    console.error("[rsvp] submit failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not save your sign-up. Try again." }, { status: 502 });
  }

  if (!result.ok) {
    releaseSignup(ip);
    switch (result.reason) {
      case "closed":
        return NextResponse.json({ error: "Sign-ups are closed for now." }, { status: 403 });
      case "full":
        return NextResponse.json({ error: "All spots are taken. See you at the door!" }, { status: 403 });
      case "short":
        return NextResponse.json(
          {
            error: `Only ${result.spotsLeft ?? "a few"} ${result.spotsLeft === 1 ? "spot is" : "spots are"} left — try a smaller group, or come as a walk-in.`,
          },
          { status: 403 },
        );
      case "invalid":
        // Unreachable: the route validates first. Log loudly if it fires.
        console.error("[rsvp] DB rejected a route-validated sign-up as invalid");
        return NextResponse.json({ error: "Could not save your sign-up. Try again." }, { status: 400 });
      case "db_error":
        return NextResponse.json({ error: "Could not save your sign-up. Try again." }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: true, vibe: vibe?.id ?? null });
}
