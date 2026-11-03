// Sign-up rate limiting (issue #11, ADR-009), store-backed (migration
// 0009) so every serverless instance shares one counter. Limits and key
// derivation live in ./rate-limit-keys.ts.
// A slot is RESERVED before the database call and RELEASED if the sign-up
// is not stored, so validation mistakes and closed/full rejections stay
// free (PR #37 round 2).
//
// Fail-open: a limit whose store call fails (null) does not block. If no
// reachable limit denies, the request is allowed and that is logged.
// submit_rsvp()'s capacity gate remains the hard limit.
import "server-only";
import { rateLimitHit, rateLimitRelease } from "@/lib/db";
import { LIMITS, limitKey, type LimitKind } from "@/lib/rate-limit-keys";

export type SignupIdentity = { ip: string; guest: string | null };

// The two store calls, injectable so scripts/rate-limit-check.mjs can
// test the orchestration without a database.
export type LimitStore = {
  hit: typeof rateLimitHit;
  release: typeof rateLimitRelease;
};
const dbStore: LimitStore = { hit: rateLimitHit, release: rateLimitRelease };

type Limit = { key: string; windowSec: number; max: number };

function limitsFor(id: SignupIdentity): Limit[] {
  const kinds: [LimitKind, string][] = [["ip", id.ip]];
  if (id.guest) kinds.push(["guest", id.guest]);
  return kinds.map(([kind, value]) => ({ key: limitKey(kind, value), ...LIMITS[kind] }));
}

export async function reserveSignup(
  id: SignupIdentity,
  store: LimitStore = dbStore,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const limits = limitsFor(id);
  const results = await Promise.all(limits.map((l) => store.hit(l.key, l.windowSec, l.max)));
  const denied = results.filter((r) => r !== null && !r.allowed);
  if (denied.length === 0) {
    if (results.some((r) => r === null)) {
      console.error("[rate-limit] limiter unreachable; allowing request (fail-open)");
    }
    return { allowed: true, retryAfterSec: 0 };
  }
  // Every reachable limit counted a hit; give back the ones that allowed
  // it, so a request refused by one limit does not also burn the other.
  await Promise.all(
    limits.map((l, i) => (results[i]?.allowed ? store.release(l.key, l.windowSec) : undefined)),
  );
  return { allowed: false, retryAfterSec: Math.max(...denied.map((r) => r!.retryAfterSec)) };
}

export async function releaseSignup(id: SignupIdentity, store: LimitStore = dbStore): Promise<void> {
  await Promise.all(limitsFor(id).map((l) => store.release(l.key, l.windowSec)));
}
