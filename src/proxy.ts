import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, guestCookie } from "@/lib/guest";

// Issues the guest cookie (issue #13) on the first page visit. The matcher
// only runs this when the cookie is missing, and never for API routes,
// build assets or public files, so cached pages stay cheap.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.has(GUEST_COOKIE)) {
    response.cookies.set(guestCookie(crypto.randomUUID()));
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/|.*\\..*).*)",
      missing: [{ type: "cookie", key: "g5_guest" }],
    },
  ],
};
