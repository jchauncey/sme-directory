/**
 * Memberships authorization-helper tests.
 *
 * Real-DB tests using the shared test/db.ts + test/factories.ts helpers.
 */

import { describe, expect, it } from "vitest";
import { setupTestDb } from "@test/db";
import { makeGroup, makeUser, uniqueId } from "@test/factories";

setupTestDb("memberships");

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
  listApprovedMembersPage,
  listPendingApplications,
  listSuccessorCandidates,
  NotAMemberError,
  NotFoundError,
  removeMembership,
  setMembershipRole,
  setMembershipStatus,
  SoleOwnerCannotLeaveError,
  transferOwnershipAndLeave,
} = await import("./memberships");

describe("memberships helpers", () => {
  it("getMembership returns null when no row exists", async () => {
    const ghost = await makeUser(db);
    const group = await db.group.create({
      data: {
        slug: uniqueId("none"),
        name: "G",
        createdById: ghost.id,
      },
    });
    const u = await makeUser(db);
    expect(await getMembership(group.id, u.id)).toBeNull();
  });

  it("isOwner is true for an approved owner", async () => {
    const { owner, group } = await makeGroup(db);
    expect(await isOwner(group.id, owner.id)).toBe(true);
  });

  it("isOwner is false for an approved member (non-owner role)", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    expect(await isOwner(group.id, u.id)).toBe(false);
  });

  it("isOwner is false for a pending owner (status not approved)", async () => {
    const ghost = await makeUser(db);
    const group = await db.group.create({
      data: {
        slug: uniqueId("pending"),
        name: "G",
        createdById: ghost.id,
      },
    });
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "owner", status: "pending" },
    });
    expect(await isOwner(group.id, u.id)).toBe(false);
  });

  it("assertOwner throws AuthorizationError when not an approved owner", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await expect(assertOwner(group.id, u.id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("assertOwner resolves silently for an approved owner", async () => {
    const { owner, group } = await makeGroup(db);
    await expect(assertOwner(group.id, owner.id)).resolves.toBeUndefined();
  });
});

describe("isOwnerOrModerator / assertOwnerOrModerator", () => {
  it("is true for approved owner", async () => {
    const { owner, group } = await makeGroup(db);
    expect(await isOwnerOrModerator(group.id, owner.id)).toBe(true);
  });

  it("is true for approved moderator", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "moderator", status: "approved" },
    });
    expect(await isOwnerOrModerator(group.id, u.id)).toBe(true);
  });

  it("is false for approved member", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    expect(await isOwnerOrModerator(group.id, u.id)).toBe(false);
  });

  it("is false for pending moderator", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "moderator", status: "pending" },
    });
    expect(await isOwnerOrModerator(group.id, u.id)).toBe(false);
  });

  it("assertOwnerOrModerator throws for a stranger", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await expect(assertOwnerOrModerator(group.id, u.id)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("applyToGroup", () => {
  it("creates a pending row when autoApprove is off", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    const m = await applyToGroup(group.id, u.id);
    expect(m.status).toBe("pending");
    expect(m.role).toBe("member");
  });

  it("creates an approved row when autoApprove is on", async () => {
    const { group } = await makeGroup(db, { autoApprove: true });
    const u = await makeUser(db);
    const m = await applyToGroup(group.id, u.id);
    expect(m.status).toBe("approved");
    expect(m.role).toBe("member");
  });

  it("is idempotent for an existing approved member", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
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
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    const first = await applyToGroup(group.id, u.id);
    const second = await applyToGroup(group.id, u.id);
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("pending");
  });

  it("flips a rejected row back to pending when autoApprove is off", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await db.membership.update({
      where: { userId_groupId: { userId: u.id, groupId: group.id } },
      data: { status: "rejected" },
    });
    const re = await applyToGroup(group.id, u.id);
    expect(re.status).toBe("pending");
  });

  it("flips a rejected row to approved when autoApprove is on", async () => {
    const { group } = await makeGroup(db, { autoApprove: true });
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await db.membership.update({
      where: { userId_groupId: { userId: u.id, groupId: group.id } },
      data: { status: "rejected" },
    });
    const re = await applyToGroup(group.id, u.id);
    expect(re.status).toBe("approved");
  });

  it("throws NotFoundError for an unknown group", async () => {
    const u = await makeUser(db);
    await expect(applyToGroup("does-not-exist", u.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("setMembershipStatus", () => {
  it("owner can approve a pending member", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    const m = await setMembershipStatus(group.id, u.id, "approved", owner.id);
    expect(m.status).toBe("approved");
  });

  it("moderator can reject", async () => {
    const { group } = await makeGroup(db);
    const mod = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: mod.id, role: "moderator", status: "approved" },
    });
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    const m = await setMembershipStatus(group.id, u.id, "rejected", mod.id);
    expect(m.status).toBe("rejected");
  });

  it("non-owner non-mod cannot change status", async () => {
    const { group } = await makeGroup(db);
    const stranger = await makeUser(db);
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await expect(
      setMembershipStatus(group.id, u.id, "approved", stranger.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("cannot change the owner's row", async () => {
    const { owner, group } = await makeGroup(db);
    await expect(
      setMembershipStatus(group.id, owner.id, "rejected", owner.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns 404 for a missing target row", async () => {
    const { owner, group } = await makeGroup(db);
    const ghost = await makeUser(db);
    await expect(
      setMembershipStatus(group.id, ghost.id, "approved", owner.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is a no-op when target already has the requested status", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await setMembershipStatus(group.id, u.id, "approved", owner.id);
    const second = await setMembershipStatus(group.id, u.id, "approved", owner.id);
    expect(second.status).toBe("approved");
  });
});

describe("removeMembership", () => {
  it("member can leave themselves", async () => {
    const { group } = await makeGroup(db);
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await removeMembership(group.id, u.id, u.id);
    expect(await getMembership(group.id, u.id)).toBeNull();
  });

  it("owner cannot leave their own group (409)", async () => {
    const { owner, group } = await makeGroup(db);
    await expect(removeMembership(group.id, owner.id, owner.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("owner can remove a member", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await removeMembership(group.id, u.id, owner.id);
    expect(await getMembership(group.id, u.id)).toBeNull();
  });

  it("moderator can remove another member", async () => {
    const { group } = await makeGroup(db);
    const mod = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: mod.id, role: "moderator", status: "approved" },
    });
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await removeMembership(group.id, u.id, mod.id);
    expect(await getMembership(group.id, u.id)).toBeNull();
  });

  it("non-owner non-mod cannot remove another", async () => {
    const { group } = await makeGroup(db);
    const stranger = await makeUser(db);
    const u = await makeUser(db);
    await applyToGroup(group.id, u.id);
    await expect(removeMembership(group.id, u.id, stranger.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("nobody can remove the owner via DELETE (409)", async () => {
    const { owner, group } = await makeGroup(db);
    const stranger = await makeUser(db);
    await expect(removeMembership(group.id, owner.id, stranger.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("returns 404 for a missing target row", async () => {
    const { owner, group } = await makeGroup(db);
    const ghost = await makeUser(db);
    await expect(removeMembership(group.id, ghost.id, owner.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("setMembershipRole", () => {
  it("owner can promote member to moderator", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    const updated = await setMembershipRole(group.id, u.id, "moderator", owner.id);
    expect(updated.role).toBe("moderator");
  });

  it("owner can demote moderator to member", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "moderator", status: "approved" },
    });
    const updated = await setMembershipRole(group.id, u.id, "member", owner.id);
    expect(updated.role).toBe("member");
  });

  it("moderator cannot change roles", async () => {
    const { group } = await makeGroup(db);
    const mod = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: mod.id, role: "moderator", status: "approved" },
    });
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    await expect(setMembershipRole(group.id, u.id, "moderator", mod.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("non-member cannot change roles", async () => {
    const { group } = await makeGroup(db);
    const stranger = await makeUser(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    await expect(
      setMembershipRole(group.id, u.id, "moderator", stranger.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("cannot change the owner's role", async () => {
    const { owner, group } = await makeGroup(db);
    await expect(
      setMembershipRole(group.id, owner.id, "moderator", owner.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects when group is archived", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
    });
    await db.group.update({
      where: { id: group.id },
      data: { archivedAt: new Date() },
    });
    await expect(setMembershipRole(group.id, u.id, "moderator", owner.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("throws NotFoundError for a missing target membership", async () => {
    const { owner, group } = await makeGroup(db);
    const ghost = await makeUser(db);
    await expect(
      setMembershipRole(group.id, ghost.id, "moderator", owner.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects when target membership is not approved", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "member", status: "pending" },
    });
    await expect(setMembershipRole(group.id, u.id, "moderator", owner.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("is a no-op when role is already the requested value", async () => {
    const { owner, group } = await makeGroup(db);
    const u = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u.id, role: "moderator", status: "approved" },
    });
    const second = await setMembershipRole(group.id, u.id, "moderator", owner.id);
    expect(second.role).toBe("moderator");
  });
});

describe("listPendingApplications", () => {
  it("returns only pending rows with user details", async () => {
    const { group } = await makeGroup(db);
    const a = await makeUser(db);
    const b = await makeUser(db);
    const c = await makeUser(db);
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
    const { group } = await makeGroup(db);
    const user = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: user.id, role: "member", status: "approved" },
    });
    await leaveGroup(group.id, user.id);
    expect(await getMembership(group.id, user.id)).toBeNull();
  });

  it("throws NotAMemberError when caller has no membership", async () => {
    const { group } = await makeGroup(db);
    const user = await makeUser(db);
    await expect(leaveGroup(group.id, user.id)).rejects.toBeInstanceOf(NotAMemberError);
  });

  it("throws SoleOwnerCannotLeaveError when caller is the only approved owner", async () => {
    const { owner, group } = await makeGroup(db);
    await expect(leaveGroup(group.id, owner.id)).rejects.toBeInstanceOf(SoleOwnerCannotLeaveError);
  });

  it("allows an owner to leave when another approved owner exists", async () => {
    const { owner, group } = await makeGroup(db);
    const co = await makeUser(db);
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
    const { owner, group } = await makeGroup(db);
    const successor = await makeUser(db);
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
    const { owner, group } = await makeGroup(db);
    const successor = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: successor.id, role: "member", status: "pending" },
    });
    await expect(
      transferOwnershipAndLeave(group.id, owner.id, successor.id),
    ).rejects.toBeInstanceOf(InvalidSuccessorError);
  });

  it("throws InvalidSuccessorError when successor is the same as caller", async () => {
    const { owner, group } = await makeGroup(db);
    await expect(transferOwnershipAndLeave(group.id, owner.id, owner.id)).rejects.toBeInstanceOf(
      InvalidSuccessorError,
    );
  });

  it("throws AuthorizationError when caller is not an approved owner", async () => {
    const { group } = await makeGroup(db);
    const member = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: member.id, role: "member", status: "approved" },
    });
    const other = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: other.id, role: "member", status: "approved" },
    });
    await expect(transferOwnershipAndLeave(group.id, member.id, other.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("does not modify state when validation fails (atomic)", async () => {
    const { owner, group } = await makeGroup(db);
    const successor = await makeUser(db);
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
    const { group } = await makeGroup(db);
    const user = await makeUser(db);
    expect(await getUserMembershipStatus(group.id, user.id)).toBeNull();
  });

  it("getUserMembershipStatus returns status and role", async () => {
    const { group } = await makeGroup(db);
    const user = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: user.id, role: "moderator", status: "approved" },
    });
    expect(await getUserMembershipStatus(group.id, user.id)).toEqual({
      role: "moderator",
      status: "approved",
    });
  });

  it("countApprovedMembers excludes pending and rejected", async () => {
    const { group } = await makeGroup(db);
    const u1 = await makeUser(db);
    const u2 = await makeUser(db);
    const u3 = await makeUser(db);
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
    const { owner, group } = await makeGroup(db);
    const u1 = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u1.id, role: "member", status: "approved" },
    });
    const u2 = await makeUser(db);
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
    const { owner, group } = await makeGroup(db);
    const u1 = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: u1.id, role: "member", status: "approved" },
    });
    const list = await listSuccessorCandidates(group.id, owner.id);
    expect(list.map((m) => m.userId)).toEqual([u1.id]);
  });
});

describe("listApprovedMembersPage", () => {
  it("returns paginated slices ordered by joinedAt asc", async () => {
    const { owner, group } = await makeGroup(db);
    const created: string[] = [owner.id];
    // Ensure subsequent membership createdAt timestamps are strictly after
    // the owner's (created inside makeGroup) so ordering is deterministic.
    await new Promise((r) => setTimeout(r, 5));
    for (let i = 0; i < 5; i++) {
      const u = await makeUser(db);
      await db.membership.create({
        data: { groupId: group.id, userId: u.id, role: "member", status: "approved" },
      });
      created.push(u.id);
      await new Promise((r) => setTimeout(r, 5));
    }

    const p1 = await listApprovedMembersPage(group.id, { page: 1, per: 2 });
    expect(p1.total).toBe(6);
    expect(p1.items.map((m) => m.userId)).toEqual(created.slice(0, 2));

    const p2 = await listApprovedMembersPage(group.id, { page: 2, per: 2 });
    expect(p2.items.map((m) => m.userId)).toEqual(created.slice(2, 4));

    const p3 = await listApprovedMembersPage(group.id, { page: 3, per: 2 });
    expect(p3.items.map((m) => m.userId)).toEqual(created.slice(4, 6));

    const p4 = await listApprovedMembersPage(group.id, { page: 4, per: 2 });
    expect(p4.items).toEqual([]);
    expect(p4.total).toBe(6);
  });

  it("excludes pending and rejected memberships from total and items", async () => {
    const { owner, group } = await makeGroup(db);
    const approved = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: approved.id, role: "member", status: "approved" },
    });
    const pending = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: pending.id, role: "member", status: "pending" },
    });
    const rejected = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: rejected.id, role: "member", status: "rejected" },
    });
    const page = await listApprovedMembersPage(group.id, { page: 1, per: 20 });
    expect(page.total).toBe(2);
    const ids = page.items.map((m) => m.userId);
    expect(ids).toContain(owner.id);
    expect(ids).toContain(approved.id);
    expect(ids).not.toContain(pending.id);
    expect(ids).not.toContain(rejected.id);
  });
});
