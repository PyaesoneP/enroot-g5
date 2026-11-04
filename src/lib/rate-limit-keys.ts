// Rate-limit keys and limits (issues #11, #14, #16), shared by
// src/lib/rate-limit.ts, src/lib/identity.ts and scripts/dal-check.mjs.
// Alias-free on purpose: plain Node (type stripping) cannot resolve the
// "@/" tsconfig paths.
//
// Keys are HMAC-SHA256 of the IP / guest id, keyed with the service-role
// key (already server-only, already required for every write): the store
// never sees a raw IP or guest id.
import { createHmac } from "node:crypto";

export type LimitAction = "signup" | "wall" | "gallery";
export type LimitKind = "ip" | "guest";
export type Limit = { windowSec: number; max: number };

// Per IP: a flood brake (campus Wi-Fi puts a crowd behind one IP, so it is
// loose). Per guest: the g5_guest cookie (#13). Tuning is a guess until
// event day (ADR-009); raise a number here if real use hits it.
export const LIMITS: Record<LimitAction, Record<LimitKind, Limit>> = {
  signup: {
    ip: { windowSec: 60, max: 10 },
    guest: { windowSec: 60 * 60, max: 5 },
  },
  wall: {
    ip: { windowSec: 60, max: 20 },
    guest: { windowSec: 10 * 60, max: 5 },
  },
  gallery: {
    ip: { windowSec: 60, max: 20 },
    guest: { windowSec: 60 * 60, max: 10 },
  },
};

function hmac(value: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", secret).update(value).digest("base64url");
}

// "<action>:<kind>:<hmac>". Each action counts separately, so posting on
// the wall never uses up sign-up slots.
export function limitKey(action: LimitAction, kind: LimitKind, value: string): string {
  return `${action}:${kind}:${hmac(value)}`;
}

// Who owns a wall post or gallery entry: an HMAC of the guest id with its
// own label, so it never equals a limit key and a store leak cannot be
// turned back into a cookie that deletes someone's post.
export function ownerHash(guest: string): string {
  return hmac(`owner:${guest}`);
}
