/**
 * POST /api/notifications/read-all route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-notifications-readall-test-${Date.now()}.db`);
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

const SAMPLE_PAYLOAD = JSON.stringify({
  questionId: "q",
  questionTitle: "T",
  groupSlug: "g",
  groupName: "G",
  authorName: null,
});

describe("POST /api/notifications/read-all", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("marks all unread notifications for the user", async () => {
    const email = `ra-${Date.now()}-${Math.random()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    for (let i = 0; i < 3; i += 1) {
      await db.notification.create({
        data: {
          userId: sess.user.id,
          type: QUESTION_CREATED,
          payload: SAMPLE_PAYLOAD,
        },
      });
    }
    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.updatedCount).toBe(3);
    expect(
      await db.notification.count({
        where: { userId: sess.user.id, readAt: null },
      }),
    ).toBe(0);
  });
});
