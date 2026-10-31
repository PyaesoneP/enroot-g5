// Per-IP rate limiting for /api/rsvp (issue #15; #11 will generalise this).
// In-memory: one window per server instance — a coarse flood brake, not a
// quota. Returns the seconds to wait before the next allowed attempt.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

const hits = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(ip: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}
