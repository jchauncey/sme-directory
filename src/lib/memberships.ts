import "server-only";
import type { Membership } from "@prisma/client";
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
