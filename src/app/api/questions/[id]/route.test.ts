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
const { applyToGroup } = await import("@/lib/memberships");
const { GET, DELETE } = await import("./route");

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

function delReq(id: string): Request {
  return new Request(`http://x/api/questions/${id}`, { method: "DELETE" });
}

type DeleteSetup = {
  groupId: string;
  questionId: string;
  ownerId: string;
  authorId: string;
};

async function setupForDelete(slug: string): Promise<DeleteSetup> {
  cookieStore.clear();
  const ownerEmail = `del-o-${slug}@example.com`;
  await auth.signIn(ownerEmail);
  const ownerSess = (await auth.getSession())!;
  const group = await createGroup(
    { name: slug, slug, autoApprove: true },
    ownerSess.user.id,
  );

  cookieStore.clear();
  const authorEmail = `del-a-${slug}@example.com`;
  await auth.signIn(authorEmail);
  const authorSess = (await auth.getSession())!;
  await applyToGroup(group.id, authorSess.user.id);
  const question = await db.question.create({
    data: {
      groupId: group.id,
      authorId: authorSess.user.id,
      title: "To be deleted",
      body: "Delete me.",
    },
  });

  cookieStore.clear();
  return {
    groupId: group.id,
    questionId: question.id,
    ownerId: ownerSess.user.id,
    authorId: authorSess.user.id,
  };
}

async function signInAs(userId: string): Promise<void> {
  cookieStore.clear();
  const u = await db.user.findUnique({ where: { id: userId } });
  await auth.signIn(u!.email!);
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

  it("returns 200 with deletedAt populated for a soft-deleted question (tombstone)", async () => {
    const setup = await setupForDelete(`gd-${Date.now()}`);
    await db.question.update({
      where: { id: setup.questionId },
      data: { deletedAt: new Date() },
    });

    cookieStore.clear();
    const res = await GET(req(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.question.id).toBe(setup.questionId);
    expect(json.question.deletedAt).not.toBeNull();
    expect(json.question.answers).toEqual([]);
  });
});

describe("DELETE /api/questions/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const setup = await setupForDelete(`d1-${Date.now()}`);
    cookieStore.clear();
    const res = await DELETE(delReq(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the question does not exist", async () => {
    await auth.signIn(`d-missing-${Date.now()}@example.com`);
    const res = await DELETE(delReq("nope"), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 200 and sets deletedAt when caller is the author", async () => {
    const setup = await setupForDelete(`d2-${Date.now()}`);
    await signInAs(setup.authorId);

    const res = await DELETE(delReq(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(200);
    const after = await db.question.findUnique({
      where: { id: setup.questionId },
    });
    expect(after!.deletedAt).not.toBeNull();
  });

  it("returns 200 when caller is the group owner", async () => {
    const setup = await setupForDelete(`d3-${Date.now()}`);
    await signInAs(setup.ownerId);

    const res = await DELETE(delReq(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(200);
    const after = await db.question.findUnique({
      where: { id: setup.questionId },
    });
    expect(after!.deletedAt).not.toBeNull();
  });

  it("returns 200 when caller is a group moderator", async () => {
    const setup = await setupForDelete(`d4-${Date.now()}`);
    cookieStore.clear();
    await auth.signIn(`mod-${Date.now()}@example.com`);
    const modSess = (await auth.getSession())!;
    await db.membership.create({
      data: {
        groupId: setup.groupId,
        userId: modSess.user.id,
        role: "moderator",
        status: "approved",
      },
    });

    const res = await DELETE(delReq(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(200);
  });

  it("returns 403 when caller is a plain approved member", async () => {
    const setup = await setupForDelete(`d5-${Date.now()}`);
    cookieStore.clear();
    await auth.signIn(`pm-${Date.now()}@example.com`);
    const pmSess = (await auth.getSession())!;
    await applyToGroup(setup.groupId, pmSess.user.id);

    const res = await DELETE(delReq(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(403);
    const after = await db.question.findUnique({
      where: { id: setup.questionId },
    });
    expect(after!.deletedAt).toBeNull();
  });

  it("returns 403 when caller is not a member of the group", async () => {
    const setup = await setupForDelete(`d6-${Date.now()}`);
    cookieStore.clear();
    await auth.signIn(`stranger-${Date.now()}@example.com`);

    const res = await DELETE(delReq(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(403);
  });

  it("returns 404 when the question is already deleted (idempotent failure)", async () => {
    const setup = await setupForDelete(`d7-${Date.now()}`);
    await db.question.update({
      where: { id: setup.questionId },
      data: { deletedAt: new Date() },
    });
    await signInAs(setup.authorId);

    const res = await DELETE(delReq(setup.questionId), ctx(setup.questionId));
    expect(res.status).toBe(404);
  });
});
