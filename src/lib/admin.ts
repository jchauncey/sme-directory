import "server-only";
import type { Answer, Group, Membership, Prisma, Question, Role, User } from "@prisma/client";
import { db } from "@/lib/db";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { recordAdminAction } from "@/lib/admin-audit";
import { ConflictError, NotFoundError } from "@/lib/memberships";
import type { UpdateGroupInput } from "@/lib/validation/groups";

function clampPage(value: unknown, fallback = 1): number {
  return Number.isFinite(value as number) ? Math.max(value as number, 1) : fallback;
}

function clampPer(value: unknown, fallback: number, max: number): number {
  return Number.isFinite(value as number) ? Math.min(Math.max(value as number, 1), max) : fallback;
}

async function getGroupBySlugOrThrow(slug: string): Promise<Group> {
  const group = await db.group.findUnique({ where: { slug } });
  if (!group) throw new NotFoundError("Group not found.");
  return group;
}

export type GroupWithCreator = Group & {
  createdBy: Pick<User, "id" | "name" | "email">;
};

export async function getAdminGroupBySlug(slug: string): Promise<GroupWithCreator | null> {
  return db.group.findUnique({
    where: { slug },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function adminArchiveGroup(slug: string, actorUserId: string): Promise<Group> {
  await assertSuperAdmin(actorUserId);
  return db.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { slug } });
    if (!group) throw new NotFoundError("Group not found.");
    if (group.archivedAt) {
      throw new ConflictError("Group is already archived.");
    }
    const updated = await tx.group.update({
      where: { id: group.id },
      data: { archivedAt: new Date() },
    });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "group.archive",
        targetType: "group",
        targetId: group.id,
        metadata: { slug: group.slug, name: group.name },
      },
      tx,
    );
    return updated;
  });
}

export async function adminUnarchiveGroup(slug: string, actorUserId: string): Promise<Group> {
  await assertSuperAdmin(actorUserId);
  return db.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { slug } });
    if (!group) throw new NotFoundError("Group not found.");
    if (!group.archivedAt) {
      throw new ConflictError("Group is not archived.");
    }
    const updated = await tx.group.update({
      where: { id: group.id },
      data: { archivedAt: null },
    });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "group.unarchive",
        targetType: "group",
        targetId: group.id,
        metadata: { slug: group.slug, name: group.name },
      },
      tx,
    );
    return updated;
  });
}

export async function adminDeleteGroup(slug: string, actorUserId: string): Promise<void> {
  await assertSuperAdmin(actorUserId);
  const group = await getGroupBySlugOrThrow(slug);
  // The schema cascades Group -> Memberships, Group -> Questions -> Answers,
  // so a single delete is enough. Votes/favorites on questions/answers are
  // anchored by targetId+targetType rather than FKs; we clean those up here
  // because they'd otherwise be orphaned.
  await db.$transaction(async (tx) => {
    const questionIds = await tx.question.findMany({
      where: { groupId: group.id },
      select: { id: true },
    });
    const qIds = questionIds.map((q) => q.id);
    const answerIds =
      qIds.length === 0
        ? []
        : (
            await tx.answer.findMany({
              where: { questionId: { in: qIds } },
              select: { id: true },
            })
          ).map((a) => a.id);
    const orphanIds = [group.id, ...qIds, ...answerIds];
    if (orphanIds.length > 0) {
      await tx.vote.deleteMany({ where: { targetId: { in: orphanIds } } });
      await tx.favorite.deleteMany({ where: { targetId: { in: orphanIds } } });
    }
    await tx.group.delete({ where: { id: group.id } });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "group.delete",
        targetType: "group",
        targetId: group.id,
        metadata: {
          slug: group.slug,
          name: group.name,
          questionCount: qIds.length,
          answerCount: answerIds.length,
        },
      },
      tx,
    );
  });
}

// Callers MUST pass already-validated input. The matching server action layer
// should run updateGroupSchema.safeParse before calling this — the public-path
// updateGroup() in src/lib/groups.ts has the same contract.
export async function adminUpdateGroup(
  slug: string,
  input: UpdateGroupInput,
  actorUserId: string,
): Promise<Group> {
  await assertSuperAdmin(actorUserId);
  return db.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { slug } });
    if (!group) throw new NotFoundError("Group not found.");
    const data: Prisma.GroupUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.autoApprove !== undefined) data.autoApprove = input.autoApprove;
    const updated = await tx.group.update({ where: { id: group.id }, data });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "group.update",
        targetType: "group",
        targetId: group.id,
        metadata: { changes: input },
      },
      tx,
    );
    return updated;
  });
}

