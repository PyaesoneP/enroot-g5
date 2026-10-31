// Rate limiting for /api/rsvp (issue #15; #11 will generalise this).
// In-memory: one window per server instance — a coarse flood brake, not a
// quota. Only STORED sign-ups count against the window (commitSignup), so
// validation mistakes and closed/full rejections never punish the next
// guest behind the same campus-Wi-Fi NAT (finding 7).
const WINDOW_MS = 60_000;
const MAX_SIGNUPS_PER_IP = 5;
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(ip: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_SIGNUPS_PER_IP) {
    return { allowed: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function commitSignup(ip: string, now = Date.now()): void {
  // Evict stale windows when the map grows unbounded (finding 7).
  if (hits.size >= MAX_TRACKED_IPS) {
    for (const [key, e] of hits) {
      if (now - e.windowStart >= WINDOW_MS) hits.delete(key);
    }
  }
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}
