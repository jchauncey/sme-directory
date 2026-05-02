/**
 * POST /api/notifications/[id]/read route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-notifications-read-test-${Date.now()}.db`);
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
const { QUESTION_CREATED } = await import("@/lib/notifications");
const { POST } = await import("./route");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../../../../../..");
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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const SAMPLE_PAYLOAD = JSON.stringify({
  questionId: "q",
  questionTitle: "T",
  groupSlug: "g",
  groupName: "G",
  authorName: null,
});

describe("POST /api/notifications/[id]/read", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(new Request("http://x", { method: "POST" }), ctx("any"));
    expect(res.status).toBe(401);
  });

  it("marks the notification read for the owner", async () => {
    const email = `r-${Date.now()}-${Math.random()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    const n = await db.notification.create({
      data: {
        userId: sess.user.id,
        type: QUESTION_CREATED,
        payload: SAMPLE_PAYLOAD,
      },
    });

    const res = await POST(new Request("http://x", { method: "POST" }), ctx(n.id));
    expect(res.status).toBe(200);
    const after = await db.notification.findUnique({ where: { id: n.id } });
    expect(after?.readAt).not.toBeNull();
  });

  it("returns 404 when the notification belongs to another user", async () => {
    const ownerEmail = `o-${Date.now()}-${Math.random()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const n = await db.notification.create({
      data: {
        userId: ownerSess.user.id,
        type: QUESTION_CREATED,
        payload: SAMPLE_PAYLOAD,
      },
    });

    const intruderEmail = `i-${Date.now()}-${Math.random()}@example.com`;
    cookieStore.clear();
    await auth.signIn(intruderEmail);

    const res = await POST(new Request("http://x", { method: "POST" }), ctx(n.id));
    expect(res.status).toBe(404);
    const after = await db.notification.findUnique({ where: { id: n.id } });
    expect(after?.readAt).toBeNull();
  });

  it("returns 404 for an unknown id", async () => {
    const email = `u-${Date.now()}-${Math.random()}@example.com`;
    await auth.signIn(email);
    const res = await POST(new Request("http://x", { method: "POST" }), ctx("missing"));
    expect(res.status).toBe(404);
  });
});