export async function adminSetMembershipRole(
  groupId: string,
  targetUserId: string,
  role: Role,
  actorUserId: string,
): Promise<Membership> {
  await assertSuperAdmin(actorUserId);
  return db.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError("Group not found.");
    const user = await tx.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) throw new NotFoundError("User not found.");
    const existing = await tx.membership.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    const result = existing
      ? await tx.membership.update({
          where: { userId_groupId: { userId: targetUserId, groupId } },
          data: { role, status: "approved" },
        })
      : await tx.membership.create({
          data: { groupId, userId: targetUserId, role, status: "approved" },
        });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: existing ? "membership.role.set" : "membership.create",
        targetType: "membership",
        targetId: result.id,
        metadata: { groupId, userId: targetUserId, role, previousRole: existing?.role ?? null },
      },
      tx,
    );
    return result;
  });
}

export async function adminSetMembershipStatus(
  groupId: string,
  targetUserId: string,
  status: "approved" | "rejected" | "pending",
  actorUserId: string,
): Promise<Membership> {
  await assertSuperAdmin(actorUserId);
  return db.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!existing) throw new NotFoundError("Membership not found.");
    const updated = await tx.membership.update({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      data: { status },
    });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "membership.status.set",
        targetType: "membership",
        targetId: updated.id,
        metadata: { groupId, userId: targetUserId, status, previousStatus: existing.status },
      },
      tx,
    );
    return updated;
  });
}

export async function adminRemoveMembership(
  groupId: string,
  targetUserId: string,
  actorUserId: string,
): Promise<void> {
  await assertSuperAdmin(actorUserId);
  await db.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!existing) throw new NotFoundError("Membership not found.");
    // Detect whether this removal would leave the group ownerless. Capture
    // before the delete so the audit metadata can flag it for later cleanup.
    let wasLastOwner = false;
    if (existing.role === "owner" && existing.status === "approved") {
      const otherOwners = await tx.membership.count({
        where: { groupId, role: "owner", status: "approved", userId: { not: targetUserId } },
      });
      wasLastOwner = otherOwners === 0;
    }
    await tx.membership.delete({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "membership.remove",
        targetType: "membership",
        targetId: existing.id,
        metadata: {
          groupId,
          userId: targetUserId,
          previousRole: existing.role,
          previousStatus: existing.status,
          wasLastOwner,
        },
      },
      tx,
    );
  });
}

export async function adminPromoteUser(targetUserId: string, actorUserId: string): Promise<User> {
  await assertSuperAdmin(actorUserId);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundError("User not found.");
    if (user.isSuperAdmin) return user;
    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { isSuperAdmin: true },
    });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "user.promote",
        targetType: "user",
        targetId: targetUserId,
        metadata: { email: user.email },
      },
      tx,
    );
    return updated;
  });
}

export async function adminDemoteUser(targetUserId: string, actorUserId: string): Promise<User> {
  await assertSuperAdmin(actorUserId);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundError("User not found.");
    if (!user.isSuperAdmin) return user;
    // Check inside the transaction so a concurrent self-demote can't slip past
    // — the count and the update see the same snapshot.
    if (targetUserId === actorUserId) {
      const otherAdmins = await tx.user.count({
        where: { isSuperAdmin: true, id: { not: actorUserId } },
      });
      if (otherAdmins === 0) {
        throw new ConflictError(
          "You're the only super admin. Promote another user before demoting yourself.",
        );
      }
    }
    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { isSuperAdmin: false },
    });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "user.demote",
        targetType: "user",
        targetId: targetUserId,
        metadata: { email: user.email },
      },
      tx,
    );
    return updated;
  });
}

export async function adminDeleteUser(targetUserId: string, actorUserId: string): Promise<void> {
  await assertSuperAdmin(actorUserId);
  if (targetUserId === actorUserId) {
    throw new ConflictError("You cannot delete your own account from /admin.");
  }
  // Question/Answer.authorId is RESTRICT, so explicit delete those first.
  // Votes/favorites on the user's content need targetId-based cleanup too.
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundError("User not found.");
    // Last-super-admin guard runs inside the tx so a concurrent delete cannot
    // race past the check on a snapshot that excludes the other's pending delete.
    if (user.isSuperAdmin) {
      const otherAdmins = await tx.user.count({
        where: { isSuperAdmin: true, id: { not: targetUserId } },
      });
      if (otherAdmins === 0) {
        throw new ConflictError("Cannot delete the last super admin.");
      }
    }
    const userQuestions = await tx.question.findMany({
      where: { authorId: targetUserId },
      select: { id: true },
    });
    const userAnswers = await tx.answer.findMany({
      where: { authorId: targetUserId },
      select: { id: true },
    });
    const contentIds = [...userQuestions.map((q) => q.id), ...userAnswers.map((a) => a.id)];
    if (contentIds.length > 0) {
      await tx.vote.deleteMany({ where: { targetId: { in: contentIds } } });
      await tx.favorite.deleteMany({ where: { targetId: { in: contentIds } } });
    }
    // Delete answers first (Question.acceptedAnswerId is SET NULL on Answer
    // delete, so this won't blow up on accepted-answer references).
    await tx.answer.deleteMany({ where: { authorId: targetUserId } });
    await tx.question.deleteMany({ where: { authorId: targetUserId } });
    // Created groups: createdById is RESTRICT. Reassign to the actor so we
    // don't refuse to delete a user just because they once spun up a group.
    const reassigned = await tx.group.updateMany({
      where: { createdById: targetUserId },
      data: { createdById: actorUserId },
    });
    await tx.user.delete({ where: { id: targetUserId } });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "user.delete",
        targetType: "user",
        targetId: targetUserId,
        metadata: {
          email: user.email,
          questionCount: userQuestions.length,
          answerCount: userAnswers.length,
          reassignedGroupCount: reassigned.count,
        },
      },
      tx,
    );
  });
}

