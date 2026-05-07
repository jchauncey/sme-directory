/**
 * Middleware CSRF tests.
 *
 * The middleware is the only place that enforces CSRF on `/api/*` mutating
 * requests. We send synthetic `NextRequest`s through it and assert that
 * missing / mismatched tokens are 403 while valid tokens (header echo of the
 * `sme_csrf` cookie) pass through.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken } from "@/lib/csrf";

function makeRequest(opts: {
  method: string;
  path: string;
  cookieToken?: string | null;
  headerToken?: string | null;
}): NextRequest {
  const url = new URL(`http://localhost${opts.path}`);
  const headers = new Headers();
  if (opts.headerToken !== undefined && opts.headerToken !== null) {
    headers.set(CSRF_HEADER, opts.headerToken);
  }
  if (opts.cookieToken !== undefined && opts.cookieToken !== null) {
    headers.set("cookie", `${CSRF_COOKIE}=${opts.cookieToken}`);
  }
  return new NextRequest(url, { method: opts.method, headers });
}

describe("middleware CSRF enforcement on /api/*", () => {
  it("returns 403 when both cookie and header are missing on POST", async () => {
    const res = middleware(makeRequest({ method: "POST", path: "/api/favorites" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CsrfFailed");
  });

  it("returns 403 when only the header is missing", () => {
    const token = generateCsrfToken();
    const res = middleware(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        cookieToken: token,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when only the cookie is missing", () => {
    const token = generateCsrfToken();
    const res = middleware(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        headerToken: token,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when header and cookie do not match", () => {
    const res = middleware(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        cookieToken: generateCsrfToken(),
        headerToken: generateCsrfToken(),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when the header is malformed", () => {
    const token = generateCsrfToken();
    const res = middleware(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        cookieToken: token,
        headerToken: "not-a-valid-token",
      }),
    );
    expect(res.status).toBe(403);
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])("passes through %s when token matches", (method) => {
    const token = generateCsrfToken();
    const res = middleware(
      makeRequest({
        method,
        path: "/api/favorites",
        cookieToken: token,
        headerToken: token,
      }),
    );
    // Pass-through: status 200 (default for NextResponse.next()).
    expect(res.status).toBe(200);
  });
});

describe("middleware CSRF token issuance", () => {
  it("issues a fresh sme_csrf cookie on a non-mutating request without one", () => {
    const res = middleware(makeRequest({ method: "GET", path: "/" }));
    const setCookie = res.cookies.get(CSRF_COOKIE);
    expect(setCookie).toBeDefined();
    expect(setCookie!.value).toMatch(/^[0-9a-f]{64}$/);
    expect(setCookie!.httpOnly).toBe(false);
    expect(setCookie!.sameSite).toBe("lax");
  });

  it("does not rotate the cookie when one already exists", () => {
    const existing = generateCsrfToken();
    const res = middleware(makeRequest({ method: "GET", path: "/groups", cookieToken: existing }));
    expect(res.cookies.get(CSRF_COOKIE)).toBeUndefined();
  });

  it("does not validate the token on non-/api/ POSTs (server actions)", () => {
    const res = middleware(
      makeRequest({ method: "POST", path: "/me", cookieToken: generateCsrfToken() }),
    );
    expect(res.status).toBe(200);
  });

  it("does not validate the token on /api/ GETs", () => {
    const res = middleware(makeRequest({ method: "GET", path: "/api/notifications" }));
    expect(res.status).toBe(200);
  });
});
