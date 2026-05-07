/**
 * CSRF protection — double-submit cookie pattern.
 *
 * The `sme_csrf` cookie is issued by the middleware on the first request that
 * does not already carry one and refreshed via `signOut` (which clears it).
 * It is intentionally NOT httpOnly so the client can echo it back via the
 * `x-csrf-token` header (for `fetch`) or a `_csrf` form field (for forms /
 * server actions). The middleware enforces the header check on POST/PATCH/
 * PUT/DELETE under `/api/*`. Server actions validate the form field via
 * `assertCsrf(formData)`.
 *
 * Keep the constants and pure-helpers in this file so both the Edge runtime
 * (middleware) and the Node runtime (route handlers, server actions, RSC) can
 * share them without dragging in `next/headers`.
 */
export const CSRF_COOKIE = "sme_csrf";
export const CSRF_HEADER = "x-csrf-token";
export const CSRF_FIELD = "_csrf";

const TOKEN_BYTES = 32;
const HEX_TOKEN_LENGTH = TOKEN_BYTES * 2;

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

export function isValidTokenShape(token: string | null | undefined): token is string {
  if (typeof token !== "string") return false;
  if (token.length !== HEX_TOKEN_LENGTH) return false;
  return /^[0-9a-f]+$/.test(token);
}

export function verifyCsrfToken(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!isValidTokenShape(provided) || !isValidTokenShape(expected)) return false;
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function csrfRequiresCheck(method: string, pathname: string): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return false;
  return pathname === "/api" || pathname.startsWith("/api/");
}
