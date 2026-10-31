// Rate limiting for /api/rsvp (issue #15; #11 will generalise this).
// In-memory: one window per server instance — a coarse flood brake, not a
// quota. The window slot is RESERVED before the database call and
// RELEASED if the sign-up is not stored, so validation mistakes and
// closed/full rejections stay free while N parallel requests from one IP
// cannot all pass the check before any of them commits (round-2 finding).
const WINDOW_MS = 60_000;
const MAX_SIGNUPS_PER_IP = 10;
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, { count: number; windowStart: number }>();

export function reserveSignup(ip: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // Evict stale windows when the map grows unbounded (round-1 finding 7).
    if (hits.size >= MAX_TRACKED_IPS) {
      for (const [key, e] of hits) {
        if (now - e.windowStart >= WINDOW_MS) hits.delete(key);
      }
    }
    hits.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_SIGNUPS_PER_IP) {
    return { allowed: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function releaseSignup(ip: string, now = Date.now()): void {
  const entry = hits.get(ip);
  if (entry && now - entry.windowStart < WINDOW_MS) {
    entry.count = Math.max(0, entry.count - 1);
  }
}
