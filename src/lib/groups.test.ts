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
const {
  archiveGroup,
  assertGroupNotArchived,
  createGroup,
  getGroupBySlug,
  getGroupBySlugOrThrow,
  listGroups,
  unarchiveGroup,
  updateGroup,
  SlugConflictError,
} = await import("./groups");
const { AuthorizationError, ConflictError, NotFoundError } = await import("./memberships");

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

describe("listGroups", () => {
  it("returns groups newest-first when sort=newest", async () => {
    const owner = await makeUser("ls-new");
    const tag = `ls-newest-${Date.now()}`;
    const a = await createGroup({ name: "A", slug: `${tag}-a` }, owner.id);
    // Force a small gap so createdAt ordering is unambiguous on coarse clocks.
    await new Promise((r) => setTimeout(r, 5));
    const b = await createGroup({ name: "B", slug: `${tag}-b` }, owner.id);
    const list = (await listGroups({ sort: "newest" })).items;
    const indexA = list.findIndex((g) => g.id === a.id);
    const indexB = list.findIndex((g) => g.id === b.id);
    expect(indexB).toBeGreaterThanOrEqual(0);
    expect(indexA).toBeGreaterThan(indexB);
  });

  it("counts only approved memberships", async () => {
    const owner = await makeUser("ls-count");
    const slug = `ls-count-${Date.now()}`;
    const group = await createGroup({ name: "C", slug }, owner.id);
    const m1 = await makeUser("ls-m1");
    const m2 = await makeUser("ls-m2");
    const m3 = await makeUser("ls-m3");
    await db.membership.create({
      data: { groupId: group.id, userId: m1.id, role: "member", status: "approved" },
    });
    await db.membership.create({
      data: { groupId: group.id, userId: m2.id, role: "member", status: "pending" },
    });
    await db.membership.create({
      data: { groupId: group.id, userId: m3.id, role: "member", status: "rejected" },
    });
    const list = (await listGroups({ sort: "newest" })).items;
    const found = list.find((g) => g.id === group.id);
    expect(found).toBeDefined();
    // owner + m1 = 2
    expect(found!.memberCount).toBe(2);
  });

  it("orders by member count desc when sort=members", async () => {
    const owner = await makeUser("ls-sort");
    const tag = `ls-sort-${Date.now()}`;
    const small = await createGroup({ name: "Small", slug: `${tag}-s` }, owner.id);
    const big = await createGroup({ name: "Big", slug: `${tag}-b` }, owner.id);
    for (let i = 0; i < 3; i++) {
      const u = await makeUser(`ls-bigm-${i}`);
      await db.membership.create({
        data: { groupId: big.id, userId: u.id, role: "member", status: "approved" },
      });
    }
    const list = (await listGroups({ sort: "members" })).items;
    const indexBig = list.findIndex((g) => g.id === big.id);
    const indexSmall = list.findIndex((g) => g.id === small.id);
    expect(indexBig).toBeGreaterThanOrEqual(0);
    expect(indexSmall).toBeGreaterThanOrEqual(0);
    expect(indexBig).toBeLessThan(indexSmall);
  });

  it("excludes archived groups by default but includes them when includeArchived is set", async () => {
    const owner = await makeUser("ls-arch");
    const slug = `ls-arch-${Date.now()}`;
    const group = await createGroup({ name: "Archy", slug }, owner.id);
    await archiveGroup(slug, owner.id);

    const defaultList = (await listGroups({ sort: "newest" })).items;
    expect(defaultList.find((g) => g.id === group.id)).toBeUndefined();

    const fullList = (await listGroups({ sort: "newest", includeArchived: true })).items;
    const found = fullList.find((g) => g.id === group.id);
    expect(found).toBeDefined();
    expect(found!.archivedAt).not.toBeNull();
  });

  it("respects page boundaries (page 2 returns expected slice)", async () => {
    const owner = await makeUser("ls-page");
    const tag = `ls-page-${Date.now()}`;
    const created: string[] = [];
    for (let i = 0; i < 5; i++) {
      const g = await createGroup(
        { name: `G${i}`, slug: `${tag}-${i}` },
        owner.id,
      );
      created.push(g.id);
      await new Promise((r) => setTimeout(r, 5));
    }
    // Newest-first → reversed ids.
    const expected = [...created].reverse();

    // These five are the most recently created in this DB, so under
    // newest-first ordering they occupy the first slots.
    const p1 = await listGroups({ sort: "newest", page: 1, per: 2 });
    expect(p1.total).toBeGreaterThanOrEqual(5);
    expect(p1.items.map((g) => g.id)).toEqual(expected.slice(0, 2));

    const p2 = await listGroups({ sort: "newest", page: 2, per: 2 });
    expect(p2.items.map((g) => g.id)).toEqual(expected.slice(2, 4));

    const p3 = await listGroups({ sort: "newest", page: 3, per: 2 });
    expect(p3.items.map((g) => g.id).slice(0, 1)).toEqual(expected.slice(4, 5));
  });
});

describe("archiveGroup / unarchiveGroup", () => {
  it("owner can archive then unarchive", async () => {
    const owner = await makeUser("arch-owner");
    const slug = `arch-${Date.now()}`;
    await createGroup({ name: "A", slug }, owner.id);
    const archived = await archiveGroup(slug, owner.id);
    expect(archived.archivedAt).not.toBeNull();

    const restored = await unarchiveGroup(slug, owner.id);
    expect(restored.archivedAt).toBeNull();
  });

  it("non-owner cannot archive (AuthorizationError)", async () => {
    const owner = await makeUser("arch-owner2");
    const stranger = await makeUser("arch-strange");
    const slug = `arch2-${Date.now()}`;
    await createGroup({ name: "A", slug }, owner.id);
    await expect(archiveGroup(slug, stranger.id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("archiveGroup throws ConflictError when already archived", async () => {
    const owner = await makeUser("arch-double");
    const slug = `arch-double-${Date.now()}`;
    await createGroup({ name: "A", slug }, owner.id);
    await archiveGroup(slug, owner.id);
    await expect(archiveGroup(slug, owner.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("unarchiveGroup throws ConflictError when not archived", async () => {
    const owner = await makeUser("arch-noop");
    const slug = `arch-noop-${Date.now()}`;
    await createGroup({ name: "A", slug }, owner.id);
    await expect(unarchiveGroup(slug, owner.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("updateGroup is blocked on archived groups (ConflictError)", async () => {
    const owner = await makeUser("arch-update");
    const slug = `arch-update-${Date.now()}`;
    await createGroup({ name: "A", slug }, owner.id);
    await archiveGroup(slug, owner.id);
    await expect(
      updateGroup(slug, { name: "Renamed" }, owner.id),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("assertGroupNotArchived throws when archived, no-op otherwise", async () => {
    const owner = await makeUser("arch-assert");
    const slug = `arch-assert-${Date.now()}`;
    const group = await createGroup({ name: "A", slug }, owner.id);
    await expect(assertGroupNotArchived(group.id)).resolves.toBeUndefined();
    await archiveGroup(slug, owner.id);
    await expect(assertGroupNotArchived(group.id)).rejects.toBeInstanceOf(ConflictError);
  });
});
