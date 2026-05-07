import { NextResponse, type NextRequest } from "next/server";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfRequiresCheck,
  generateCsrfToken,
  verifyCsrfToken,
} from "@/lib/csrf";
import { applyRateLimitToApiRequest } from "@/lib/rate-limit";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Edge middleware combining rate-limiting and CSRF protection.
 *
 * Order is intentional:
 *   1. Rate-limit mutating `/api/*` requests FIRST. Brute-force probes that
 *      have no CSRF token must still consume rate-limit budget — otherwise the
 *      attacker pays no cost for failed-CSRF requests.
 *   2. CSRF check runs second on the same `/api/*` mutations. If the token
 *      mismatches we reject with 403.
 *   3. For all other requests (including non-`/api/*` GETs) we issue a fresh
 *      `sme_csrf` cookie when one is missing so subsequent forms can echo it.
 */
export async function middleware(req: NextRequest): Promise<NextResponse | Response> {
  const isMutatingApi = csrfRequiresCheck(req.method, req.nextUrl.pathname);

  if (isMutatingApi) {
    const limited = await applyRateLimitToApiRequest(req);
    if (limited) return limited;

    const existing = req.cookies.get(CSRF_COOKIE)?.value ?? null;
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
  const existing = req.cookies.get(CSRF_COOKIE)?.value ?? null;
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
