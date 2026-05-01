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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

// ---- env: throw-away DB + a real-shaped AUTH_SECRET ----
const testDbPath = path.join(os.tmpdir(), `sme-auth-test-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.AUTH_SECRET = "0".repeat(32) + "abcdef0123456789abcdef0123456789";

// ---- in-memory cookie store backing next/headers ----
type Cookie = { name: string; value: string };
const cookieStore = new Map<string, Cookie>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, { name, value });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

// Imports happen AFTER env + mocks are set so the modules pick them up.
const auth = await import("./auth");
const { db } = await import("./db");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  execSync("node_modules/.bin/prisma migrate deploy", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "pipe",
  });
  await db.$connect();
});

afterAll(async () => {
  await db.$disconnect();
  for (const ext of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${testDbPath}${ext}`);
    } catch {
      // ignore
    }
  }
});

beforeEach(() => {
  cookieStore.clear();
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
