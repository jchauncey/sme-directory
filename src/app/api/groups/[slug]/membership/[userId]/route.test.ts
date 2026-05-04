/**
 * PATCH + DELETE /api/groups/[slug]/membership/[userId] route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-membership-id-test-${Date.now()}.db`);
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
  const root = path.resolve(import.meta.dirname, "../../../../../../..");
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

function ctx(slug: string, userId: string) {
  return { params: Promise.resolve({ slug, userId }) };
}

function patchReq(slug: string, userId: string, body: unknown): Request {
  return new Request(`http://x/api/groups/${slug}/membership/${userId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq(slug: string, userId: string): Request {
  return new Request(`http://x/api/groups/${slug}/membership/${userId}`, {
    method: "DELETE",
  });
}

async function setupGroupWithApplicant(label: string, autoApprove = false) {
  const ownerEmail = `owner-${label}-${Date.now()}@example.com`;
  await auth.signIn(ownerEmail);
  const ownerSess = (await auth.getSession())!;
  const slug = `${label}-${Date.now()}`;
  await createGroup({ name: label, slug, autoApprove }, ownerSess.user.id);

  const applicant = await db.user.create({
    data: { email: `applicant-${label}-${Date.now()}@example.com` },
  });
  const group = await db.group.findUnique({ where: { slug } });
  await applyToGroup(group!.id, applicant.id);
  return { slug, ownerId: ownerSess.user.id, ownerEmail, applicantId: applicant.id };
}

describe("PATCH /api/groups/[slug]/membership/[userId]", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await PATCH(
      patchReq("anything", "user-id", { status: "approved" }),
      ctx("anything", "user-id"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when status is invalid", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await PATCH(
      patchReq("anything", "uid", { status: "weird" }),
      ctx("anything", "uid"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 InvalidJson on garbage body", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const r = new Request("http://x/api/groups/anything/membership/uid", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await PATCH(r, ctx("anything", "uid"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("InvalidJson");
  });

  it("returns 404 when group is missing", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await PATCH(
      patchReq("missing", "uid", { status: "approved" }),
      ctx("missing", "uid"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when actor is not owner/moderator", async () => {
    const setup = await setupGroupWithApplicant("forbid");
    cookieStore.clear();
    await auth.signIn(`stranger-${Date.now()}@example.com`);
    const res = await PATCH(
      patchReq(setup.slug, setup.applicantId, { status: "approved" }),
      ctx(setup.slug, setup.applicantId),
    );
    expect(res.status).toBe(403);
  });

  it("owner can approve a pending applicant", async () => {
    const setup = await setupGroupWithApplicant("approve");
    cookieStore.clear();
    await auth.signIn(setup.ownerEmail);
    const res = await PATCH(
      patchReq(setup.slug, setup.applicantId, { status: "approved" }),
      ctx(setup.slug, setup.applicantId),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.membership.status).toBe("approved");
  });

  it("returns 404 when target membership does not exist", async () => {
    const ownerEmail = `o-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `nf-${Date.now()}`;
    await createGroup({ name: "NF", slug }, ownerSess.user.id);

    const ghost = await db.user.create({ data: { email: `ghost-${Date.now()}@example.com` } });
    const res = await PATCH(patchReq(slug, ghost.id, { status: "approved" }), ctx(slug, ghost.id));
    expect(res.status).toBe(404);
  });

  it("returns 403 when targeting the owner's own membership", async () => {
    const ownerEmail = `o-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `self-${Date.now()}`;
    await createGroup({ name: "Self", slug }, ownerSess.user.id);
    const res = await PATCH(
      patchReq(slug, ownerSess.user.id, { status: "rejected" }),
      ctx(slug, ownerSess.user.id),
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/groups/[slug]/membership/[userId]", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await DELETE(deleteReq("anything", "uid"), ctx("anything", "uid"));
    expect(res.status).toBe(401);
  });

  it("approved member can leave themselves", async () => {
    const setup = await setupGroupWithApplicant("leave", true); // autoApprove → approved member
    cookieStore.clear();
    await auth.signIn((await db.user.findUnique({ where: { id: setup.applicantId } }))!.email!);
    const res = await DELETE(
      deleteReq(setup.slug, setup.applicantId),
      ctx(setup.slug, setup.applicantId),
    );
    expect(res.status).toBe(200);
    const m = await db.membership.findUnique({
      where: {
        userId_groupId: {
          userId: setup.applicantId,
          groupId: (await db.group.findUnique({ where: { slug: setup.slug } }))!.id,
        },
      },
    });
    expect(m).toBeNull();
  });

  it("owner cannot leave their own group (409)", async () => {
    const ownerEmail = `o-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `oleave-${Date.now()}`;
    await createGroup({ name: "OL", slug }, ownerSess.user.id);
    const res = await DELETE(deleteReq(slug, ownerSess.user.id), ctx(slug, ownerSess.user.id));
    expect(res.status).toBe(409);
  });

  it("owner can remove a pending applicant", async () => {
    const setup = await setupGroupWithApplicant("kick");
    cookieStore.clear();
    await auth.signIn(setup.ownerEmail);
    const res = await DELETE(
      deleteReq(setup.slug, setup.applicantId),
      ctx(setup.slug, setup.applicantId),
    );
    expect(res.status).toBe(200);
  });

  it("non-owner cannot remove another user (403)", async () => {
    const setup = await setupGroupWithApplicant("nokick");
    cookieStore.clear();
    await auth.signIn(`stranger-${Date.now()}@example.com`);
    const res = await DELETE(
      deleteReq(setup.slug, setup.applicantId),
      ctx(setup.slug, setup.applicantId),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when target membership does not exist", async () => {
    const ownerEmail = `o-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `dnf-${Date.now()}`;
    await createGroup({ name: "DNF", slug }, ownerSess.user.id);
    const ghost = await db.user.create({
      data: { email: `dghost-${Date.now()}@example.com` },
    });
    const res = await DELETE(deleteReq(slug, ghost.id), ctx(slug, ghost.id));
    expect(res.status).toBe(404);
  });
});