export async function adminDeleteQuestion(questionId: string, actorUserId: string): Promise<void> {
  await assertSuperAdmin(actorUserId);
  await db.$transaction(async (tx) => {
    const question = await tx.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundError("Question not found.");
    const answers = await tx.answer.findMany({
      where: { questionId },
      select: { id: true },
    });
    const ids = [questionId, ...answers.map((a) => a.id)];
    await tx.vote.deleteMany({ where: { targetId: { in: ids } } });
    await tx.favorite.deleteMany({ where: { targetId: { in: ids } } });
    await tx.question.delete({ where: { id: questionId } });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "question.delete",
        targetType: "question",
        targetId: questionId,
        metadata: {
          groupId: question.groupId,
          authorId: question.authorId,
          answerCount: answers.length,
        },
      },
      tx,
    );
  });
}

export async function adminDeleteAnswer(answerId: string, actorUserId: string): Promise<void> {
  await assertSuperAdmin(actorUserId);
  await db.$transaction(async (tx) => {
    const answer = await tx.answer.findUnique({ where: { id: answerId } });
    if (!answer) throw new NotFoundError("Answer not found.");
    await tx.vote.deleteMany({ where: { targetId: answerId } });
    await tx.favorite.deleteMany({ where: { targetId: answerId } });
    await tx.answer.delete({ where: { id: answerId } });
    await recordAdminAction(
      {
        actorId: actorUserId,
        action: "answer.delete",
        targetType: "answer",
        targetId: answerId,
        metadata: { questionId: answer.questionId, authorId: answer.authorId },
      },
      tx,
    );
  });
}

// ---------- Read-side helpers (no auth — caller must gate page access) ----------

export type AdminGroupRow = {
  id: string;
  slug: string;
  name: string;
  archivedAt: Date | null;
  createdAt: Date;
  memberCount: number;
  questionCount: number;
};

export type AdminGroupsPage = {
  items: AdminGroupRow[];
  total: number;
  page: number;
  per: number;
};

export async function listAllGroupsForAdmin(opts: {
  page?: number;
  per?: number;
  includeArchived?: boolean;
}): Promise<AdminGroupsPage> {
  const page = clampPage(opts.page);
  const per = clampPer(opts.per, 25, 100);
  const where = opts.includeArchived === false ? { archivedAt: null } : {};
  const groups = await db.group.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * per,
    take: per,
    select: { id: true, slug: true, name: true, archivedAt: true, createdAt: true },
  });
  const pageGroupIds = groups.map((g) => g.id);
  const [total, memberCounts, questionCounts] = await Promise.all([
    db.group.count({ where }),
    pageGroupIds.length === 0
      ? Promise.resolve([])
      : db.membership.groupBy({
          by: ["groupId"],
          where: { status: "approved", groupId: { in: pageGroupIds } },
          _count: { _all: true },
        }),
    pageGroupIds.length === 0
      ? Promise.resolve([])
      : db.question.groupBy({
          by: ["groupId"],
          where: { deletedAt: null, groupId: { in: pageGroupIds } },
          _count: { _all: true },
        }),
  ]);
  const memberByGroup = new Map(memberCounts.map((m) => [m.groupId, m._count._all]));
  const questionByGroup = new Map(questionCounts.map((q) => [q.groupId, q._count._all]));
  return {
    items: groups.map((g) => ({
      ...g,
      memberCount: memberByGroup.get(g.id) ?? 0,
      questionCount: questionByGroup.get(g.id) ?? 0,
    })),
    total,
    page,
    per,
  };
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  isSuperAdmin: boolean;
  createdAt: Date;
  membershipCount: number;
  questionCount: number;
};

