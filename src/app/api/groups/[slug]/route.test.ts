/**
 * GET + PATCH /api/groups/[slug] route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-group-slug-test-${Date.now()}.db`);
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
const { GET, PATCH } = await import("./route");

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

describe("GET /api/groups/[slug]", () => {
  it("returns 404 for unknown slug", async () => {
    const res = await GET(jsonReq("http://x/api/groups/missing", "GET"), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with group + owner for an existing slug", async () => {
    const email = `getter-${Date.now()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    const slug = `get-${Date.now()}`;
    await createGroup({ name: "Get Me", slug, description: "hi" }, sess.user.id);
    cookieStore.clear(); // GET is public — confirm no cookie needed
    const res = await GET(jsonReq(`http://x/api/groups/${slug}`, "GET"), ctx(slug));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.group.slug).toBe(slug);
    expect(json.group.description).toBe("hi");
    expect(json.owner.email).toBe(email);
  });
});

describe("PATCH /api/groups/[slug]", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await PATCH(
      jsonReq("http://x/api/groups/anything", "PATCH", { name: "New Name" }),
      ctx("anything"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on empty body (no fields provided)", async () => {
    await auth.signIn(`empty-${Date.now()}@example.com`);
    const res = await PATCH(
      jsonReq("http://x/api/groups/whatever", "PATCH", {}),
      ctx("whatever"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when slug doesn't exist", async () => {
    await auth.signIn(`nf-${Date.now()}@example.com`);
    const res = await PATCH(
      jsonReq("http://x/api/groups/missing", "PATCH", { name: "New Name" }),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when actor is not owner", async () => {
    const ownerEmail = `owner-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `forbid-${Date.now()}`;
    await createGroup({ name: "F", slug }, ownerSess.user.id);
    cookieStore.clear();
    await auth.signIn(`stranger-${Date.now()}@example.com`);
    const res = await PATCH(
      jsonReq(`http://x/api/groups/${slug}`, "PATCH", { name: "Hacked Name" }),
      ctx(slug),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 and updates fields when actor is owner", async () => {
    const ownerEmail = `ok-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `update-${Date.now()}`;
    await createGroup({ name: "Old", slug, description: "old", autoApprove: false }, ownerSess.user.id);
    const res = await PATCH(
      jsonReq(`http://x/api/groups/${slug}`, "PATCH", {
        description: "new",
        autoApprove: true,
      }),
      ctx(slug),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.group.description).toBe("new");
    expect(json.group.autoApprove).toBe(true);
    expect(json.group.name).toBe("Old");
  });

  it("clears description when null is passed", async () => {
    const ownerEmail = `clr-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `clr-${Date.now()}`;
    await createGroup({ name: "C", slug, description: "to clear" }, ownerSess.user.id);
    const res = await PATCH(
      jsonReq(`http://x/api/groups/${slug}`, "PATCH", { description: null }),
      ctx(slug),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.group.description).toBeNull();
  });
});
