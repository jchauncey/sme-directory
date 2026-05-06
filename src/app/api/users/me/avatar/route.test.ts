/**
 * POST + DELETE /api/users/me/avatar route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-user-avatar-test-${Date.now()}.db`);
const testStorageDir = path.join(os.tmpdir(), `sme-uploads-user-${Date.now()}`);
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
const { resetStorageForTests } = await import("@/lib/storage");
const { POST, DELETE } = await import("./route");

// 1x1 transparent PNG (real, decodes successfully).
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

function uploadReq(file: File | null): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://x/api/users/me/avatar", { method: "POST", body: form });
}

function fileFrom(bytes: Buffer, mime: string, name = "avatar"): File {
  return new File([new Uint8Array(bytes)], name, { type: mime });
}

describe("POST /api/users/me/avatar", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(uploadReq(fileFrom(PNG_BYTES, "image/png")));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file is provided", async () => {
    await auth.signIn(`noform-${Date.now()}@example.com`);
    const res = await POST(uploadReq(null));
    expect(res.status).toBe(400);
  });

  it("returns 400 for disallowed mime type", async () => {
    await auth.signIn(`mime-${Date.now()}@example.com`);
    const res = await POST(uploadReq(fileFrom(PNG_BYTES, "image/gif")));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("InvalidImage");
  });

  it("returns 413 for oversized file", async () => {
    await auth.signIn(`big-${Date.now()}@example.com`);
    const big = Buffer.alloc(2 * 1024 * 1024 + 1);
    const res = await POST(uploadReq(fileFrom(big, "image/png")));
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toBe("ImageTooLarge");
  });

  it("returns 200 and persists image on happy path", async () => {
    const email = `ok-${Date.now()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    const res = await POST(uploadReq(fileFrom(PNG_BYTES, "image/png")));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.image).toMatch(/^\/uploads\/avatars\/users\/.+\.png$/);
    const user = await db.user.findUnique({ where: { id: sess.user.id } });
    expect(user?.image).toBe(json.image);
    // file actually written
    const relativePath = json.image.replace(/^\/uploads\//, "");
    expect(fs.existsSync(path.join(testStorageDir, relativePath))).toBe(true);
  });
});

describe("DELETE /api/users/me/avatar", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("clears the user's image", async () => {
    const email = `clr-${Date.now()}@example.com`;
    await auth.signIn(email);
    const sess = (await auth.getSession())!;
    await db.user.update({ where: { id: sess.user.id }, data: { image: "/something" } });
    const res = await DELETE();
    expect(res.status).toBe(200);
    const user = await db.user.findUnique({ where: { id: sess.user.id } });
    expect(user?.image).toBeNull();
  });
});
