/**
 * POST /api/questions/[id]/accept route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-accept-test-${Date.now()}.db`);
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

function jsonReq(url: string, body?: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type Setup = {
  groupId: string;
  questionId: string;
  ownerId: string;
  authorId: string;
  answerId: string;
  answerAuthorId: string;
};

async function setupQuestion(slug: string): Promise<Setup> {
  const ownerEmail = `o-${slug}@example.com`;
  await auth.signIn(ownerEmail);
  const ownerSess = (await auth.getSession())!;
  const group = await createGroup(
    { name: slug, slug, autoApprove: true },
    ownerSess.user.id,
  );

  cookieStore.clear();
  const authorEmail = `a-${slug}-${Math.random()}@example.com`;
  await auth.signIn(authorEmail);
  const authorSess = (await auth.getSession())!;
  await applyToGroup(group.id, authorSess.user.id);
  const question = await db.question.create({
    data: {
      groupId: group.id,
      authorId: authorSess.user.id,
      title: "Seed question for accept tests",
      body: "Seed body",
    },
  });

  cookieStore.clear();
  const ansAuthorEmail = `aa-${slug}-${Math.random()}@example.com`;
  await auth.signIn(ansAuthorEmail);
  const ansSess = (await auth.getSession())!;
  await applyToGroup(group.id, ansSess.user.id);
  const answer = await db.answer.create({
    data: {
      questionId: question.id,
      authorId: ansSess.user.id,
      body: "Seed answer body.",
    },
  });

  cookieStore.clear();
  return {
    groupId: group.id,
    questionId: question.id,
    ownerId: ownerSess.user.id,
    authorId: authorSess.user.id,
    answerId: answer.id,
    answerAuthorId: ansSess.user.id,
  };
}

async function signInAs(userId: string): Promise<void> {
  cookieStore.clear();
  const u = await db.user.findUnique({ where: { id: userId } });
  await auth.signIn(u!.email!);
}

describe("POST /api/questions/[id]/accept", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(jsonReq("http://x/api/questions/abc/accept"), ctx("abc"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when question is unknown", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await POST(
      jsonReq("http://x/api/questions/missing/accept"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is a plain approved member", async () => {
    const setup = await setupQuestion(`acc1-${Date.now()}`);
    await auth.signIn(`pm-${Date.now()}-${Math.random()}@example.com`);
    const session = (await auth.getSession())!;
    await applyToGroup(setup.groupId, session.user.id);

    const res = await POST(
      jsonReq(`http://x/api/questions/${setup.questionId}/accept`),
      ctx(setup.questionId),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is not a member of the group", async () => {
    const setup = await setupQuestion(`acc2-${Date.now()}`);
    await auth.signIn(`stranger-${Date.now()}-${Math.random()}@example.com`);

    const res = await POST(
      jsonReq(`http://x/api/questions/${setup.questionId}/accept`),
      ctx(setup.questionId),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 and flips status when caller is the question author (no answerId)", async () => {
    const setup = await setupQuestion(`acc3-${Date.now()}`);
    await signInAs(setup.authorId);

    const res = await POST(
      jsonReq(`http://x/api/questions/${setup.questionId}/accept`),
      ctx(setup.questionId),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.question.status).toBe("answered");
    expect(json.question.acceptedAnswerId).toBeNull();

    const after = await db.question.findUnique({ where: { id: setup.questionId } });
    expect(after!.status).toBe("answered");
    expect(after!.acceptedAnswerId).toBeNull();
  });

  it("returns 200 and pins acceptedAnswerId when caller is the author and provides answerId", async () => {
    const setup = await setupQuestion(`acc4-${Date.now()}`);
    await signInAs(setup.authorId);

    const res = await POST(
      jsonReq(`http://x/api/questions/${setup.questionId}/accept`, {
        answerId: setup.answerId,
      }),
      ctx(setup.questionId),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.question.status).toBe("answered");
    expect(json.question.acceptedAnswerId).toBe(setup.answerId);

    const after = await db.question.findUnique({ where: { id: setup.questionId } });
    expect(after!.acceptedAnswerId).toBe(setup.answerId);
  });

  it("returns 200 when caller is the group owner", async () => {
    const setup = await setupQuestion(`acc5-${Date.now()}`);
    await signInAs(setup.ownerId);

    const res = await POST(
      jsonReq(`http://x/api/questions/${setup.questionId}/accept`, {
        answerId: setup.answerId,
      }),
      ctx(setup.questionId),
    );
    expect(res.status).toBe(200);
  });

  it("returns 200 when caller is a moderator", async () => {
    const setup = await setupQuestion(`acc6-${Date.now()}`);
    await auth.signIn(`mod-${Date.now()}-${Math.random()}@example.com`);
    const modSess = (await auth.getSession())!;
    await db.membership.create({
      data: {
        groupId: setup.groupId,
        userId: modSess.user.id,
        role: "moderator",
        status: "approved",
      },
    });

    const res = await POST(
      jsonReq(`http://x/api/questions/${setup.questionId}/accept`),
      ctx(setup.questionId),
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when answerId belongs to a different question", async () => {
    const a = await setupQuestion(`acc7a-${Date.now()}`);
    const b = await setupQuestion(`acc7b-${Date.now()}`);
    await signInAs(a.authorId);

    const res = await POST(
      jsonReq(`http://x/api/questions/${a.questionId}/accept`, {
        answerId: b.answerId,
      }),
      ctx(a.questionId),
    );
    expect(res.status).toBe(404);

    const after = await db.question.findUnique({ where: { id: a.questionId } });
    expect(after!.status).toBe("open");
    expect(after!.acceptedAnswerId).toBeNull();
  });
});
