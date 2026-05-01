/**
 * Memberships authorization-helper tests.
 *
 * Mirrors the real-DB pattern in db.test.ts: a throw-away SQLite file
 * initialised by `prisma migrate deploy` in beforeAll.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-memberships-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { assertOwner, getMembership, isOwner, AuthorizationError } = await import(
  "./memberships"
);

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../..");
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

async function makeGroup(slugSuffix: string) {
  const owner = await db.user.create({
    data: { email: `owner-${slugSuffix}@example.com`, name: "Owner" },
  });
  const group = await db.group.create({
    data: { slug: `g-${slugSuffix}`, name: "G", createdById: owner.id },
  });
  return { owner, group };
}

describe("memberships helpers", () => {
  it("getMembership returns null when no row exists", async () => {
    const { owner, group } = await makeGroup(`none-${Date.now()}`);
    expect(await getMembership(group.id, owner.id)).toBeNull();
  });

  it("isOwner is true for an approved owner", async () => {
    const { owner, group } = await makeGroup(`ok-${Date.now()}`);
    await db.membership.create({
      data: { groupId: group.id, userId: owner.id, role: "owner", status: "approved" },
    });
    expect(await isOwner(group.id, owner.id)).toBe(true);
  });

  it("isOwner is false for an approved member (non-owner role)", async () => {
    const { owner, group } = await makeGroup(`memb-${Date.now()}`);
    const u = await db.user.create({ data: { email: `m-${Date.now()}@example.com` } });
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    expect(await isOwner(group.id, u.id)).toBe(false);
    // unused so test doesn't trip noUnusedLocals
    expect(owner.id).toBeTruthy();
  });

  it("isOwner is false for a pending owner (status not approved)", async () => {
    const { group } = await makeGroup(`pending-${Date.now()}`);
    const u = await db.user.create({ data: { email: `p-${Date.now()}@example.com` } });
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "owner", status: "pending" },
    });
    expect(await isOwner(group.id, u.id)).toBe(false);
  });

  it("assertOwner throws AuthorizationError when not an approved owner", async () => {
    const { group } = await makeGroup(`assert-${Date.now()}`);
    const u = await db.user.create({ data: { email: `a-${Date.now()}@example.com` } });
    await expect(assertOwner(group.id, u.id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("assertOwner resolves silently for an approved owner", async () => {
    const { owner, group } = await makeGroup(`assert-ok-${Date.now()}`);
    await db.membership.create({
      data: { groupId: group.id, userId: owner.id, role: "owner", status: "approved" },
    });
    await expect(assertOwner(group.id, owner.id)).resolves.toBeUndefined();
  });
});
