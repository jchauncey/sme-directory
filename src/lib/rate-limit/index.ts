/**
 * Rate-limit public surface.
 *
 * - Server actions call `assertRateLimitForAction(group)` at the top of the
 *   handler; over-limit throws `RateLimitError(retryAfterMs)`, which the
 *   action catches and surfaces in its existing form-state shape.
 * - The proxy calls `applyRateLimitToApiRequest(req)` to enforce limits
 *   on mutating `/api/*` requests before they reach the route handler.
 *
 * The store backend is selected via `getStore()`. In dev/test it is the
 * in-memory token-bucket implementation; production deployments can swap in a
 * shared store (Redis, Upstash KV, etc.) without changing call sites.
 */

import type { NextRequest } from "next/server";
import { LIMITS, groupForApiPath, type LimitGroup } from "./config";
import { MemoryStore, type RateLimitStore } from "./store";
import { readUserIdFromRequest } from "./auth-edge";
import { clientIpFromHeaders, clientIpFromRequest } from "./ip";

export { LIMITS, groupForApiPath } from "./config";
export type { LimitGroup } from "./config";
export { clientIpFromHeaders, clientIpFromRequest } from "./ip";

export class RateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterMs}ms.`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

let store: RateLimitStore | null = null;

export function getStore(): RateLimitStore {
  if (!store) store = new MemoryStore();
  return store;
}

/**
 * Test hook — discards the singleton so each test starts with empty buckets.
 */
export async function __resetStoreForTests(): Promise<void> {
  if (store) await store.reset();
  store = null;
}

export type ConsumeOk = { allowed: true; retryAfterMs: 0; remaining: number };
export type ConsumeFail = { allowed: false; retryAfterMs: number; remaining: number };

/**
 * Consume one token for `(key, group)`. Lower-level helper exposed for
 * tests; production callers should prefer `assertRateLimit`.
 */
export async function consume(
  key: string,
  group: LimitGroup,
): Promise<ConsumeOk | ConsumeFail> {
  const limit = LIMITS[group];
  const result = await getStore().consume(`${group}:${key}`, 1, limit);
  if (result.allowed) {
    return { allowed: true, retryAfterMs: 0, remaining: result.remaining };
  }
  return {
    allowed: false,
    retryAfterMs: result.retryAfterMs,
    remaining: result.remaining,
  };
}

/**
 * Throw `RateLimitError` if the caller is over the limit.
 *
 * The bucket key is derived from the configured scope:
 *   - `user` scope → `userId`, falling back to `ip` when there is no session
 *     (so anonymous brute force still consumes budget).
 *   - `ip` scope   → `ip`.
 *
 * `"unknown"` is used as a last resort when neither identity is available;
 * this collapses anonymous bursts into a single shared bucket, which is the
 * correct fail-closed behavior for misconfigured deployments.
 */
export async function assertRateLimit(opts: {
  group: LimitGroup;
  userId?: string | null;
  ip?: string | null;
}): Promise<void> {
  const limit = LIMITS[opts.group];
  let key: string;
  if (limit.scope === "user") {
    key = opts.userId || opts.ip || "unknown";
  } else {
    key = opts.ip || "unknown";
  }
  const result = await consume(key, opts.group);
  if (!result.allowed) throw new RateLimitError(result.retryAfterMs);
}

/**
 * Server-action convenience wrapper. Reads the session and forwarded IP from
 * `next/headers` and `@/lib/auth` so callers only need to know their group.
 *
 * Imports are deferred so the function tree is free of `next/headers` and
 * `server-only` until it actually runs in a server-action context.
 */
export async function assertRateLimitForAction(group: LimitGroup): Promise<void> {
  const [{ headers }, { getSession }] = await Promise.all([
    import("next/headers"),
    import("@/lib/auth"),
  ]);
  const hdrs = await headers();
  const ip = clientIpFromHeaders(hdrs) ?? "unknown";
  const session = await getSession();
  await assertRateLimit({ group, userId: session?.user.id ?? null, ip });
}

/**
 * Middleware entry point. Returns `null` if the request is allowed (or not
 * subject to rate limiting), or a 429 `Response` with `Retry-After` if the
 * caller is over the limit.
 *
 * Only mutating verbs are inspected — GET/HEAD/OPTIONS pass through untouched.
 */
export async function applyRateLimitToApiRequest(
  req: NextRequest,
): Promise<Response | null> {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const url = new URL(req.url);
  const group = groupForApiPath(url.pathname);
  if (!group) return null;

  const limit = LIMITS[group];
  const ip = clientIpFromRequest(req);
  const userId = await readUserIdFromRequest(req);
  const key =
    limit.scope === "user" ? userId || ip || "unknown" : ip || "unknown";
  const result = await consume(key, group);
  if (result.allowed) return null;

  const retryAfterSec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return new Response(
    JSON.stringify({
      error: "RateLimited",
      message: "Too many requests. Try again shortly.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}
