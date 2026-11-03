import "server-only";
import { timingSafeEqual } from "node:crypto";

// Constant-time comparison for webhook / cron secrets. An unset secret
// never matches, so a missing env var fails closed.
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Vercel cron sends "Authorization: Bearer $CRON_SECRET".
export function cronAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return secretMatches(auth?.startsWith("Bearer ") ? auth.slice(7) : null, process.env.CRON_SECRET);
}
