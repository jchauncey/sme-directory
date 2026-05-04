/**
 * PATCH + DELETE /api/answers/[id] route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-answer-edit-test-${Date.now()}.db`);
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
const { PATCH, DELETE } = await import("./route");

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

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
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
};

async function setupAnswer(slug: string): Promise<Setup> {
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

  cookieStore.clear();
  const authorEmail = `a-${slug}-${Math.random()}@example.com`;
  await auth.signIn(authorEmail);
  const authorSess = (await auth.getSession())!;
  await applyToGroup(group.id, authorSess.user.id);
  const answer = await db.answer.create({
    data: {
      questionId: question.id,
      authorId: authorSess.user.id,
      body: "Initial answer body.",
    },
  });

  return {
    groupId: group.id,
    questionId: question.id,
    ownerId: ownerSess.user.id,
    authorId: authorSess.user.id,
    answerId: answer.id,
  };
}

describe("PATCH /api/answers/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await PATCH(
      jsonReq("http://x/api/answers/abc", "PATCH", { body: "new" }),
      ctx("abc"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when answer is unknown", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await PATCH(
      jsonReq("http://x/api/answers/missing", "PATCH", { body: "new" }),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when body is invalid (empty)", async () => {
    const setup = await setupAnswer(`e1-${Date.now()}`);
    // session is the author at this point
    const res = await PATCH(
      jsonReq(`http://x/api/answers/${setup.answerId}`, "PATCH", { body: "" }),
      ctx(setup.answerId),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when caller is not the author", async () => {
    const setup = await setupAnswer(`e2-${Date.now()}`);
    cookieStore.clear();
    await auth.signIn(`other-${Date.now()}-${Math.random()}@example.com`);
    const res = await PATCH(
      jsonReq(`http://x/api/answers/${setup.answerId}`, "PATCH", {
        body: "stranger edit",
      }),
      ctx(setup.answerId),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with the updated answer for the author", async () => {
    const setup = await setupAnswer(`e3-${Date.now()}`);
    const before = await db.answer.findUnique({ where: { id: setup.answerId } });
    await new Promise((r) => setTimeout(r, 5));

    const res = await PATCH(
      jsonReq(`http://x/api/answers/${setup.answerId}`, "PATCH", {
        body: "Updated answer body.",
      }),
      ctx(setup.answerId),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer.body).toBe("Updated answer body.");

    const after = await db.answer.findUnique({ where: { id: setup.answerId } });
    expect(after!.body).toBe("Updated answer body.");
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });
});

describe("DELETE /api/answers/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await DELETE(
      jsonReq("http://x/api/answers/abc", "DELETE"),
      ctx("abc"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when answer is unknown", async () => {
    await auth.signIn(`d-${Date.now()}@example.com`);
    const res = await DELETE(
      jsonReq("http://x/api/answers/missing", "DELETE"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is the answer author (not mod/owner)", async () => {
    // setupAnswer leaves session as the (plain-member) author
    const setup = await setupAnswer(`d1-${Date.now()}`);
    const res = await DELETE(
      jsonReq(`http://x/api/answers/${setup.answerId}`, "DELETE"),
      ctx(setup.answerId),
    );
    expect(res.status).toBe(403);

    const stillThere = await db.answer.findUnique({ where: { id: setup.answerId } });
    expect(stillThere).not.toBeNull();
  });

  it("returns 403 when caller is a plain approved member", async () => {
    const setup = await setupAnswer(`d2-${Date.now()}`);
    cookieStore.clear();
    await auth.signIn(`pm-${Date.now()}-${Math.random()}@example.com`);
    const session = (await auth.getSession())!;
    await applyToGroup(setup.groupId, session.user.id);

    const res = await DELETE(
      jsonReq(`http://x/api/answers/${setup.answerId}`, "DELETE"),
      ctx(setup.answerId),
    );
    expect(res.status).toBe(403);
  });

  it("returns 204 when caller is the group owner", async () => {
    const setup = await setupAnswer(`d3-${Date.now()}`);
    cookieStore.clear();
    // sign in as the owner — owner email used during setup
    const ownerUser = await db.user.findUnique({ where: { id: setup.ownerId } });
    await auth.signIn(ownerUser!.email!);

    const res = await DELETE(
      jsonReq(`http://x/api/answers/${setup.answerId}`, "DELETE"),
      ctx(setup.answerId),
    );
    expect(res.status).toBe(204);

    const gone = await db.answer.findUnique({ where: { id: setup.answerId } });
    expect(gone).toBeNull();
  });

  it("returns 204 when caller is a moderator", async () => {
    const setup = await setupAnswer(`d4-${Date.now()}`);
    cookieStore.clear();
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

    const res = await DELETE(
      jsonReq(`http://x/api/answers/${setup.answerId}`, "DELETE"),
      ctx(setup.answerId),
    );
    expect(res.status).toBe(204);

    const gone = await db.answer.findUnique({ where: { id: setup.answerId } });
    expect(gone).toBeNull();
  });
});
