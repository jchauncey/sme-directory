/**
 * Trusted-proxy-aware client IP extraction for rate limiting.
 *
 * Strategy (in priority order):
 *   1. `cf-connecting-ip` — set by Cloudflare, never forgeable upstream of CF.
 *   2. `x-real-ip`       — set by a known proxy when TRUSTED_PROXY_HOPS >= 1.
 *   3. `x-forwarded-for` — take the N-th-from-rightmost non-private value,
 *                          where N = TRUSTED_PROXY_HOPS (default 1).
 *   4. `req.ip`          — Edge-runtime fallback on NextRequest.
 *   5. `"unknown"`       — last resort.
 *
 * Set `TRUSTED_PROXY_HOPS=0` to skip headers entirely and rely on req.ip only.
 * Set `TRUSTED_PROXY_HOPS=1` (default) for a single trusted proxy (e.g. your
 * load balancer).  Set higher if you have a chain of known proxies.
 *
 * Private / loopback addresses are never used as client IPs — they indicate
 * intermediate infrastructure, not real clients.
 */

import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Private / loopback CIDR patterns (IPv4 + IPv6).
// ---------------------------------------------------------------------------

/** Returns true if the IP string is a private/loopback address. */
export function isPrivateIp(ip: string): boolean {
  const trimmed = ip.trim();

  // IPv6 loopback
  if (trimmed === "::1") return true;

  // IPv6 unique-local fc00::/7  (covers fc.. and fd..)
  if (/^f[cd][0-9a-f]{2}:/i.test(trimmed)) return true;

  // IPv4 mapped as ::ffff:x.x.x.x
  const v4mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const v4 = v4mapped ? v4mapped[1]! : trimmed;

  const parts = v4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false; // Not recognisable IPv4 — not private
  }

  const [a, b] = parts as [number, number, number, number];

  return (
    a === 127 || // 127.0.0.0/8  loopback
    a === 10 || // 10.0.0.0/8   private
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) // 192.168.0.0/16 private
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trustedProxyHops(): number {
  const raw = process.env["TRUSTED_PROXY_HOPS"];
  if (!raw) return 1; // default: one trusted proxy
  const n = parseInt(raw, 10);
  return isNaN(n) || n < 0 ? 1 : n;
}

/**
 * Pick the N-th-from-rightmost non-private IP from a comma-separated XFF header.
 *
 * XFF is built left-to-right as packets traverse proxies:
 *   client → proxy1 → proxy2 → your-LB
 * The LB appends the real client IP as the last entry it saw, so the rightmost
 * is your own LB's view. The next one in (rightmost − 1) is the actual client
 * when you have one trusted proxy.
 */
function pickFromXff(xff: string, hops: number): string | null {
  const candidates = xff
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isPrivateIp(s));

  if (candidates.length === 0) return null;

  // The "client" is hops positions from the right (1-indexed).
  // hops=1 means the rightmost non-private entry is the client.
  const idx = candidates.length - hops;
  if (idx < 0) return null;
  const ip = candidates[idx];
  return ip && ip.length > 0 ? ip : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the best-available client IP from a raw `Headers` object.
 *
 * Used by `assertRateLimitForAction` (server actions) where only headers are
 * available, not a full `NextRequest`.
 */
export function clientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const hops = trustedProxyHops();
  if (hops === 0) return null; // caller must use req.ip or "unknown"

  // Priority 1: Cloudflare
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf && cf.length > 0 && !isPrivateIp(cf)) return cf;

  // Priority 2: x-real-ip (set by nginx / known reverse proxy)
  const xri = headers.get("x-real-ip")?.trim();
  if (xri && xri.length > 0 && !isPrivateIp(xri)) return xri;

  // Priority 3: x-forwarded-for with trusted-hop counting
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const ip = pickFromXff(xff, hops);
    if (ip) return ip;
  }

  return null;
}

/**
 * Extract the best-available client IP from a `NextRequest`.
 *
 * Used by `applyRateLimitToApiRequest` (middleware).
 * Falls back to `req.ip` when header-based extraction yields nothing.
 */
export function clientIpFromRequest(req: NextRequest): string {
  const fromHeaders = clientIpFromHeaders(req.headers);
  if (fromHeaders) return fromHeaders;

  // Edge runtime exposes `req.ip` (may be undefined in test environments).
  const reqIp = (req as NextRequest & { ip?: string }).ip;
  if (reqIp && reqIp.length > 0 && !isPrivateIp(reqIp)) return reqIp;

  return "unknown";
}
