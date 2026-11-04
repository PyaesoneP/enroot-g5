// Who is asking, for the public write routes (sign-up, wall, gallery).
// Server-only: reads request headers and derives HMACs with a server key.
import "server-only";
import type { NextResponse } from "next/server";
import { GUEST_COOKIE, guestCookie, validGuestId } from "@/lib/guest";
import { ownerHash } from "@/lib/rate-limit-keys";
import type { RequestIdentity } from "@/lib/rate-limit";

// x-forwarded-for is the only client-IP source on Vercel. When it is
// absent, bucket by user agent instead of one shared "unknown" bucket.
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim();
  if (ip) return ip;
  return `ua:${req.headers.get("user-agent") ?? "none"}`.slice(0, 128);
}

// The g5_guest cookie (issue #13), if it is one we could have issued.
export function guestId(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GUEST_COOKIE}=`));
  return validGuestId(match?.slice(GUEST_COOKIE.length + 1));
}

export function requestIdentity(req: Request): RequestIdentity {
  return { ip: clientIp(req), guest: guestId(req) };
}

// For writes that need an owner (wall posts, gallery entries). The proxy
// skips /api, so a request can arrive without the cookie (cookies were
// cleared, or the first thing the browser did was call the API): mint one
// here and hand it back, so the post stays deletable by its author.
// `issue` sets the new cookie on whatever response the route returns.
export function ensureGuest(req: Request): {
  guest: string;
  owner: string;
  issue: (res: NextResponse) => NextResponse;
} {
  const existing = guestId(req);
  const guest = existing ?? crypto.randomUUID();
  return {
    guest,
    owner: ownerHash(guest),
    issue: (res) => {
      if (!existing) res.cookies.set(guestCookie(guest));
      return res;
    },
  };
}

// The owner hash for a guest id read from cookies() in a server component,
// or null when there is no valid cookie (nothing is "yours" yet).
export function ownerFromCookie(value: string | undefined): string | null {
  const guest = validGuestId(value);
  return guest ? ownerHash(guest) : null;
}
