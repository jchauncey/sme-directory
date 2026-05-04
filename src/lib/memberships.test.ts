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
const {
  applyToGroup,
  assertOwner,
  assertOwnerOrModerator,
  AuthorizationError,
  ConflictError,
  countApprovedMembers,
  getMembership,
  getUserMembershipStatus,
  InvalidSuccessorError,
  isOwner,
  isOwnerOrModerator,
  leaveGroup,
  listApprovedMembers,
  listPendingApplications,
  listSuccessorCandidates,
  NotAMemberError,
  NotFoundError,
  removeMembership,
  setMembershipStatus,
  SoleOwnerCannotLeaveError,
  transferOwnershipAndLeave,
} = await import("./memberships");

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

let counter = 0;
function next(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}`;
}

async function makeGroup(slugSuffix: string, opts: { autoApprove?: boolean } = {}) {
  const owner = await db.user.create({
    data: { email: `owner-${slugSuffix}@example.com`, name: "Owner" },
  });
  const group = await db.group.create({
    data: {
      slug: `g-${slugSuffix}`,
      name: "G",
      createdById: owner.id,
      autoApprove: opts.autoApprove ?? false,
    },
  });
  // Mirror createGroup's transaction: an approved owner membership.
  await db.membership.create({
    data: { groupId: group.id, userId: owner.id, role: "owner", status: "approved" },
  });
  return { owner, group };
}

async function makeUser(label: string) {
  return db.user.create({ data: { email: `${label}-${Date.now()}-${Math.random()}@example.com` } });
}

describe("memberships helpers", () => {
  it("getMembership returns null when no row exists", async () => {
    const group = await db.group.create({
      data: {
        slug: next("none"),
        name: "G",
        createdById: (await makeUser("ghost")).id,
      },
    });
    const u = await makeUser("none-u");
    expect(await getMembership(group.id, u.id)).toBeNull();
  });

  it("isOwner is true for an approved owner", async () => {
    const { owner, group } = await makeGroup(next("ok"));
    expect(await isOwner(group.id, owner.id)).toBe(true);
  });

  it("isOwner is false for an approved member (non-owner role)", async () => {
    const { group } = await makeGroup(next("memb"));
    const u = await makeUser("m");
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    expect(await isOwner(group.id, u.id)).toBe(false);
  });

  it("isOwner is false for a pending owner (status not approved)", async () => {
    const group = await db.group.create({
      data: {
        slug: next("pending"),
        name: "G",
        createdById: (await makeUser("p-creator")).id,
      },
    });
    const u = await makeUser("p");
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "owner", status: "pending" },
    });
    expect(await isOwner(group.id, u.id)).toBe(false);
  });

  it("assertOwner throws AuthorizationError when not an approved owner", async () => {
    const { group } = await makeGroup(next("assert"));
    const u = await makeUser("a");
    await expect(assertOwner(group.id, u.id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("assertOwner resolves silently for an approved owner", async () => {
    const { owner, group } = await makeGroup(next("assert-ok"));
    await expect(assertOwner(group.id, owner.id)).resolves.toBeUndefined();
  });
});

describe("isOwnerOrModerator / assertOwnerOrModerator", () => {
  it("is true for approved owner", async () => {
    const { owner, group } = await makeGroup(next("oom-owner"));
    expect(await isOwnerOrModerator(group.id, owner.id)).toBe(true);
  });

  it("is true for approved moderator", async () => {
    const { group } = await makeGroup(next("oom-mod"));
    const u = await makeUser("mod");
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "moderator", status: "approved" },
    });
    expect(await isOwnerOrModerator(group.id, u.id)).toBe(true);
  });

  it("is false for approved member", async () => {
    const { group } = await makeGroup(next("oom-mem"));
    const u = await makeUser("memx");
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    expect(await isOwnerOrModerator(group.id, u.id)).toBe(false);
  });

  it("is false for pending moderator", async () => {
    const { group } = await makeGroup(next("oom-pm"));
    const u = await makeUser("pm");
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "moderator", status: "pending" },
    });
    expect(await isOwnerOrModerator(group.id, u.id)).toBe(false);
  });

  it("assertOwnerOrModerator throws for a stranger", async () => {
    const { group } = await makeGroup(next("oom-stranger"));
    const u = await makeUser("stranger");
    await expect(assertOwnerOrModerator(group.id, u.id)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("applyToGroup", () => {
  it("creates a pending row when autoApprove is off", async () => {
    const { group } = await makeGroup(next("apply-off"));
    const u = await makeUser("apply1");
    const m = await applyToGroup(group.id, u.id);
    expect(m.status).toBe("pending");
    expect(m.role).toBe("member");
  });

  it("creates an approved row when autoApprove is on", async () => {
    const { group } = await makeGroup(next("apply-on"), { autoApprove: true });
    const u = await makeUser("apply2");
    const m = await applyToGroup(group.id, u.id);
    expect(m.status).toBe("approved");
    expect(m.role).toBe("member");
  });

  it("is idempotent for an existing approved member", async () => {
    const { group } = await makeGroup(next("apply-idem-app"));
    const u = await makeUser("apply3");
    const first = await applyToGroup(group.id, u.id);
    await db.membership.update({
      where: { userId_groupId: { userId: u.id, groupId: group.id } },
      data: { status: "approved" },
    });
    const second = await applyToGroup(group.id, u.id);
    expect(second.status).toBe("approved");
    expect(second.id).toBe(first.id);
  });

  it("returns the existing row for a pending applicant (no-op)", async () => {
    const { group } = await makeGroup(next("apply-idem-pend"));
    const u = await makeUser("apply4");
    const first = await applyToGroup(group.id, u.id);
    const second = await applyToGroup(group.id, u.id);
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("pending");
  });

  it("flips a rejected row back to pending when autoApprove is off", async () => {
    const { group } = await makeGroup(next("apply-rej-off"));
    const u = await makeUser("apply5");
    await applyToGroup(group.id, u.id);
    await db.membership.update({
      where: { userId_groupId: { userId: u.id, groupId: group.id } },
      data: { status: "rejected" },
    });
    const re = await applyToGroup(group.id, u.id);
    expect(re.status).toBe("pending");
  });

  it("flips a rejected row to approved when autoApprove is on", async () => {
    const { group } = await makeGroup(next("apply-rej-on"), { autoApprove: true });
    const u = await makeUser("apply6");
    await applyToGroup(group.id, u.id);
    await db.membership.update({
      where: { userId_groupId: { userId: u.id, groupId: group.id } },
      data: { status: "rejected" },
    });
    const re = await applyToGroup(group.id, u.id);
    expect(re.status).toBe("approved");
  });

  it("throws NotFoundError for an unknown group", async () => {
    const u = await makeUser("apply7");
    await expect(applyToGroup("does-not-exist", u.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("setMembershipStatus", () => {
  it("owner can approve a pending member", async () => {
    const { owner, group } = await makeGroup(next("smt-approve"));
    const u = await makeUser("appr");
    await applyToGroup(group.id, u.id);
    const m = await setMembershipStatus(group.id, u.id, "approved", owner.id);
    expect(m.status).toBe("approved");
  });

  it("moderator can reject", async () => {
    const { group } = await makeGroup(next("smt-mod"));
    const mod = await makeUser("mod");
    await db.membership.create({
      data: { groupId: group.id, userId: mod.id, role: "moderator", status: "approved" },
    });
    const u = await makeUser("rej");
    await applyToGroup(group.id, u.id);
    const m = await setMembershipStatus(group.id, u.id, "rejected", mod.id);
    expect(m.status).toBe("rejected");
  });

  it("non-owner non-mod cannot change status", async () => {
    const { group } = await makeGroup(next("smt-stranger"));
    const stranger = await makeUser("strange");
    const u = await makeUser("target");
    await applyToGroup(group.id, u.id);
    await expect(
      setMembershipStatus(group.id, u.id, "approved", stranger.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("cannot change the owner's row", async () => {
    const { owner, group } = await makeGroup(next("smt-owner"));
    await expect(
      setMembershipStatus(group.id, owner.id, "rejected", owner.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns 404 for a missing target row", async () => {
    const { owner, group } = await makeGroup(next("smt-missing"));
    const ghost = await makeUser("ghost");
    await expect(
      setMembershipStatus(group.id, ghost.id, "approved", owner.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is a no-op when target already has the requested status", async () => {
    const { owner, group } = await makeGroup(next("smt-noop"));
    const u = await makeUser("noop");
    await applyToGroup(group.id, u.id);
    await setMembershipStatus(group.id, u.id, "approved", owner.id);
    const second = await setMembershipStatus(group.id, u.id, "approved", owner.id);
    expect(second.status).toBe("approved");
  });
});

describe("removeMembership", () => {
  it("member can leave themselves", async () => {
    const { group } = await makeGroup(next("rm-leave"));
    const u = await makeUser("leaver");
    await applyToGroup(group.id, u.id);
    await removeMembership(group.id, u.id, u.id);
    expect(await getMembership(group.id, u.id)).toBeNull();
  });

  it("owner cannot leave their own group (409)", async () => {
    const { owner, group } = await makeGroup(next("rm-owner-leave"));
    await expect(removeMembership(group.id, owner.id, owner.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("owner can remove a member", async () => {
    const { owner, group } = await makeGroup(next("rm-kick"));
    const u = await makeUser("kicked");
    await applyToGroup(group.id, u.id);
    await removeMembership(group.id, u.id, owner.id);
    expect(await getMembership(group.id, u.id)).toBeNull();
  });

  it("moderator cannot remove another member", async () => {
    const { group } = await makeGroup(next("rm-mod"));
    const mod = await makeUser("mod");
    await db.membership.create({
      data: { groupId: group.id, userId: mod.id, role: "moderator", status: "approved" },
    });
    const u = await makeUser("victim");
    await applyToGroup(group.id, u.id);
    await expect(removeMembership(group.id, u.id, mod.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("non-owner non-mod cannot remove another", async () => {
    const { group } = await makeGroup(next("rm-stranger"));
    const stranger = await makeUser("strange");
    const u = await makeUser("victim2");
    await applyToGroup(group.id, u.id);
    await expect(removeMembership(group.id, u.id, stranger.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("nobody can remove the owner via DELETE (409)", async () => {
    const { owner, group } = await makeGroup(next("rm-owner-by-other"));
    const stranger = await makeUser("strange2");
    await expect(removeMembership(group.id, owner.id, stranger.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("returns 404 for a missing target row", async () => {
    const { owner, group } = await makeGroup(next("rm-missing"));
    const ghost = await makeUser("ghost-rm");
    await expect(removeMembership(group.id, ghost.id, owner.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("listPendingApplications", () => {
  it("returns only pending rows with user details", async () => {
    const { group } = await makeGroup(next("list"));
    const a = await makeUser("a-list");
    const b = await makeUser("b-list");
    const c = await makeUser("c-list");
    await applyToGroup(group.id, a.id);
    await applyToGroup(group.id, b.id);
    // c is approved → should not appear
    await db.membership.create({
      data: { groupId: group.id, userId: c.id, role: "member", status: "approved" },
    });

    const pending = await listPendingApplications(group.id);
    const ids = pending.map((m) => m.userId).sort();
    expect(ids).toEqual([a.id, b.id].sort());
    expect(pending[0]?.user).toHaveProperty("email");
  });
});

describe("leaveGroup", () => {
  it("removes the membership for a regular approved member", async () => {
    const { group } = await makeGroup(next("leave-member"));
    const user = await makeUser("leaver");
    await db.membership.create({
      data: { groupId: group.id, userId: user.id, role: "member", status: "approved" },
    });
    await leaveGroup(group.id, user.id);
    expect(await getMembership(group.id, user.id)).toBeNull();
  });

  it("throws NotAMemberError when caller has no membership", async () => {
    const { group } = await makeGroup(next("leave-none"));
    const user = await makeUser("ghost-leave");
    await expect(leaveGroup(group.id, user.id)).rejects.toBeInstanceOf(NotAMemberError);
  });

  it("throws SoleOwnerCannotLeaveError when caller is the only approved owner", async () => {
    const { owner, group } = await makeGroup(next("leave-sole"));
    await expect(leaveGroup(group.id, owner.id)).rejects.toBeInstanceOf(
      SoleOwnerCannotLeaveError,
    );
  });

  it("allows an owner to leave when another approved owner exists", async () => {
    const { owner, group } = await makeGroup(next("leave-coowner"));
    const co = await makeUser("co");
    await db.membership.create({
      data: { groupId: group.id, userId: co.id, role: "owner", status: "approved" },
    });
    await leaveGroup(group.id, owner.id);
    expect(await getMembership(group.id, owner.id)).toBeNull();
    expect(await getMembership(group.id, co.id)).not.toBeNull();
  });
});

describe("transferOwnershipAndLeave", () => {
  it("promotes successor to owner and removes caller", async () => {
    const { owner, group } = await makeGroup(next("xfer"));
    const successor = await makeUser("succ");
    await db.membership.create({
      data: { groupId: group.id, userId: successor.id, role: "member", status: "approved" },
    });
    await transferOwnershipAndLeave(group.id, owner.id, successor.id);
    expect(await getMembership(group.id, owner.id)).toBeNull();
    const promoted = await getMembership(group.id, successor.id);
    expect(promoted!.role).toBe("owner");
    expect(promoted!.status).toBe("approved");
  });

  it("throws InvalidSuccessorError when successor is not approved", async () => {
    const { owner, group } = await makeGroup(next("xfer-pending"));
    const successor = await makeUser("succ");
    await db.membership.create({
      data: { groupId: group.id, userId: successor.id, role: "member", status: "pending" },
    });
    await expect(
      transferOwnershipAndLeave(group.id, owner.id, successor.id),
    ).rejects.toBeInstanceOf(InvalidSuccessorError);
  });

  it("throws InvalidSuccessorError when successor is the same as caller", async () => {
    const { owner, group } = await makeGroup(next("xfer-self"));
    await expect(
      transferOwnershipAndLeave(group.id, owner.id, owner.id),
    ).rejects.toBeInstanceOf(InvalidSuccessorError);
  });

  it("throws AuthorizationError when caller is not an approved owner", async () => {
    const { group } = await makeGroup(next("xfer-notowner"));
    const member = await makeUser("memb");
    await db.membership.create({
      data: { groupId: group.id, userId: member.id, role: "member", status: "approved" },
    });
    const other = await makeUser("other");
    await db.membership.create({
      data: { groupId: group.id, userId: other.id, role: "member", status: "approved" },
    });
    await expect(
      transferOwnershipAndLeave(group.id, member.id, other.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("does not modify state when validation fails (atomic)", async () => {
    const { owner, group } = await makeGroup(next("xfer-atomic"));
    const successor = await makeUser("succ");
    await db.membership.create({
      data: { groupId: group.id, userId: successor.id, role: "member", status: "rejected" },
    });
    await expect(
      transferOwnershipAndLeave(group.id, owner.id, successor.id),
    ).rejects.toBeInstanceOf(InvalidSuccessorError);
    // owner still owner, successor unchanged
    const o = await getMembership(group.id, owner.id);
    expect(o!.role).toBe("owner");
    const s = await getMembership(group.id, successor.id);
    expect(s!.role).toBe("member");
    expect(s!.status).toBe("rejected");
  });
});

describe("getUserMembershipStatus / countApprovedMembers", () => {
  it("getUserMembershipStatus returns null when no membership exists", async () => {
    const { group } = await makeGroup(next("status-none"));
    const user = await makeUser("ghost-status");
    expect(await getUserMembershipStatus(group.id, user.id)).toBeNull();
  });

  it("getUserMembershipStatus returns status and role", async () => {
    const { group } = await makeGroup(next("status"));
    const user = await makeUser("u");
    await db.membership.create({
      data: { groupId: group.id, userId: user.id, role: "moderator", status: "approved" },
    });
    expect(await getUserMembershipStatus(group.id, user.id)).toEqual({
      role: "moderator",
      status: "approved",
    });
  });

  it("countApprovedMembers excludes pending and rejected", async () => {
    const { group } = await makeGroup(next("count"));
    const u1 = await makeUser("a");
    const u2 = await makeUser("b");
    const u3 = await makeUser("c");
    await db.membership.create({
      data: { groupId: group.id, userId: u1.id, role: "member", status: "approved" },
    });
    await db.membership.create({
      data: { groupId: group.id, userId: u2.id, role: "member", status: "pending" },
    });
    await db.membership.create({
      data: { groupId: group.id, userId: u3.id, role: "member", status: "rejected" },
    });
    // owner + u1
    expect(await countApprovedMembers(group.id)).toBe(2);
  });
});

describe("listApprovedMembers / listSuccessorCandidates", () => {
  it("listApprovedMembers returns approved members up to limit", async () => {
    const { owner, group } = await makeGroup(next("list-approved"));
    const u1 = await makeUser("a");
    await db.membership.create({
      data: { groupId: group.id, userId: u1.id, role: "member", status: "approved" },
    });
    const u2 = await makeUser("b");
    await db.membership.create({
      data: { groupId: group.id, userId: u2.id, role: "member", status: "pending" },
    });
    const list = await listApprovedMembers(group.id, 5);
    const userIds = list.map((m) => m.userId);
    expect(userIds).toContain(owner.id);
    expect(userIds).toContain(u1.id);
    expect(userIds).not.toContain(u2.id);
  });

  it("listSuccessorCandidates excludes the caller", async () => {
    const { owner, group } = await makeGroup(next("succ"));
    const u1 = await makeUser("a");
    await db.membership.create({
      data: { groupId: group.id, userId: u1.id, role: "member", status: "approved" },
    });
    const list = await listSuccessorCandidates(group.id, owner.id);
    expect(list.map((m) => m.userId)).toEqual([u1.id]);
  });
});
