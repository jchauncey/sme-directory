/**
 * POST + DELETE /api/groups/[slug]/avatar route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-group-avatar-test-${Date.now()}.db`);
const testStorageDir = path.join(os.tmpdir(), `sme-uploads-group-${Date.now()}`);
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.AUTH_SECRET = "0".repeat(32) + "abcdef0123456789abcdef0123456789";
process.env.STORAGE_PROVIDER = "local";
process.env.AVATAR_LOCAL_DIR = testStorageDir;

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
const { createGroup, archiveGroup } = await import("@/lib/groups");
const { resetStorageForTests } = await import("@/lib/storage");
const { POST, DELETE } = await import("./route");

const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000100" +
    "0d0a2db40000000049454e44ae426082",
  "hex",
);

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../../../../../..");
  execSync("node_modules/.bin/prisma migrate deploy", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "pipe",
  });
  await db.$connect();
  fs.mkdirSync(testStorageDir, { recursive: true });
  resetStorageForTests();
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
  try {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

beforeEach(() => {
  cookieStore.clear();
});

function ctx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function uploadReq(slug: string, file: File | null): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request(`http://x/api/groups/${slug}/avatar`, { method: "POST", body: form });
}

function fileFrom(bytes: Buffer, mime: string, name = "avatar"): File {
  return new File([new Uint8Array(bytes)], name, { type: mime });
}

describe("POST /api/groups/[slug]/avatar", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(uploadReq("any", fileFrom(PNG_BYTES, "image/png")), ctx("any"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown slug", async () => {
    await auth.signIn(`nf-${Date.now()}@example.com`);
    const res = await POST(uploadReq("missing", fileFrom(PNG_BYTES, "image/png")), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when actor is not the owner", async () => {
    const ownerEmail = `owner-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `forbid-${Date.now()}`;
    await createGroup({ name: "F", slug }, ownerSess.user.id);
    cookieStore.clear();
    await auth.signIn(`stranger-${Date.now()}@example.com`);
    const res = await POST(uploadReq(slug, fileFrom(PNG_BYTES, "image/png")), ctx(slug));
    expect(res.status).toBe(403);
  });

  it("returns 400 for disallowed mime type", async () => {
    const ownerEmail = `mime-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `mime-${Date.now()}`;
    await createGroup({ name: "M", slug }, ownerSess.user.id);
    const res = await POST(uploadReq(slug, fileFrom(PNG_BYTES, "image/gif")), ctx(slug));
    expect(res.status).toBe(400);
  });

  it("returns 413 for oversized file", async () => {
    const ownerEmail = `big-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `big-${Date.now()}`;
    await createGroup({ name: "B", slug }, ownerSess.user.id);
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    const res = await POST(uploadReq(slug, fileFrom(big, "image/png")), ctx(slug));
    expect(res.status).toBe(413);
  });

  it("returns 200 and persists image when actor is owner", async () => {
    const ownerEmail = `ok-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `ok-${Date.now()}`;
    const group = await createGroup({ name: "OK", slug }, ownerSess.user.id);
    const res = await POST(uploadReq(slug, fileFrom(PNG_BYTES, "image/png")), ctx(slug));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.image).toMatch(/^\/uploads\/avatars\/groups\/.+\.png$/);
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.image).toBe(json.image);
  });

  it("returns 409 when the group is archived", async () => {
    const ownerEmail = `arc-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `arc-${Date.now()}`;
    await createGroup({ name: "A", slug }, ownerSess.user.id);
    await archiveGroup(slug, ownerSess.user.id);
    const res = await POST(uploadReq(slug, fileFrom(PNG_BYTES, "image/png")), ctx(slug));
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/groups/[slug]/avatar", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await DELETE(
      new Request("http://x/api/groups/x/avatar", { method: "DELETE" }),
      ctx("x"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when actor is not the owner", async () => {
    const ownerEmail = `downer-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `del-forbid-${Date.now()}`;
    await createGroup({ name: "D", slug }, ownerSess.user.id);
    cookieStore.clear();
    await auth.signIn(`del-stranger-${Date.now()}@example.com`);
    const res = await DELETE(
      new Request(`http://x/api/groups/${slug}/avatar`, { method: "DELETE" }),
      ctx(slug),
    );
    expect(res.status).toBe(403);
  });

  it("clears the group's image when actor is owner", async () => {
    const ownerEmail = `dok-${Date.now()}@example.com`;
    await auth.signIn(ownerEmail);
    const ownerSess = (await auth.getSession())!;
    const slug = `del-ok-${Date.now()}`;
    const group = await createGroup({ name: "D", slug }, ownerSess.user.id);
    await db.group.update({ where: { id: group.id }, data: { image: "/something" } });
    const res = await DELETE(
      new Request(`http://x/api/groups/${slug}/avatar`, { method: "DELETE" }),
      ctx(slug),
    );
    expect(res.status).toBe(200);
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.image).toBeNull();
  });
});
