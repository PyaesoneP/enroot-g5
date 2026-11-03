// Rate-limit keys and limits (issue #11), shared by src/lib/rate-limit.ts
// and scripts/dal-check.mjs. Alias-free on purpose: plain Node (type
// stripping) cannot resolve the "@/" tsconfig paths.
//
// Keys are HMAC-SHA256 of the IP / guest id, keyed with the service-role
// key (already server-only, already required for sign-ups): the store
// never sees a raw IP.
import { createHmac } from "node:crypto";

export type LimitKind = "ip" | "guest";

// per IP: a flood brake (campus Wi-Fi shares IPs); per guest: the g5_guest
// cookie (#13).
export const LIMITS: Record<LimitKind, { windowSec: number; max: number }> = {
  ip: { windowSec: 60, max: 10 },
  guest: { windowSec: 60 * 60, max: 5 },
};

export function limitKey(kind: LimitKind, value: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return `${kind}:${createHmac("sha256", secret).update(value).digest("base64url")}`;
}
