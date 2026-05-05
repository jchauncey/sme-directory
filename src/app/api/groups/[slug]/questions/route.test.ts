/**
 * POST + GET /api/groups/[slug]/questions route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-questions-test-${Date.now()}.db`);
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
const { GET, POST } = await import("./route");

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

function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function jsonReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/groups/[slug]/questions", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      jsonReq("http://x/api/groups/anything/questions", "POST", { title: "Hello", body: "world" }),
      ctx("anything"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid (title too short)", async () => {
    await auth.signIn(`v-${Date.now()}@example.com`);
    const res = await POST(
      jsonReq("http://x/api/groups/anything/questions", "POST", { title: "x", body: "valid" }),
      ctx("anything"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when slug is unknown", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await POST(
      jsonReq("http://x/api/groups/missing/questions", "POST", {
        title: "A long enough title",
        body: "some body",
      }),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not an approved member", async () => {
    const ownerEmail = `own-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `nope-${Date.now()}`;
    await createGroup({ name: "N", slug, autoApprove: false }, ownerSess.user.id);

    const strangerEmail = `s-${Date.now()}-${Math.random()}@example.com`;
    cookieStore.clear();
    await auth.signIn(strangerEmail);

    const res = await POST(
      jsonReq(`http://x/api/groups/${slug}/questions`, "POST", {
        title: "Long enough title",
        body: "body content",
      }),
      ctx(slug),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when user is a pending applicant", async () => {
    const ownerEmail = `own2-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `pending-${Date.now()}`;
    const group = await createGroup(
      { name: "P", slug, autoApprove: false },
      ownerSess.user.id,
    );

    const applicantEmail = `app-${Date.now()}-${Math.random()}@example.com`;
    cookieStore.clear();
    await auth.signIn(applicantEmail);
    const applicantSess = (await auth.getSession())!;
    await applyToGroup(group.id, applicantSess.user.id);

    const res = await POST(
      jsonReq(`http://x/api/groups/${slug}/questions`, "POST", {
        title: "Long enough title",
        body: "body content",
      }),
      ctx(slug),
    );
    expect(res.status).toBe(403);
  });

  it("returns 201 with the created question for an approved member", async () => {
    const ownerEmail = `own3-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `ok-${Date.now()}`;
    const group = await createGroup(
      { name: "OK", slug, autoApprove: true },
      ownerSess.user.id,
    );

    const memberEmail = `m-${Date.now()}-${Math.random()}@example.com`;
    cookieStore.clear();
    await auth.signIn(memberEmail);
    const memberSess = (await auth.getSession())!;
    await applyToGroup(group.id, memberSess.user.id); // autoApprove → approved

    const res = await POST(
      jsonReq(`http://x/api/groups/${slug}/questions`, "POST", {
        title: "How do I do X with Y?",
        body: "I need to **do** something.",
      }),
      ctx(slug),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.question.title).toBe("How do I do X with Y?");
    expect(json.question.groupId).toBe(group.id);
    expect(json.question.authorId).toBe(memberSess.user.id);

    // fan-out: owner is approved (auto-approve creates owner membership), member is the author
    const ownerNotifs = await db.notification.findMany({
      where: { userId: ownerSess.user.id },
    });
    expect(ownerNotifs).toHaveLength(1);
    expect(ownerNotifs[0]!.type).toBe("question.created");
    const payload = JSON.parse(ownerNotifs[0]!.payload);
    expect(payload.questionId).toBe(json.question.id);
    expect(payload.groupSlug).toBe(slug);

    const authorNotifs = await db.notification.findMany({
      where: { userId: memberSess.user.id },
    });
    expect(authorNotifs).toHaveLength(0);
  });
});

describe("GET /api/groups/[slug]/questions", () => {
  it("returns 404 for unknown slug", async () => {
    const res = await GET(jsonReq("http://x/api/groups/missing/questions", "GET"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with paginated newest-first list", async () => {
    const ownerEmail = `gown-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `glist-${Date.now()}`;
    const group = await createGroup(
      { name: "GL", slug, autoApprove: true },
      ownerSess.user.id,
    );
    await db.question.create({
      data: { groupId: group.id, authorId: ownerSess.user.id, title: "first", body: "b" },
    });
    await new Promise((r) => setTimeout(r, 5));
    await db.question.create({
      data: { groupId: group.id, authorId: ownerSess.user.id, title: "second", body: "b" },
    });

    cookieStore.clear(); // GET is public
    const res = await GET(
      jsonReq(`http://x/api/groups/${slug}/questions?page=1&per=10`, "GET"),
      ctx(slug),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(2);
    expect(json.items[0].title).toBe("second");
    expect(json.items[1].title).toBe("first");
    expect(json.items[0].answerCount).toBe(0);
    expect(json.items[0].voteScore).toBe(0);
  });

  it("returns 400 when pagination params are invalid", async () => {
    const res = await GET(
      jsonReq("http://x/api/groups/anything/questions?page=-1", "GET"),
      ctx("anything"),
    );
    expect(res.status).toBe(400);
  });

  it("excludes soft-deleted questions from the listing and total count", async () => {
    const ownerEmail = `gd-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `gdel-${Date.now()}`;
    const group = await createGroup(
      { name: "GDel", slug, autoApprove: true },
      ownerSess.user.id,
    );
    const visible = await db.question.create({
      data: {
        groupId: group.id,
        authorId: ownerSess.user.id,
        title: "still here",
        body: "body",
      },
    });
    const deleted = await db.question.create({
      data: {
        groupId: group.id,
        authorId: ownerSess.user.id,
        title: "tombstone",
        body: "body",
        deletedAt: new Date(),
      },
    });

    cookieStore.clear();
    const res = await GET(
      jsonReq(`http://x/api/groups/${slug}/questions?page=1&per=10`, "GET"),
      ctx(slug),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(1);
    expect(json.items.map((i: { id: string }) => i.id)).toEqual([visible.id]);
    expect(json.items.find((i: { id: string }) => i.id === deleted.id)).toBeUndefined();
  });
});
