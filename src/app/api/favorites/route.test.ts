/**
 * POST /api/favorites route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-favorites-test-${Date.now()}.db`);
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
  revalidatePath: () => undefined,
}));

const auth = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { createGroup } = await import("@/lib/groups");
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
  return new Request("http://x/api/favorites", {
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

async function setupGroupWithQuestion() {
  const ownerEmail = `${uniq("o")}@example.com`;
  await auth.signIn(ownerEmail);
  const ownerSess = (await auth.getSession())!;
  const group = await createGroup(
    { name: uniq("G"), slug: uniq("g"), autoApprove: true },
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

describe("POST /api/favorites", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: "any" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is malformed JSON", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(jsonReq("POST", undefined, "{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetType is missing", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(jsonReq("POST", { targetId: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetType is invalid", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(
      jsonReq("POST", { targetType: "comment", targetId: "x" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when target id is unknown", async () => {
    await auth.signIn(`${uniq("u")}@example.com`);
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: "does-not-exist" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 with favorited=true on first call", async () => {
    const { question } = await setupGroupWithQuestion();
    cookieStore.clear();
    await auth.signIn(`${uniq("fav")}@example.com`);

    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.favorited).toBe(true);
    expect(json.targetType).toBe("question");
    expect(json.targetId).toBe(question.id);
  });

  it("returns 200 with favorited=false on second call (toggle off)", async () => {
    const { question } = await setupGroupWithQuestion();
    cookieStore.clear();
    await auth.signIn(`${uniq("tog")}@example.com`);

    await POST(jsonReq("POST", { targetType: "question", targetId: question.id }));
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.favorited).toBe(false);
  });

  it("allows the author to favorite their own question (no self-restriction)", async () => {
    const { question } = await setupGroupWithQuestion();
    // ownerSess is still signed in via cookieStore — author is the caller.
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.favorited).toBe(true);
  });

  it("allows non-members of the group to favorite", async () => {
    const { question } = await setupGroupWithQuestion();
    cookieStore.clear();
    await auth.signIn(`${uniq("nonmember")}@example.com`);
    const res = await POST(
      jsonReq("POST", { targetType: "question", targetId: question.id }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.favorited).toBe(true);
  });

  it("returns 200 with favorited=true for an answer", async () => {
    const { question, ownerSess } = await setupGroupWithQuestion();
    const answer = await db.answer.create({
      data: {
        questionId: question.id,
        authorId: ownerSess.user.id,
        body: "an answer",
      },
    });

    cookieStore.clear();
    await auth.signIn(`${uniq("af")}@example.com`);
    const res = await POST(
      jsonReq("POST", { targetType: "answer", targetId: answer.id }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.favorited).toBe(true);
    expect(json.targetType).toBe("answer");
  });
});
