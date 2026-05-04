/**
 * POST /api/votes route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-votes-test-${Date.now()}.db`);
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
  const root = path.resolve(import.meta.dirname, "../../../../");
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

function jsonReq(method: string, body?: unknown, raw?: string): Request {
  return new Request("http://x/api/votes", {
    method,
    headers: { "content-type": "application/json" },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
}

let counter = 0;
function uniq(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}`;
}

async function setupGroupWithQuestion(autoApprove = true) {
  const ownerEmail = `${uniq("o")}@example.com`;
  await auth.signIn(ownerEmail);
  const ownerSess = (await auth.getSession())!;
  const group = await createGroup(
    { name: uniq("G"), slug: uniq("g"), autoApprove },
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

describe("POST /api/votes", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: "any", value: 1 }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is malformed JSON", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(jsonReq("POST", undefined, "{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when value is not 1", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: "x", value: 2 }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetType is missing", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(jsonReq("POST", { targetId: "x", value: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when target id is unknown", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(
      jsonReq("POST", {
        targetType: "question",
        targetId: "does-not-exist",
        value: 1,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is the author (self-vote)", async () => {
    const { question } = await setupGroupWithQuestion();
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id, value: 1 }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is not an approved member", async () => {
    const { question } = await setupGroupWithQuestion();
    cookieStore.clear();
    await auth.signIn(`${uniq("stranger")}@example.com`);
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id, value: 1 }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with voted=true for an approved member voting on a question", async () => {
    const { group, question } = await setupGroupWithQuestion();
    cookieStore.clear();
    await auth.signIn(`${uniq("voter")}@example.com`);
    const sess = (await auth.getSession())!;
    await applyToGroup(group.id, sess.user.id);

    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id, value: 1 }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.voted).toBe(true);
    expect(json.voteScore).toBe(1);
    expect(json.targetType).toBe("question");
    expect(json.targetId).toBe(question.id);
  });

  it("returns 200 with voted=true for an answer vote", async () => {
    const { group, question, ownerSess } = await setupGroupWithQuestion();
    const answer = await db.answer.create({
      data: {
        questionId: question.id,
        authorId: ownerSess.user.id,
        body: "an answer",
      },
    });

    cookieStore.clear();
    await auth.signIn(`${uniq("av")}@example.com`);
    const sess = (await auth.getSession())!;
    await applyToGroup(group.id, sess.user.id);

    const res = await POST(
      jsonReq("POST", { targetType: "answer", targetId: answer.id, value: 1 }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.voted).toBe(true);
    expect(json.voteScore).toBe(1);
    expect(json.targetType).toBe("answer");
  });

  it("toggles off on second call and returns voted=false", async () => {
    const { group, question } = await setupGroupWithQuestion();
    cookieStore.clear();
    await auth.signIn(`${uniq("tog")}@example.com`);
    const sess = (await auth.getSession())!;
    await applyToGroup(group.id, sess.user.id);

    await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id, value: 1 }),
    );
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id, value: 1 }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.voted).toBe(false);
    expect(json.voteScore).toBe(0);
  });
});