export type AdminUsersPage = {
  items: AdminUserRow[];
  total: number;
  page: number;
  per: number;
};

export async function listAllUsersForAdmin(opts: {
  search?: string;
  page?: number;
  per?: number;
}): Promise<AdminUsersPage> {
  const page = clampPage(opts.page);
  const per = clampPer(opts.per, 25, 100);
  const where: Prisma.UserWhereInput = opts.search
    ? {
        OR: [{ email: { contains: opts.search } }, { name: { contains: opts.search } }],
      }
    : {};
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * per,
      take: per,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
        _count: { select: { memberships: true, questions: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return {
    items: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isSuperAdmin: u.isSuperAdmin,
      createdAt: u.createdAt,
      membershipCount: u._count.memberships,
      questionCount: u._count.questions,
    })),
    total,
    page,
    per,
  };
}

export type AdminGroupMemberRow = {
  membershipId: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: Role;
  status: Membership["status"];
  createdAt: Date;
};

export async function listGroupMembersForAdmin(groupId: string): Promise<AdminGroupMemberRow[]> {
  const rows = await db.membership.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return rows.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    status: m.status,
    createdAt: m.createdAt,
  }));
}

export type AdminQuestionRow = {
  id: string;
  title: string;
  groupId: string;
  groupSlug: string;
  groupName: string;
  authorId: string;
  authorName: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export async function listAllQuestionsForAdmin(opts: {
  page?: number;
  per?: number;
}): Promise<{ items: AdminQuestionRow[]; total: number; page: number; per: number }> {
  const page = clampPage(opts.page);
  const per = clampPer(opts.per, 25, 100);
  const [rows, total] = await Promise.all([
    db.question.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * per,
      take: per,
      include: {
        group: { select: { id: true, slug: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    }),
    db.question.count(),
  ]);
  return {
    items: rows.map((q) => ({
      id: q.id,
      title: q.title,
      groupId: q.group.id,
      groupSlug: q.group.slug,
      groupName: q.group.name,
      authorId: q.author.id,
      authorName: q.author.name,
      createdAt: q.createdAt,
      deletedAt: q.deletedAt,
    })),
    total,
    page,
    per,
  };
}

export type AdminAnswerRow = {
  id: string;
  body: string;
  questionId: string;
  questionTitle: string;
  authorId: string;
  authorName: string | null;
  createdAt: Date;
};

export async function listAllAnswersForAdmin(opts: {
  page?: number;
  per?: number;
}): Promise<{ items: AdminAnswerRow[]; total: number; page: number; per: number }> {
  const page = clampPage(opts.page);
  const per = clampPer(opts.per, 25, 100);
  const [rows, total] = await Promise.all([
    db.answer.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * per,
      take: per,
      include: {
        question: { select: { id: true, title: true } },
        author: { select: { id: true, name: true } },
      },
    }),
    db.answer.count(),
  ]);
  return {
    items: rows.map((a) => ({
      id: a.id,
      body: a.body,
      questionId: a.question.id,
      questionTitle: a.question.title,
      authorId: a.author.id,
      authorName: a.author.name,
      createdAt: a.createdAt,
    })),
    total,
    page,
    per,
  };
}

export type AdminAuditRow = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: string;
  createdAt: Date;
};

export async function listAdminAuditLog(opts: {
  page?: number;
  per?: number;
}): Promise<{ items: AdminAuditRow[]; total: number; page: number; per: number }> {
  const page = clampPage(opts.page);
  const per = clampPer(opts.per, 50, 200);
  const [rows, total] = await Promise.all([
    db.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * per,
      take: per,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    db.adminAuditLog.count(),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorName: r.actor?.name ?? null,
      actorEmail: r.actor?.email ?? null,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata,
      createdAt: r.createdAt,
    })),
    total,
    page,
    per,
  };
}

export type AdminDashboardStats = {
  totalUsers: number;
  totalSuperAdmins: number;
  totalGroups: number;
  archivedGroups: number;
  totalQuestions: number;
  totalAnswers: number;
  recentActions: AdminAuditRow[];
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [
    totalUsers,
    totalSuperAdmins,
    totalGroups,
    archivedGroups,
    totalQuestions,
    totalAnswers,
    recent,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isSuperAdmin: true } }),
    db.group.count(),
    db.group.count({ where: { archivedAt: { not: null } } }),
    db.question.count({ where: { deletedAt: null } }),
    db.answer.count(),
    listAdminAuditLog({ page: 1, per: 10 }),
  ]);
  return {
    totalUsers,
    totalSuperAdmins,
    totalGroups,
    archivedGroups,
    totalQuestions,
    totalAnswers,
    recentActions: recent.items,
  };
}

// Re-export so server actions can detect and map errors centrally.
export type { Group, User, Membership, Question, Answer };
