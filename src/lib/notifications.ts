import "server-only";
import type { Notification, Question } from "@prisma/client";
import { db } from "@/lib/db";
import { listApprovedMemberIds, NotFoundError } from "@/lib/memberships";

export const QUESTION_CREATED = "question.created" as const;

export type QuestionCreatedPayload = {
  questionId: string;
  questionTitle: string;
  groupSlug: string;
  groupName: string;
  authorName: string | null;
};

export type ParsedNotification = Omit<Notification, "payload"> & {
  payload: QuestionCreatedPayload;
};

export type NotificationListResult = {
  items: ParsedNotification[];
  unreadCount: number;
};

export function parsePayload(n: Notification): ParsedNotification {
  return { ...n, payload: JSON.parse(n.payload) as QuestionCreatedPayload };
}

export async function notifyQuestionCreated(
  question: Question,
  group: { id: string; slug: string; name: string },
  authorName: string | null,
): Promise<number> {
  const memberIds = await listApprovedMemberIds(group.id);
  const recipients = memberIds.filter((id) => id !== question.authorId);
  if (recipients.length === 0) return 0;

  const payload: QuestionCreatedPayload = {
    questionId: question.id,
    questionTitle: question.title,
    groupSlug: group.slug,
    groupName: group.name,
    authorName,
  };
  const payloadJson = JSON.stringify(payload);

  const result = await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: QUESTION_CREATED,
      payload: payloadJson,
    })),
  });
  return result.count;
}

export async function listForUser(
  userId: string,
  opts: { limit?: number } = {},
): Promise<NotificationListResult> {
  const limit = opts.limit ?? 20;
  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  const parsed = rows.map(parsePayload);
  const referencedQuestionIds = Array.from(
    new Set(parsed.map((p) => p.payload.questionId)),
  );
  const deletedIds = referencedQuestionIds.length
    ? new Set(
        (
          await db.question.findMany({
            where: {
              id: { in: referencedQuestionIds },
              deletedAt: { not: null },
            },
            select: { id: true },
          })
        ).map((q) => q.id),
      )
    : new Set<string>();

  const items = parsed.filter((p) => !deletedIds.has(p.payload.questionId));
  return { items, unreadCount };
}

export async function markRead(
  notificationId: string,
  userId: string,
): Promise<ParsedNotification> {
  const existing = await db.notification.findUnique({ where: { id: notificationId } });
  if (!existing || existing.userId !== userId) {
    throw new NotFoundError("Notification not found.");
  }
  if (existing.readAt) return parsePayload(existing);
  const updated = await db.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  return parsePayload(updated);
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
