import { NextResponse, type NextRequest } from "next/server";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfRequiresCheck,
  generateCsrfToken,
  verifyCsrfToken,
} from "@/lib/csrf";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function middleware(req: NextRequest): NextResponse {
  const existing = req.cookies.get(CSRF_COOKIE)?.value ?? null;
  const isMutatingApi = csrfRequiresCheck(req.method, req.nextUrl.pathname);

  if (isMutatingApi) {
    const provided = req.headers.get(CSRF_HEADER);
    if (!verifyCsrfToken(provided, existing)) {
      return NextResponse.json(
        { error: "CsrfFailed", message: "Invalid or missing CSRF token." },
        { status: 403 },
      );
    }
    // Token is valid — pass through without rotating it.
    return NextResponse.next();
  }

  // Non-mutating request. Issue a token if the user does not already have one
  // so that subsequent forms / fetches can echo it back.
  if (existing) {
    return NextResponse.next();
  }

  const token = generateCsrfToken();
  // Forward the new cookie on the request as well so RSC `cookies()` calls in
  // this same render see it (otherwise the first page render after a fresh
  // visit would not have the token available for forms).
  const requestHeaders = new Headers(req.headers);
  const cookieHeader = requestHeaders.get("cookie");
  const updated = cookieHeader
    ? `${cookieHeader}; ${CSRF_COOKIE}=${token}`
    : `${CSRF_COOKIE}=${token}`;
  requestHeaders.set("cookie", updated);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
