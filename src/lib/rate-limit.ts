// Sign-up rate limiting (issue #11, ADR-009), store-backed (migration
// 0009) so every serverless instance shares one counter. Two limits:
//   - per IP:    10 per minute (a flood brake; campus Wi-Fi shares IPs)
//   - per guest: 5 per hour, when the g5_guest cookie is present (#13)
// A slot is RESERVED before the database call and RELEASED if the sign-up
// is not stored, so validation mistakes and closed/full rejections stay
// free (PR #37 round 2).
//
// Keys are HMAC-SHA256 of the IP / guest id, keyed with the service-role
// key (already server-only, already required for sign-ups): the store
// never sees a raw IP.
//
// Fail-open: if the limiter cannot be reached the request is allowed and
// logged. submit_rsvp()'s capacity gate remains the hard limit, and a
// store outage fails the sign-up anyway.
import "server-only";
import { createHmac } from "node:crypto";
import { rateLimitHit, rateLimitRelease } from "@/lib/db";

type Limit = { key: string; windowSec: number; max: number };

const IP_WINDOW_SEC = 60;
const IP_MAX = 10;
const GUEST_WINDOW_SEC = 60 * 60;
const GUEST_MAX = 5;

export type SignupIdentity = { ip: string; guest: string | null };

function hash(kind: string, value: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return `${kind}:${createHmac("sha256", secret).update(value).digest("base64url")}`;
}

function limitsFor(id: SignupIdentity): Limit[] {
  const limits: Limit[] = [{ key: hash("ip", id.ip), windowSec: IP_WINDOW_SEC, max: IP_MAX }];
  if (id.guest) limits.push({ key: hash("guest", id.guest), windowSec: GUEST_WINDOW_SEC, max: GUEST_MAX });
  return limits;
}

export async function reserveSignup(id: SignupIdentity): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const limits = limitsFor(id);
  const results = await Promise.all(limits.map((l) => rateLimitHit(l.key, l.windowSec, l.max)));
  if (results.some((r) => r === null)) {
    console.error("[rate-limit] limiter unreachable; allowing request (fail-open)");
  }
  const denied = results.filter((r) => r !== null && !r.allowed);
  if (denied.length === 0) return { allowed: true, retryAfterSec: 0 };
  // Every limit counted a hit; give back the ones that did allow it, so a
  // request refused by one limit does not also burn the other.
  await Promise.all(
    limits.map((l, i) => (results[i]?.allowed ? rateLimitRelease(l.key, l.windowSec) : undefined)),
  );
  return { allowed: false, retryAfterSec: Math.max(...denied.map((r) => r!.retryAfterSec)) };
}

export async function releaseSignup(id: SignupIdentity): Promise<void> {
  await Promise.all(limitsFor(id).map((l) => rateLimitRelease(l.key, l.windowSec)));
}

// For scripts/dal-check.mjs (seeding the e2e flood test).
export const _internal = { hash, IP_WINDOW_SEC, IP_MAX, GUEST_WINDOW_SEC, GUEST_MAX };
