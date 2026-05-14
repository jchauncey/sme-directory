import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

export type AdminAction =
  | "group.archive"
  | "group.unarchive"
  | "group.delete"
  | "group.update"
  | "membership.role.set"
  | "membership.status.set"
  | "membership.remove"
  | "membership.create"
  | "user.promote"
  | "user.demote"
  | "user.delete"
  | "question.delete"
  | "answer.delete";

export type AdminTargetType = "group" | "user" | "membership" | "question" | "answer";

export type AdminAuditRecord = {
  actorId: string;
  action: AdminAction;
  targetType: AdminTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
};

type TxClient = Prisma.TransactionClient | PrismaClient;

export async function recordAdminAction(
  record: AdminAuditRecord,
  tx: TxClient = db,
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      actorId: record.actorId,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      metadata: JSON.stringify(record.metadata ?? {}),
    },
  });
}
