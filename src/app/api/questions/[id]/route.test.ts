/**
 * GET /api/questions/[id] route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-question-id-test-${Date.now()}.db`);
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
const { createGroup } = await import("@/lib/groups");
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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(id: string): Request {
  return new Request(`http://x/api/questions/${id}`, { method: "GET" });
}

describe("GET /api/questions/[id]", () => {
  it("returns 404 for unknown id", async () => {
    const res = await GET(req("does-not-exist"), ctx("does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with the question, author, and group for an existing id", async () => {
    const email = `qd-${Date.now()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    const slug = `qd-${Date.now()}`;
    const group = await createGroup(
      { name: "QD", slug, autoApprove: true },
      sess.user.id,
    );
    const q = await db.question.create({
      data: {
        groupId: group.id,
        authorId: sess.user.id,
        title: "What is x?",
        body: "Body content",
      },
    });

    cookieStore.clear(); // public endpoint
    const res = await GET(req(q.id), ctx(q.id));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.question.id).toBe(q.id);
    expect(json.question.title).toBe("What is x?");
    expect(json.question.author.email).toBe(email);
    expect(json.question.group.slug).toBe(slug);
    expect(json.question.answers).toEqual([]);
  });
});
