/**
 * POST /api/questions/[id]/answers route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-answers-test-${Date.now()}.db`);
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
const { applyToGroup } = await import("@/lib/memberships");
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

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function createGroupWithApprovedAuthor(slug: string) {
  const ownerEmail = `o-${slug}@example.com`;
  await auth.signIn(ownerEmail);
  const ownerSess = (await auth.getSession())!;
  const group = await createGroup(
    { name: slug, slug, autoApprove: true },
    ownerSess.user.id,
  );
  const question = await db.question.create({
    data: {
      groupId: group.id,
      authorId: ownerSess.user.id,
      title: "Seed question for tests",
      body: "Seed body",
    },
  });
  return { group, question, ownerSess };
}

describe("POST /api/questions/[id]/answers", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      jsonReq("http://x/api/questions/abc/answers", "POST", { body: "hi" }),
      ctx("abc"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid (empty)", async () => {
    await auth.signIn(`v-${Date.now()}@example.com`);
    const res = await POST(
      jsonReq("http://x/api/questions/abc/answers", "POST", { body: "" }),
      ctx("abc"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is too long", async () => {
    await auth.signIn(`vlong-${Date.now()}@example.com`);
    const res = await POST(
      jsonReq("http://x/api/questions/abc/answers", "POST", {
        body: "a".repeat(20_001),
      }),
      ctx("abc"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when the question id is unknown", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await POST(
      jsonReq("http://x/api/questions/missing/answers", "POST", { body: "ok" }),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is not a group member", async () => {
    const slug = `nope-${Date.now()}`;
    const { question } = await createGroupWithApprovedAuthor(slug);

    cookieStore.clear();
    await auth.signIn(`s-${Date.now()}-${Math.random()}@example.com`);

    const res = await POST(
      jsonReq(`http://x/api/questions/${question.id}/answers`, "POST", {
        body: "i am a stranger",
      }),
      ctx(question.id),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is a pending applicant", async () => {
    const ownerEmail = `own2-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `pending-${Date.now()}`;
    const group = await createGroup(
      { name: "P", slug, autoApprove: false },
      ownerSess.user.id,
    );
    const question = await db.question.create({
      data: {
        groupId: group.id,
        authorId: ownerSess.user.id,
        title: "Seeded title here",
        body: "Seed",
      },
    });

    cookieStore.clear();
    await auth.signIn(`app-${Date.now()}-${Math.random()}@example.com`);
    const applicantSess = (await auth.getSession())!;
    await applyToGroup(group.id, applicantSess.user.id);

    const res = await POST(
      jsonReq(`http://x/api/questions/${question.id}/answers`, "POST", {
        body: "pending answer",
      }),
      ctx(question.id),
    );
    expect(res.status).toBe(403);
  });

  it("returns 201 with the created answer for an approved member", async () => {
    const slug = `ok-${Date.now()}`;
    const { group, question } = await createGroupWithApprovedAuthor(slug);

    cookieStore.clear();
    const memberEmail = `m-${Date.now()}-${Math.random()}@example.com`;
    await auth.signIn(memberEmail);
    const memberSess = (await auth.getSession())!;
    await applyToGroup(group.id, memberSess.user.id);

    const res = await POST(
      jsonReq(`http://x/api/questions/${question.id}/answers`, "POST", {
        body: "Here is my **answer** with markdown.",
      }),
      ctx(question.id),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.answer.body).toBe("Here is my **answer** with markdown.");
    expect(json.answer.questionId).toBe(question.id);
    expect(json.answer.authorId).toBe(memberSess.user.id);

    const stored = await db.answer.findUnique({ where: { id: json.answer.id } });
    expect(stored).not.toBeNull();
    expect(stored!.body).toBe("Here is my **answer** with markdown.");
  });
});
