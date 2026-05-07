/**
 * GET /api/groups/check-slug route handler tests.
 *
 * Mirrors the throw-away SQLite pattern used by the rest of the api/* tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-check-slug-test-${Date.now()}.db`);
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

function makeRequest(slug: string): Request {
  return new Request(`http://localhost/api/groups/check-slug?slug=${encodeURIComponent(slug)}`);
}

describe("GET /api/groups/check-slug", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET(makeRequest("anything"));
    expect(res.status).toBe(401);
  });

  it("returns valid:false for a malformed slug", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await GET(makeRequest("Bad Slug!"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.available).toBe(false);
  });

  it("returns valid:true, available:true when the slug is unused", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const slug = `free-${Date.now()}`;
    const res = await GET(makeRequest(slug));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.available).toBe(true);
  });

  it("returns valid:true, available:false when the slug already exists", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const slug = `taken-${Date.now()}`;
    const user = await db.user.create({
      data: { email: `slug-owner-${Date.now()}@example.com` },
    });
    await db.group.create({
      data: { slug, name: "Taken", createdById: user.id },
    });
    const res = await GET(makeRequest(slug));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(true);
    expect(json.available).toBe(false);
  });

  it("returns valid:false on empty slug", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.valid).toBe(false);
  });
});
