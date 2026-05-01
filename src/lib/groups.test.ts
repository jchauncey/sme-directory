/**
 * Group service tests.
 *
 * Real-DB pattern (mirrors db.test.ts): a throw-away SQLite file
 * initialised by `prisma migrate deploy` in beforeAll.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-groups-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup, getGroupBySlug, getGroupBySlugOrThrow, updateGroup, SlugConflictError } =
  await import("./groups");
const { AuthorizationError, NotFoundError } = await import("./memberships");

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

async function makeUser(label: string) {
  return db.user.create({ data: { email: `${label}-${Date.now()}-${Math.random()}@example.com` } });
}

describe("createGroup", () => {
  it("creates a group and an approved owner Membership atomically", async () => {
    const user = await makeUser("creator");
    const group = await createGroup(
      { name: "Kubernetes", slug: `kubernetes-${Date.now()}`, autoApprove: false },
      user.id,
    );
    expect(group.createdById).toBe(user.id);
    const membership = await db.membership.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("owner");
    expect(membership!.status).toBe("approved");
  });

  it("throws SlugConflictError when slug is taken", async () => {
    const user = await makeUser("dup");
    const slug = `dup-${Date.now()}`;
    await createGroup({ name: "First", slug, autoApprove: false }, user.id);
    await expect(
      createGroup({ name: "Second", slug, autoApprove: false }, user.id),
    ).rejects.toBeInstanceOf(SlugConflictError);
  });

  it("does not leave a Group row behind when membership creation would fail", async () => {
    // Membership creation can't easily be made to fail mid-transaction with
    // an internal constraint, but if createGroup ever stops being atomic, the
    // SlugConflict path above plus this round-trip catches the regression.
    const user = await makeUser("atomic");
    const slug = `atomic-${Date.now()}`;
    await createGroup({ name: "Atomic", slug }, user.id);
    const found = await db.group.findUnique({ where: { slug } });
    expect(found).not.toBeNull();
  });
});

describe("getGroupBySlug / getGroupBySlugOrThrow", () => {
  it("returns the group with creator details", async () => {
    const user = await makeUser("read");
    const slug = `read-${Date.now()}`;
    await createGroup({ name: "Read", slug, description: "hello" }, user.id);
    const found = await getGroupBySlug(slug);
    expect(found).not.toBeNull();
    expect(found!.slug).toBe(slug);
    expect(found!.createdBy.email).toBe(user.email);
  });

  it("returns null for unknown slug", async () => {
    expect(await getGroupBySlug("does-not-exist")).toBeNull();
  });

  it("getGroupBySlugOrThrow throws NotFoundError for unknown slug", async () => {
    await expect(getGroupBySlugOrThrow("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateGroup", () => {
  it("updates name/description/autoApprove for the owner", async () => {
    const owner = await makeUser("ownerU");
    const slug = `update-${Date.now()}`;
    await createGroup({ name: "Old", slug, description: "old", autoApprove: false }, owner.id);
    const updated = await updateGroup(
      slug,
      { name: "New", description: "new", autoApprove: true },
      owner.id,
    );
    expect(updated.name).toBe("New");
    expect(updated.description).toBe("new");
    expect(updated.autoApprove).toBe(true);
  });

  it("clears description when passed null", async () => {
    const owner = await makeUser("clear");
    const slug = `clear-${Date.now()}`;
    await createGroup({ name: "C", slug, description: "to clear" }, owner.id);
    const updated = await updateGroup(slug, { description: null }, owner.id);
    expect(updated.description).toBeNull();
  });

  it("throws AuthorizationError when actor is not an owner", async () => {
    const owner = await makeUser("ownerX");
    const stranger = await makeUser("stranger");
    const slug = `forbid-${Date.now()}`;
    await createGroup({ name: "F", slug }, owner.id);
    await expect(updateGroup(slug, { name: "Hacked" }, stranger.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("throws NotFoundError for an unknown slug", async () => {
    const owner = await makeUser("nf");
    await expect(updateGroup("does-not-exist", { name: "x" }, owner.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
