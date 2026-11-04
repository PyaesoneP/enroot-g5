// Rate limiting for public writes (issues #11, #14, #16, ADR-009),
// store-backed (migration 0009) so every serverless instance shares one
// counter. Limits and key derivation live in ./rate-limit-keys.ts.
// A slot is RESERVED before the database call and RELEASED if the write
// is not stored, so validation mistakes and closed/full rejections stay
// free (PR #37 round 2).
//
// Fail-open: a limit whose store call fails (null) does not block. If no
// reachable limit denies, the request is allowed and that is logged.
// The hard limits stay in the database (capacity in submit_rsvp(), the
// wall_open switch, column bounds).
import "server-only";
import { rateLimitHit, rateLimitRelease } from "@/lib/db";
import { LIMITS, limitKey, type LimitAction, type LimitKind } from "@/lib/rate-limit-keys";

export type RequestIdentity = { ip: string; guest: string | null };

// The two store calls, injectable so scripts/rate-limit-check.mjs can
// test the orchestration without a database.
export type LimitStore = {
  hit: typeof rateLimitHit;
  release: typeof rateLimitRelease;
};
const dbStore: LimitStore = { hit: rateLimitHit, release: rateLimitRelease };

type Limit = { key: string; windowSec: number; max: number };

function limitsFor(action: LimitAction, id: RequestIdentity): Limit[] {
  const kinds: [LimitKind, string][] = [["ip", id.ip]];
  if (id.guest) kinds.push(["guest", id.guest]);
  return kinds.map(([kind, value]) => ({ key: limitKey(action, kind, value), ...LIMITS[action][kind] }));
}

export async function reserve(
  action: LimitAction,
  id: RequestIdentity,
  store: LimitStore = dbStore,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const limits = limitsFor(action, id);
  const results = await Promise.all(limits.map((l) => store.hit(l.key, l.windowSec, l.max)));
  const denied = results.filter((r) => r !== null && !r.allowed);
  if (denied.length === 0) {
    if (results.some((r) => r === null)) {
      console.error(`[rate-limit] ${action}: limiter unreachable; allowing request (fail-open)`);
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

export async function release(action: LimitAction, id: RequestIdentity, store: LimitStore = dbStore): Promise<void> {
  await Promise.all(limitsFor(action, id).map((l) => store.release(l.key, l.windowSec)));
}
