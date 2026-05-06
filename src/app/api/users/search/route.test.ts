/**
 * GET /api/users/search route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-users-search-test-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.AUTH_SECRET = "0".repeat(32) + "abcdef0123456789abcdef0123456789";

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

const auth = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { GET } = await import("./route");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../../../../..");
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

describe("GET /api/users/search", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET(new Request("http://x/api/users/search?q=jane"));
    expect(res.status).toBe(401);
  });

  it("returns matching users for an authenticated request", async () => {
    const sessionEmail = `requester-${Date.now()}@example.com`;
    await auth.signIn(sessionEmail);

    const target = `quokkahunter-${Date.now()}@example.com`;
    await db.user.create({ data: { email: target, name: "Quokka Hunter" } });

    const res = await GET(new Request("http://x/api/users/search?q=quokkahunter&limit=5"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: { id: string; email: string }[] };
    expect(json.items.some((u) => u.email === target)).toBe(true);
  });

  it("returns empty items for blank query", async () => {
    await auth.signIn(`r2-${Date.now()}@example.com`);
    const res = await GET(new Request("http://x/api/users/search?q="));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: unknown[] };
    expect(json.items).toEqual([]);
  });
});
