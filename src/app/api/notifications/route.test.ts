/**
 * GET /api/notifications route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-notifications-list-test-${Date.now()}.db`);
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
const { GET } = await import("./route");

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

describe("GET /api/notifications", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("returns the user's notifications and unreadCount", async () => {
    const email = `n-${Date.now()}-${Math.random()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    await db.notification.create({
      data: {
        userId: sess.user.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "q1",
          questionTitle: "Hello",
          groupSlug: "g",
          groupName: "G",
          authorName: "A",
        }),
      },
    });

    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].payload.questionTitle).toBe("Hello");
    expect(json.unreadCount).toBe(1);
  });

  it("paginates and filters when query params are passed", async () => {
    const email = `nq-${Date.now()}-${Math.random()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    for (let i = 0; i < 4; i += 1) {
      await db.notification.create({
        data: {
          userId: sess.user.id,
          type: QUESTION_CREATED,
          payload: JSON.stringify({
            questionId: `qq${i}`,
            questionTitle: `Q${i}`,
            groupSlug: "g",
            groupName: "G",
            authorName: null,
          }),
        },
      });
      await new Promise((r) => setTimeout(r, 1));
    }
    // Add a noise notification of a different type that the filter should exclude.
    await db.notification.create({
      data: {
        userId: sess.user.id,
        type: "answer.posted",
        payload: JSON.stringify({
          questionId: "qx",
          questionTitle: "X",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
      },
    });

    const res = await GET(
      new Request("http://localhost/api/notifications?page=1&per=2&types=question"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(2);
    expect(json.total).toBe(4);
    expect(json.page).toBe(1);
    expect(json.per).toBe(2);
  });
});
