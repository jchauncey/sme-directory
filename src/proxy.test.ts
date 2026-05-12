/**
 * Proxy tests.
 *
 * The proxy enforces two cross-cutting policies:
 *   1. Rate limiting on mutating `/api/*` requests (issue #51).
 *   2. CSRF (double-submit cookie) on the same paths (issue #50).
 *
 * Rate limiting runs first so that brute-force probes without a CSRF token
 * still consume budget. We exercise both layers here.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { proxy } from "./proxy";
import { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken } from "@/lib/csrf";
import { LIMITS, __resetStoreForTests } from "@/lib/rate-limit";

beforeEach(async () => {
  await __resetStoreForTests();
});

function makeRequest(opts: {
  method: string;
  path: string;
  cookieToken?: string | null;
  headerToken?: string | null;
  ip?: string;
}): NextRequest {
  const url = new URL(`http://localhost${opts.path}`);
  const headers = new Headers();
  if (opts.headerToken !== undefined && opts.headerToken !== null) {
    headers.set(CSRF_HEADER, opts.headerToken);
  }
  if (opts.cookieToken !== undefined && opts.cookieToken !== null) {
    headers.set("cookie", `${CSRF_COOKIE}=${opts.cookieToken}`);
  }
  if (opts.ip) {
    headers.set("x-forwarded-for", opts.ip);
  }
  return new NextRequest(url, { method: opts.method, headers });
}

describe("proxy CSRF enforcement on /api/*", () => {
  it("returns 403 when both cookie and header are missing on POST", async () => {
    const res = await proxy(makeRequest({ method: "POST", path: "/api/favorites" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CsrfFailed");
  });

  it("returns 403 when only the header is missing", async () => {
    const token = generateCsrfToken();
    const res = await proxy(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        cookieToken: token,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when only the cookie is missing", async () => {
    const token = generateCsrfToken();
    const res = await proxy(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        headerToken: token,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when header and cookie do not match", async () => {
    const res = await proxy(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        cookieToken: generateCsrfToken(),
        headerToken: generateCsrfToken(),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when the header is malformed", async () => {
    const token = generateCsrfToken();
    const res = await proxy(
      makeRequest({
        method: "POST",
        path: "/api/favorites",
        cookieToken: token,
        headerToken: "not-a-valid-token",
      }),
    );
    expect(res.status).toBe(403);
  });

  it.each(["POST", "PATCH", "PUT", "DELETE"])(
    "passes through %s when token matches",
    async (method) => {
      const token = generateCsrfToken();
      const res = await proxy(
        makeRequest({
          method,
          path: "/api/favorites",
          cookieToken: token,
          headerToken: token,
          // Use a per-method IP so the small favorites bucket isn't exhausted
          // by the parameterized run.
          ip: `198.51.100.${method.length}`,
        }),
      );
      // Pass-through: status 200 (default for NextResponse.next()).
      expect(res.status).toBe(200);
    },
  );
});

describe("proxy CSRF token issuance", () => {
  it("issues a fresh sme_csrf cookie on a non-mutating request without one", async () => {
    const res = (await proxy(makeRequest({ method: "GET", path: "/" }))) as NextResponse;
    const setCookie = res.cookies.get(CSRF_COOKIE);
    expect(setCookie).toBeDefined();
    expect(setCookie!.value).toMatch(/^[0-9a-f]{64}$/);
    expect(setCookie!.httpOnly).toBe(false);
    expect(setCookie!.sameSite).toBe("lax");
  });

  it("does not rotate the cookie when one already exists", async () => {
    const res = (await proxy(
      makeRequest({ method: "GET", path: "/groups", cookieToken: generateCsrfToken() }),
    )) as NextResponse;
    expect(res.cookies.get(CSRF_COOKIE)).toBeUndefined();
  });

  it("does not validate the token on non-/api/ POSTs (server actions)", async () => {
    const res = await proxy(
      makeRequest({ method: "POST", path: "/me", cookieToken: generateCsrfToken() }),
    );
    expect(res.status).toBe(200);
  });

  it("does not validate the token on /api/ GETs", async () => {
    const res = await proxy(makeRequest({ method: "GET", path: "/api/notifications" }));
    expect(res.status).toBe(200);
  });
});

describe("proxy rate limiting on mutating /api/* routes", () => {
  function mutatingRequest(path: string, ip: string): NextRequest {
    const token = generateCsrfToken();
    return makeRequest({
      method: "POST",
      path,
      cookieToken: token,
      headerToken: token,
      ip,
    });
  }

  it("allows up to capacity requests on a mutating /api/* route", async () => {
    const capacity = LIMITS.questions.capacity;
    for (let i = 0; i < capacity; i += 1) {
      const res = await proxy(mutatingRequest("/api/groups/foo/membership/u-1", "10.0.0.1"));
      expect(res.status).not.toBe(429);
    }
  });

  it("returns 429 with Retry-After once the bucket is empty", async () => {
    const capacity = LIMITS.questions.capacity;
    for (let i = 0; i < capacity; i += 1) {
      await proxy(mutatingRequest("/api/groups/foo/membership/u-1", "10.0.0.2"));
    }
    const res = await proxy(mutatingRequest("/api/groups/foo/membership/u-1", "10.0.0.2"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("RateLimited");
    const retry = res.headers.get("Retry-After");
    expect(retry).not.toBeNull();
    expect(Number(retry)).toBeGreaterThanOrEqual(1);
  });

  it("does not rate-limit GET requests", async () => {
    for (let i = 0; i < LIMITS.votes.capacity * 2; i += 1) {
      const res = await proxy(
        makeRequest({
          method: "GET",
          path: "/api/votes",
          ip: "10.0.0.3",
        }),
      );
      expect(res.status).not.toBe(429);
    }
  });

  it("scopes buckets by IP for unauthenticated requests", async () => {
    const capacity = LIMITS.votes.capacity;
    for (let i = 0; i < capacity; i += 1) {
      await proxy(mutatingRequest("/api/votes", "1.1.1.1"));
    }
    const blocked = await proxy(mutatingRequest("/api/votes", "1.1.1.1"));
    expect(blocked.status).toBe(429);
    // A different IP has its own bucket.
    const fresh = await proxy(mutatingRequest("/api/votes", "1.1.1.2"));
    expect(fresh.status).not.toBe(429);
  });

  it("rate-limits BEFORE CSRF (so brute-force probes still consume budget)", async () => {
    // Send capacity requests with NO CSRF tokens — they should 403, but each
    // still consumes a token. The (capacity+1)th request should be 429, not
    // 403, proving rate-limit ran first.
    const capacity = LIMITS.questions.capacity;
    for (let i = 0; i < capacity; i += 1) {
      const res = await proxy(
        makeRequest({
          method: "POST",
          path: "/api/groups/foo/membership/u-1",
          ip: "10.0.0.99",
        }),
      );
      expect(res.status).toBe(403);
    }
    const res = await proxy(
      makeRequest({
        method: "POST",
        path: "/api/groups/foo/membership/u-1",
        ip: "10.0.0.99",
      }),
    );
    expect(res.status).toBe(429);
  });
});
