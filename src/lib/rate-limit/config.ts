/**
 * Rate-limit groups and per-group limits.
 *
 * Limits are derived as `capacity` / `windowMs` to keep the configuration
 * intuitive (e.g. "5 sign-ins per minute") while exposing the token-bucket
 * primitives the store needs.
 */

import type { Limit } from "./store";

export type LimitGroup = "signIn" | "votes" | "favorites" | "questions" | "default";

export type LimitScope = "ip" | "user";

export type LimitConfig = Limit & { scope: LimitScope; windowMs: number; max: number };

function tokensPerMs(max: number, windowMs: number): number {
  return max / windowMs;
}

const MINUTE_MS = 60_000;

function build(max: number, windowMs: number, scope: LimitScope): LimitConfig {
  return {
    capacity: max,
    refillRatePerMs: tokensPerMs(max, windowMs),
    scope,
    windowMs,
    max,
  };
}

export const LIMITS: Record<LimitGroup, LimitConfig> = {
  // Brute-force protection — keyed by IP because the attacker has no session.
  signIn: build(5, MINUTE_MS, "ip"),
  // Per-user throttle on voting spam.
  votes: build(30, MINUTE_MS, "user"),
  // Per-user throttle on favorite churn.
  favorites: build(30, MINUTE_MS, "user"),
  // Per-user throttle on question/answer authorship.
  questions: build(10, MINUTE_MS, "user"),
  // Catch-all for any mutating /api/* path not matched by a specific group.
  // Looser than per-feature limits to avoid blocking legitimate workflows.
  default: build(60, MINUTE_MS, "user"),
};

/**
 * Resolve which rate-limit group applies to a mutating `/api/*` request, or
 * `null` if the path is not under `/api/` at all (the request should pass
 * through untouched).
 *
 * For any `/api/*` path that is not matched by a specific group, `"default"`
 * is returned so that every mutation has *some* ceiling — the default limit is
 * intentionally looser than per-feature limits to avoid blocking legitimate
 * workflows.
 *
 * Path matching is intentionally conservative: GETs/HEADs are never rate
 * limited at the proxy layer, and routes that are already gated by
 * server-action `assertRateLimitForAction` calls don't need a second pass.
 */
export function groupForApiPath(pathname: string): LimitGroup | null {
  if (!pathname.startsWith("/api/")) return null;

  if (pathname.startsWith("/api/votes")) return "votes";
  if (pathname.startsWith("/api/favorites")) return "favorites";
  if (
    pathname.startsWith("/api/questions") ||
    pathname.match(/^\/api\/groups\/[^/]+\/questions/) ||
    pathname.match(/^\/api\/answers\//) ||
    pathname.match(/^\/api\/groups\/[^/]+\/membership/)
  ) {
    return "questions";
  }
  // Any other mutating /api/* request falls through to the default ceiling.
  return "default";
}
