/**
 * POST /api/groups/[slug]/membership route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-membership-post-test-${Date.now()}.db`);
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
  return new Request(`http://x/api/groups/${slug}/membership`, { method: "POST" });
}

describe("POST /api/groups/[slug]/membership", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(req("anything"), ctx("anything"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when slug is unknown", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await POST(req("missing"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("creates a pending membership when autoApprove is off", async () => {
    const ownerEmail = `o-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `apply-off-${Date.now()}`;
    await createGroup({ name: "Off", slug, autoApprove: false }, ownerSess.user.id);

    const userEmail = `u-${Date.now()}-${Math.random()}@example.com`;
    cookieStore.clear();
    await auth.signIn(userEmail);

    const res = await POST(req(slug), ctx(slug));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.membership.status).toBe("pending");
    expect(json.membership.role).toBe("member");
  });

  it("creates an approved membership when autoApprove is on", async () => {
    const ownerEmail = `o2-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `apply-on-${Date.now()}`;
    await createGroup({ name: "On", slug, autoApprove: true }, ownerSess.user.id);

    const userEmail = `u2-${Date.now()}-${Math.random()}@example.com`;
    cookieStore.clear();
    await auth.signIn(userEmail);

    const res = await POST(req(slug), ctx(slug));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.membership.status).toBe("approved");
  });

  it("is idempotent for an existing approved owner applying to own group", async () => {
    const ownerEmail = `oo-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `self-${Date.now()}`;
    await createGroup({ name: "Self", slug }, ownerSess.user.id);

    const res = await POST(req(slug), ctx(slug));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.membership.status).toBe("approved");
    expect(json.membership.role).toBe("owner");
  });
});
