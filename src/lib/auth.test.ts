/**
 * Auth shim tests.
 *
 * Exercises the public surface of src/lib/auth.ts:
 *   - getSession / auth (read cookie, verify JWT)
 *   - signIn (upsert user, mint+set cookie, prod guard)
 *   - signOut (clear cookie)
 *   - requireAuth (redirect when unauthenticated)
 *
 * Strategy: stub `next/headers` cookies() with an in-memory Map and
 * stub `next/navigation` redirect() to throw a recognizable error.
 * Hits a real throwaway SQLite DB for the upsert paths.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { setupTestDb } from "@test/db";
import { clearSession, cookieStore } from "@test/auth-mock";

vi.mock("next/headers", async () => (await import("@test/auth-mock")).nextHeadersMock());
vi.mock("next/navigation", async () => (await import("@test/auth-mock")).nextNavigationMock());

setupTestDb("auth");

const auth = await import("./auth");
const { db } = await import("./db");

beforeEach(() => {
  clearSession();
});

describe("getSession", () => {
  it("returns null when no cookie is set", async () => {
    expect(await auth.getSession()).toBeNull();
  });

  it("returns null when the cookie value is not a JWT", async () => {
    cookieStore.set("sme_session", { name: "sme_session", value: "garbage" });
    expect(await auth.getSession()).toBeNull();
  });

  it("returns null when the JWT signature does not match AUTH_SECRET", async () => {
    const wrongSecret = new TextEncoder().encode("wrong".padEnd(32, "x"));
    const token = await new SignJWT({ email: "foo@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-id")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongSecret);
    cookieStore.set("sme_session", { name: "sme_session", value: token });
    expect(await auth.getSession()).toBeNull();
  });

  it("returns null when the JWT is expired", async () => {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const token = await new SignJWT({ email: "old@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-id")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret);
    cookieStore.set("sme_session", { name: "sme_session", value: token });
    expect(await auth.getSession()).toBeNull();
  });

  it("auth() is an alias for getSession()", async () => {
    expect(auth.auth).toBe(auth.getSession);
  });
});

describe("signIn / signOut", () => {
  it("upserts a user, sets the cookie, and getSession reads it back", async () => {
    await auth.signIn("alice@example.com");
    const session = await auth.getSession();
    expect(session).not.toBeNull();
    expect(session!.user.email).toBe("alice@example.com");
    const dbUser = await db.user.findUnique({ where: { email: "alice@example.com" } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.id).toBe(session!.user.id);
  });

  it("re-signing in with the same email reuses the existing user", async () => {
    const first = await auth.signIn("dup@example.com");
    cookieStore.clear();
    const second = await auth.signIn("dup@example.com");
    expect(second.user.id).toBe(first.user.id);
  });

  it("normalizes email (trim + lowercase)", async () => {
    await auth.signIn("  Mixed@Example.COM  ");
    const dbUser = await db.user.findUnique({ where: { email: "mixed@example.com" } });
    expect(dbUser).not.toBeNull();
  });

  it("rejects malformed emails", async () => {
    await expect(auth.signIn("not-an-email")).rejects.toThrow(/valid email/i);
    await expect(auth.signIn("")).rejects.toThrow(/valid email/i);
  });

  it("signOut clears the cookie", async () => {
    await auth.signIn("bye@example.com");
    expect(await auth.getSession()).not.toBeNull();
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    expect(cookieStore.has("sme_session")).toBe(false);
  });

  it("throws when NODE_ENV=production (dev-only guard)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(auth.signIn("prod@example.com")).rejects.toThrow(/production/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("requireAuth", () => {
  it("redirects to /login when there is no session", async () => {
    await expect(auth.requireAuth()).rejects.toThrow("REDIRECT:/login");
  });

  it("returns the session when authenticated", async () => {
    await auth.signIn("ok@example.com");
    const session = await auth.requireAuth();
    expect(session.user.email).toBe("ok@example.com");
  });
});

describe("requireSuperAdmin", () => {
  it("redirects to /login when there is no session", async () => {
    await expect(auth.requireSuperAdmin()).rejects.toThrow("REDIRECT:/login");
  });

  it("404s when authenticated but not a super admin", async () => {
    await auth.signIn("plain@example.com");
    await expect(auth.requireSuperAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("returns the session when the user is a super admin", async () => {
    await auth.signIn("admin@example.com");
    await db.user.update({
      where: { email: "admin@example.com" },
      data: { isSuperAdmin: true },
    });
    // Refresh the session cookie so the JWT picks up isSuperAdmin=true.
    await auth.refreshSession();
    const session = await auth.requireSuperAdmin();
    expect(session.user.isSuperAdmin).toBe(true);
  });
});
