/**
 * Edge-safe session reading for the rate-limit middleware.
 *
 * Mirrors `readToken` from `@/lib/auth` but without `server-only`, Prisma, or
 * `next/headers` so it can be imported from `src/middleware.ts`.
 */

import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "sme_session";
const ALG = "HS256";

function getSecret(): Uint8Array | null {
  const secret = process.env["AUTH_SECRET"];
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Extract the user id from the signed session cookie, or `null` if the cookie
 * is missing/invalid. Never throws — invalid tokens fall through to the IP
 * key in the rate-limit pipeline.
 */
export async function readUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
