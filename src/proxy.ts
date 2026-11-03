import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, GUEST_MAX_AGE_SEC } from "@/lib/guest";

// Issues the guest cookie (issue #13) on the first page visit. The matcher
// only runs this when the cookie is missing, and never for API routes,
// build assets or public files, so cached pages stay cheap.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.has(GUEST_COOKIE)) {
    response.cookies.set({
      name: GUEST_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_MAX_AGE_SEC,
    });
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
