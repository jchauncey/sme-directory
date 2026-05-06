/**
 * PATCH /api/me route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-me-test-${Date.now()}.db`);
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

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

const auth = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { PATCH } = await import("./route");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../../../..");
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

function jsonReq(body?: unknown): Request {
  return new Request("http://x/api/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function rawReq(body: string): Request {
  return new Request("http://x/api/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}

async function signInFresh(email: string): Promise<string> {
  cookieStore.clear();
  await auth.signIn(email);
  const sess = (await auth.getSession())!;
  return sess.user.id;
}

describe("PATCH /api/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await PATCH(jsonReq({ name: "Alice" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when JSON body is malformed", async () => {
    await signInFresh(`bad-json-${Date.now()}@example.com`);
    const res = await PATCH(rawReq("{ not json"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("ValidationError");
  });

  it("returns 400 when name is empty", async () => {
    await signInFresh(`empty-name-${Date.now()}@example.com`);
    const res = await PATCH(jsonReq({ name: "   ", bio: "hi" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(
      json.issues?.some((i: { path: string[] }) => i.path.includes("name")),
    ).toBe(true);
  });

  it("returns 400 when name is missing", async () => {
    await signInFresh(`missing-name-${Date.now()}@example.com`);
    const res = await PATCH(jsonReq({ bio: "hi" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bio exceeds 1000 chars", async () => {
    await signInFresh(`long-bio-${Date.now()}@example.com`);
    const res = await PATCH(
      jsonReq({ name: "Alice", bio: "x".repeat(1001) }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(
      json.issues?.some((i: { path: string[] }) => i.path.includes("bio")),
    ).toBe(true);
  });

  it("returns 200 and updates name + bio for the authed user", async () => {
    const userId = await signInFresh(`happy-${Date.now()}@example.com`);
    const res = await PATCH(
      jsonReq({ name: "Alice Example", bio: "Hello **world**." }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.id).toBe(userId);
    expect(json.user.name).toBe("Alice Example");
    expect(json.user.bio).toBe("Hello **world**.");

    const row = await db.user.findUnique({ where: { id: userId } });
    expect(row!.name).toBe("Alice Example");
    expect(row!.bio).toBe("Hello **world**.");
  });

  it("clears bio when omitted", async () => {
    const userId = await signInFresh(`clear-bio-${Date.now()}@example.com`);
    await db.user.update({
      where: { id: userId },
      data: { bio: "starting bio" },
    });

    const res = await PATCH(jsonReq({ name: "Bob" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.bio).toBeNull();

    const row = await db.user.findUnique({ where: { id: userId } });
    expect(row!.bio).toBeNull();
  });

  it("clears bio when empty string", async () => {
    const userId = await signInFresh(`empty-bio-${Date.now()}@example.com`);
    await db.user.update({
      where: { id: userId },
      data: { bio: "starting bio" },
    });

    const res = await PATCH(jsonReq({ name: "Bob", bio: "   " }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.bio).toBeNull();
  });

  it("trims whitespace around name and bio", async () => {
    const userId = await signInFresh(`trim-${Date.now()}@example.com`);
    const res = await PATCH(
      jsonReq({ name: "  Carol  ", bio: "  short bio  " }),
    );
    expect(res.status).toBe(200);

    const row = await db.user.findUnique({ where: { id: userId } });
    expect(row!.name).toBe("Carol");
    expect(row!.bio).toBe("short bio");
  });
});
