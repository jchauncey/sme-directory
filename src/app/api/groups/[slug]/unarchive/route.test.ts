/**
 * POST /api/groups/[slug]/unarchive route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-group-unarchive-test-${Date.now()}.db`);
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
const { archiveGroup, createGroup } = await import("@/lib/groups");
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

function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function req(slug: string): Request {
  return new Request(`http://x/api/groups/${slug}/unarchive`, { method: "POST" });
}

describe("POST /api/groups/[slug]/unarchive", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(req("anything"), ctx("anything"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown slug", async () => {
    await auth.signIn(`un-nf-${Date.now()}@example.com`);
    const res = await POST(req("missing"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when actor is not the owner", async () => {
    const ownerEmail = `un-owner-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `un-forbid-${Date.now()}`;
    await createGroup({ name: "F", slug }, ownerSess.user.id);
    await archiveGroup(slug, ownerSess.user.id);
    cookieStore.clear();
    await auth.signIn(`un-stranger-${Date.now()}@example.com`);
    const res = await POST(req(slug), ctx(slug));
    expect(res.status).toBe(403);
  });

  it("returns 409 when group is not archived", async () => {
    const ownerEmail = `un-noop-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `un-noop-${Date.now()}`;
    await createGroup({ name: "Noop", slug }, ownerSess.user.id);
    const res = await POST(req(slug), ctx(slug));
    expect(res.status).toBe(409);
  });

  it("returns 200 and clears archivedAt when actor is owner", async () => {
    const ownerEmail = `un-ok-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `un-ok-${Date.now()}`;
    await createGroup({ name: "Ok", slug }, ownerSess.user.id);
    await archiveGroup(slug, ownerSess.user.id);
    const res = await POST(req(slug), ctx(slug));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.group.archivedAt).toBeNull();
    const fresh = await db.group.findUnique({ where: { slug } });
    expect(fresh?.archivedAt).toBeNull();
  });
});
