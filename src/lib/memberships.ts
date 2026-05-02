import "server-only";
import type { Membership, User } from "@prisma/client";
import { db } from "@/lib/db";

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly code = "CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotAMemberError extends Error {
  readonly code = "NOT_A_MEMBER" as const;
  constructor(message = "You are not a member of this group.") {
    super(message);
    this.name = "NotAMemberError";
  }
}

export class SoleOwnerCannotLeaveError extends Error {
  readonly code = "SOLE_OWNER" as const;
  constructor(
    message = "You're the only owner. Promote another member to owner before leaving.",
  ) {
    super(message);
    this.name = "SoleOwnerCannotLeaveError";
  }
}

export class InvalidSuccessorError extends Error {
  readonly code = "INVALID_SUCCESSOR" as const;
  constructor(message = "The chosen successor is not an approved member of this group.") {
    super(message);
    this.name = "InvalidSuccessorError";
  }
}

export async function getMembership(groupId: string, userId: string): Promise<Membership | null> {
  return db.membership.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
}

export async function isOwner(groupId: string, userId: string): Promise<boolean> {
  const m = await getMembership(groupId, userId);
  return m?.role === "owner" && m.status === "approved";
}

export async function assertOwner(groupId: string, userId: string): Promise<void> {
  if (!(await isOwner(groupId, userId))) {
    throw new AuthorizationError();
  }
}

export async function isOwnerOrModerator(groupId: string, userId: string): Promise<boolean> {
  const m = await getMembership(groupId, userId);
  if (!m || m.status !== "approved") return false;
  return m.role === "owner" || m.role === "moderator";
}

export async function assertOwnerOrModerator(groupId: string, userId: string): Promise<void> {
  if (!(await isOwnerOrModerator(groupId, userId))) {
    throw new AuthorizationError();
  }
}

export async function applyToGroup(groupId: string, userId: string): Promise<Membership> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { autoApprove: true },
  });
  if (!group) throw new NotFoundError("Group not found.");

  const existing = await getMembership(groupId, userId);
  if (existing) {
    if (existing.status === "approved" || existing.status === "pending") {
      return existing;
    }
    return db.membership.update({
      where: { userId_groupId: { userId, groupId } },
      data: { status: group.autoApprove ? "approved" : "pending" },
    });
  }

  return db.membership.create({
    data: {
      groupId,
      userId,
      role: "member",
      status: group.autoApprove ? "approved" : "pending",
    },
  });
}

export async function setMembershipStatus(
  groupId: string,
  targetUserId: string,
  status: "approved" | "rejected",
  actorUserId: string,
): Promise<Membership> {
  await assertOwnerOrModerator(groupId, actorUserId);
  const target = await getMembership(groupId, targetUserId);
  if (!target) throw new NotFoundError("Membership not found.");
  if (target.role === "owner") {
    throw new AuthorizationError("The group owner's membership cannot be changed.");
  }
  if (target.status === status) return target;
  return db.membership.update({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    data: { status },
  });
}

export async function removeMembership(
  groupId: string,
  targetUserId: string,
  actorUserId: string,
): Promise<void> {
  const target = await getMembership(groupId, targetUserId);
  if (!target) throw new NotFoundError("Membership not found.");

  if (target.role === "owner") {
    throw new ConflictError("The group owner cannot be removed.");
  }

  if (actorUserId !== targetUserId) {
    if (!(await isOwner(groupId, actorUserId))) {
      throw new AuthorizationError();
    }
  }

  await db.membership.delete({
    where: { userId_groupId: { userId: targetUserId, groupId } },
  });
}

export type PendingApplication = Membership & {
  user: Pick<User, "id" | "email" | "name">;
};

export async function listPendingApplications(groupId: string): Promise<PendingApplication[]> {
  return db.membership.findMany({
    where: { groupId, status: "pending" },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export type UserMembershipState = Pick<Membership, "status" | "role">;

export async function getUserMembershipStatus(
  groupId: string,
  userId: string,
): Promise<UserMembershipState | null> {
  const m = await getMembership(groupId, userId);
  if (!m) return null;
  return { status: m.status, role: m.role };
}

export async function countApprovedMembers(groupId: string): Promise<number> {
  return db.membership.count({
    where: { groupId, status: "approved" },
  });
}

export type ApprovedMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: Membership["role"];
};

export async function listApprovedMembers(
  groupId: string,
  limit: number,
): Promise<ApprovedMember[]> {
  const rows = await db.membership.findMany({
    where: { groupId, status: "approved" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}

export async function listSuccessorCandidates(
  groupId: string,
  excludingUserId: string,
): Promise<ApprovedMember[]> {
  const rows = await db.membership.findMany({
    where: {
      groupId,
      status: "approved",
      userId: { not: excludingUserId },
    },
    orderBy: [{ createdAt: "asc" }],
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) throw new NotAMemberError();
    if (membership.role === "owner" && membership.status === "approved") {
      const otherOwners = await tx.membership.count({
        where: {
          groupId,
          role: "owner",
          status: "approved",
          userId: { not: userId },
        },
      });
      if (otherOwners === 0) throw new SoleOwnerCannotLeaveError();
    }
    await tx.membership.delete({
      where: { userId_groupId: { userId, groupId } },
    });
  });
}

export async function transferOwnershipAndLeave(
  groupId: string,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  if (fromUserId === toUserId) {
    throw new InvalidSuccessorError("Successor must be a different user.");
  }
  await db.$transaction(async (tx) => {
    const caller = await tx.membership.findUnique({
      where: { userId_groupId: { userId: fromUserId, groupId } },
    });
    if (!caller) throw new NotAMemberError();
    if (!(caller.role === "owner" && caller.status === "approved")) {
      throw new AuthorizationError("Only an approved owner can transfer ownership.");
    }
    const successor = await tx.membership.findUnique({
      where: { userId_groupId: { userId: toUserId, groupId } },
    });
    if (!successor || successor.status !== "approved") {
      throw new InvalidSuccessorError();
    }
    await tx.membership.update({
      where: { userId_groupId: { userId: toUserId, groupId } },
      data: { role: "owner" },
    });
    await tx.membership.delete({
      where: { userId_groupId: { userId: fromUserId, groupId } },
    });
  });
}
