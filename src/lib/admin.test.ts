import { beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "@test/db";
import { makeAnswer, makeGroup, makeQuestion, makeUser } from "@test/factories";

setupTestDb("admin");

const { db } = await import("@/lib/db");
const {
  adminArchiveGroup,
  adminUnarchiveGroup,
  adminDeleteGroup,
  adminUpdateGroup,
  adminSetMembershipRole,
  adminSetMembershipStatus,
  adminRemoveMembership,
  adminPromoteUser,
  adminDemoteUser,
  adminDeleteUser,
  adminDeleteQuestion,
  adminDeleteAnswer,
  listAdminAuditLog,
} = await import("./admin");
const { AuthorizationError, ConflictError } = await import("./memberships");

async function makeSuperAdmin() {
  const u = await makeUser(db, { name: "Admin" });
  return db.user.update({
    where: { id: u.id },
    data: { isSuperAdmin: true },
  });
}

beforeEach(async () => {
  // Reset state between tests so audit-log and last-super-admin assertions stay
  // deterministic. Order matters — child rows first.
  await db.adminAuditLog.deleteMany();
  await db.vote.deleteMany();
  await db.favorite.deleteMany();
  await db.notification.deleteMany();
  await db.answer.deleteMany();
  await db.question.deleteMany();
  await db.membership.deleteMany();
  await db.group.deleteMany();
  await db.user.deleteMany();
});

describe("authorization", () => {
  it("rejects non-super-admin even if they're the group owner", async () => {
    const { owner, group } = await makeGroup(db);
    await expect(adminArchiveGroup(group.slug, owner.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    // Group must remain unchanged.
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.archivedAt).toBeNull();
  });

  it("rejects a deleted user (defensive against stale JWT after demotion)", async () => {
    const admin = await makeSuperAdmin();
    await db.user.update({ where: { id: admin.id }, data: { isSuperAdmin: false } });
    const { group } = await makeGroup(db);
    await expect(adminArchiveGroup(group.slug, admin.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});

describe("adminArchiveGroup / adminUnarchiveGroup", () => {
  it("archives and unarchives a group with audit rows", async () => {
    const admin = await makeSuperAdmin();
    const { group } = await makeGroup(db);

    await adminArchiveGroup(group.slug, admin.id);
    let fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.archivedAt).not.toBeNull();

    await adminUnarchiveGroup(group.slug, admin.id);
    fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.archivedAt).toBeNull();

    const log = await listAdminAuditLog({ per: 10 });
    const actions = log.items.map((r) => r.action);
    expect(actions).toContain("group.archive");
    expect(actions).toContain("group.unarchive");
  });

  it("rejects archive when already archived", async () => {
    const admin = await makeSuperAdmin();
    const { group } = await makeGroup(db);
    await adminArchiveGroup(group.slug, admin.id);
    await expect(adminArchiveGroup(group.slug, admin.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("adminDeleteGroup", () => {
  it("cascades to memberships, questions, answers, votes, and favorites", async () => {
    const admin = await makeSuperAdmin();
    const { owner, group } = await makeGroup(db);
    const member = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: member.id, role: "member", status: "approved" },
    });
    const question = await makeQuestion(db, { groupId: group.id, authorId: owner.id });
    const answer = await makeAnswer(db, { questionId: question.id, authorId: member.id });
    await db.vote.create({
      data: { userId: member.id, targetType: "question", targetId: question.id, value: 1 },
    });
    await db.favorite.create({
      data: { userId: member.id, targetType: "answer", targetId: answer.id },
    });

    await adminDeleteGroup(group.slug, admin.id);

    expect(await db.group.findUnique({ where: { id: group.id } })).toBeNull();
    expect(await db.membership.count({ where: { groupId: group.id } })).toBe(0);
    expect(await db.question.findUnique({ where: { id: question.id } })).toBeNull();
    expect(await db.answer.findUnique({ where: { id: answer.id } })).toBeNull();
    expect(await db.vote.count({ where: { targetId: question.id } })).toBe(0);
    expect(await db.favorite.count({ where: { targetId: answer.id } })).toBe(0);

    const log = await listAdminAuditLog({ per: 10 });
    expect(log.items[0]?.action).toBe("group.delete");
  });
});

describe("adminUpdateGroup", () => {
  it("updates name/description/autoApprove for any group", async () => {
    const admin = await makeSuperAdmin();
    const { group } = await makeGroup(db, { name: "Original" });
    const updated = await adminUpdateGroup(
      group.slug,
      { name: "Renamed", description: "Now described", autoApprove: true },
      admin.id,
    );
    expect(updated.name).toBe("Renamed");
    expect(updated.description).toBe("Now described");
    expect(updated.autoApprove).toBe(true);
  });
});

describe("adminSetMembershipRole", () => {
  it("auto-creates an approved membership when the target has none", async () => {
    const admin = await makeSuperAdmin();
    const { group } = await makeGroup(db);
    const target = await makeUser(db);
    const result = await adminSetMembershipRole(group.id, target.id, "moderator", admin.id);
    expect(result.role).toBe("moderator");
    expect(result.status).toBe("approved");

    const log = await listAdminAuditLog({ per: 10 });
    expect(log.items[0]?.action).toBe("membership.create");
  });

  it("updates an existing membership and approves it", async () => {
    const admin = await makeSuperAdmin();
    const { group } = await makeGroup(db);
    const target = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: target.id, role: "member", status: "pending" },
    });
    const result = await adminSetMembershipRole(group.id, target.id, "owner", admin.id);
    expect(result.role).toBe("owner");
    expect(result.status).toBe("approved");

    const log = await listAdminAuditLog({ per: 10 });
    expect(log.items[0]?.action).toBe("membership.role.set");
  });
});

describe("adminSetMembershipStatus", () => {
  it("force-approves a pending application", async () => {
    const admin = await makeSuperAdmin();
    const { group } = await makeGroup(db);
    const target = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: target.id, role: "member", status: "pending" },
    });
    const result = await adminSetMembershipStatus(group.id, target.id, "approved", admin.id);
    expect(result.status).toBe("approved");
  });
});

describe("adminRemoveMembership", () => {
  it("removes a membership including an owner", async () => {
    const admin = await makeSuperAdmin();
    const { owner, group } = await makeGroup(db);
    await adminRemoveMembership(group.id, owner.id, admin.id);
    expect(
      await db.membership.findUnique({
        where: { userId_groupId: { userId: owner.id, groupId: group.id } },
      }),
    ).toBeNull();
  });
});

describe("adminPromoteUser / adminDemoteUser", () => {
  it("promotes and demotes", async () => {
    const admin = await makeSuperAdmin();
    const target = await makeUser(db);
    const promoted = await adminPromoteUser(target.id, admin.id);
    expect(promoted.isSuperAdmin).toBe(true);
    const demoted = await adminDemoteUser(target.id, admin.id);
    expect(demoted.isSuperAdmin).toBe(false);
  });

  it("refuses to demote the last super admin (self)", async () => {
    const admin = await makeSuperAdmin();
    await expect(adminDemoteUser(admin.id, admin.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("allows demoting self when another super admin exists", async () => {
    const admin = await makeSuperAdmin();
    const other = await makeSuperAdmin();
    void other;
    const result = await adminDemoteUser(admin.id, admin.id);
    expect(result.isSuperAdmin).toBe(false);
  });
});

describe("adminDeleteUser", () => {
  it("refuses to delete self", async () => {
    const admin = await makeSuperAdmin();
    await expect(adminDeleteUser(admin.id, admin.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses to delete the last super admin (even from another actor would-be admin)", async () => {
    const admin = await makeSuperAdmin();
    const helper = await makeSuperAdmin();
    // Demote helper so admin is the only super admin.
    await adminDemoteUser(helper.id, admin.id);
    // Now promote helper back temporarily, try to delete admin from helper — should succeed.
    await adminPromoteUser(helper.id, admin.id);
    await adminDeleteUser(admin.id, helper.id);
    // helper is now the sole super admin. Promote another so we can try deleting helper.
    const helper2 = await makeSuperAdmin();
    // Demote helper2 — helper is sole again. Deleting helper from any actor should fail because
    // there are no other super admins left after the delete completes. We need a super-admin
    // actor; only helper qualifies and they can't delete themselves.
    await adminDemoteUser(helper2.id, helper.id);
    await expect(adminDeleteUser(helper.id, helper.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("deletes content authored by the user and reassigns their created groups", async () => {
    const admin = await makeSuperAdmin();
    const target = await makeUser(db);
    const { owner, group } = await makeGroup(db, { ownerId: target.id });
    void owner;
    const q = await makeQuestion(db, { groupId: group.id, authorId: target.id });
    const a = await makeAnswer(db, { questionId: q.id, authorId: target.id });

    // Author a vote and favorite by `target` on someone else's content so we
    // can assert the userId-cascade fires (Vote.userId / Favorite.userId are
    // ON DELETE CASCADE — admin delete depends on that).
    const otherUser = await makeUser(db);
    const { group: otherGroup } = await makeGroup(db, { ownerId: otherUser.id });
    const otherQ = await makeQuestion(db, { groupId: otherGroup.id, authorId: otherUser.id });
    await db.vote.create({
      data: { userId: target.id, targetType: "question", targetId: otherQ.id, value: 1 },
    });
    await db.favorite.create({
      data: { userId: target.id, targetType: "question", targetId: otherQ.id },
    });

    await adminDeleteUser(target.id, admin.id);

    expect(await db.user.findUnique({ where: { id: target.id } })).toBeNull();
    expect(await db.question.findUnique({ where: { id: q.id } })).toBeNull();
    expect(await db.answer.findUnique({ where: { id: a.id } })).toBeNull();
    // The group remains but is reassigned to the actor.
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.createdById).toBe(admin.id);
    // Votes and favorites authored by the target are gone via FK cascade.
    expect(await db.vote.count({ where: { userId: target.id } })).toBe(0);
    expect(await db.favorite.count({ where: { userId: target.id } })).toBe(0);
    // The target's content was hard-deleted, so votes on that content are also gone.
    // Other users' content is untouched.
    expect(await db.question.findUnique({ where: { id: otherQ.id } })).not.toBeNull();
  });
});

describe("adminDeleteQuestion / adminDeleteAnswer", () => {
  it("hard-deletes a question and its answers + votes", async () => {
    const admin = await makeSuperAdmin();
    const { owner, group } = await makeGroup(db);
    const q = await makeQuestion(db, { groupId: group.id, authorId: owner.id });
    const a = await makeAnswer(db, { questionId: q.id, authorId: owner.id });
    await db.vote.create({
      data: { userId: owner.id, targetType: "question", targetId: q.id, value: 1 },
    });

    await adminDeleteQuestion(q.id, admin.id);

    expect(await db.question.findUnique({ where: { id: q.id } })).toBeNull();
    expect(await db.answer.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await db.vote.count({ where: { targetId: q.id } })).toBe(0);
  });

  it("hard-deletes an answer", async () => {
    const admin = await makeSuperAdmin();
    const { owner, group } = await makeGroup(db);
    const q = await makeQuestion(db, { groupId: group.id, authorId: owner.id });
    const a = await makeAnswer(db, { questionId: q.id, authorId: owner.id });
    await adminDeleteAnswer(a.id, admin.id);
    expect(await db.answer.findUnique({ where: { id: a.id } })).toBeNull();
    // Parent question remains.
    expect(await db.question.findUnique({ where: { id: q.id } })).not.toBeNull();
  });
});

describe("audit log retention", () => {
  it("preserves audit rows when the actor is deleted (SET NULL)", async () => {
    const admin = await makeSuperAdmin();
    const helper = await makeSuperAdmin();
    const { group } = await makeGroup(db);
    await adminArchiveGroup(group.slug, admin.id);

    // admin deletes themselves via helper.
    await adminDeleteUser(admin.id, helper.id);

    const log = await listAdminAuditLog({ per: 10 });
    const archiveRow = log.items.find((r) => r.action === "group.archive");
    expect(archiveRow).toBeDefined();
    expect(archiveRow?.actorId).toBeNull();
  });
});
