import { SignJWT } from "jose";

export type Cookie = { name: string; value: string };

/**
 * Module-level singleton backing the next/headers mock. Tests can poke values
 * into this map directly (e.g. to test malformed cookies) or use
 * `setSessionUser` for the common case.
 */
export const cookieStore = new Map<string, Cookie>();

const SESSION_COOKIE = "sme_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Factory used by tests as:
 *   vi.mock("next/headers", async () => (await import("@test/auth-mock")).nextHeadersMock());
 *
 * The dynamic import is required because `vi.mock` is hoisted above static
 * imports and cannot reference them directly.
 */
export function nextHeadersMock() {
  return {
    cookies: async () => ({
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string) => {
        cookieStore.set(name, { name, value });
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      },
    }),
  };
}

/** Factory paired with `nextHeadersMock`; see that doc-comment for usage. */
export function nextNavigationMock() {
  return {
    redirect: (url: string) => {
      throw new Error(`REDIRECT:${url}`);
    },
  };
}

/** Drop all cookies — call from `beforeEach` to isolate sessions. */
export function clearSession(): void {
  cookieStore.clear();
}

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

/**
 * Mints a real signed JWT (matching `src/lib/auth.ts`) and writes it into the
 * cookie store, so subsequent `getSession()` reads decode it for real.
 */
export async function setSessionUser(user: SessionUser): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Call setupTestDb() first or set AUTH_SECRET manually.",
    );
  }
  const token = await new SignJWT({
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
  cookieStore.set(SESSION_COOKIE, { name: SESSION_COOKIE, value: token });
}
