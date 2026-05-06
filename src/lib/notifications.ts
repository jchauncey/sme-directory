import "server-only";
import type { Notification, Question } from "@prisma/client";
import { db } from "@/lib/db";
import { listApprovedMemberIds, NotFoundError } from "@/lib/memberships";

export const QUESTION_CREATED = "question.created" as const;
export const ANSWER_POSTED = "answer.posted" as const;
export const ANSWER_ACCEPTED = "answer.accepted" as const;
export const MEMBERSHIP_APPROVED = "membership.approved" as const;
export const MEMBERSHIP_REJECTED = "membership.rejected" as const;

export type QuestionCreatedPayload = {
  questionId: string;
  questionTitle: string;
  groupSlug: string;
  groupName: string;
  authorName: string | null;
};

export type AnswerPostedPayload = {
  questionId: string;
  questionTitle: string;
  groupSlug: string;
  groupName: string;
  answerId: string;
  answererName: string | null;
};

export type AnswerAcceptedPayload = {
  questionId: string;
  questionTitle: string;
  groupSlug: string;
  groupName: string;
  answerId: string;
  actorName: string | null;
};

export type MembershipDecisionPayload = {
  groupSlug: string;
  groupName: string;
  actorName: string | null;
};

type NotificationBase = Omit<Notification, "type" | "payload">;

export type ParsedNotification =
  | (NotificationBase & {
      type: typeof QUESTION_CREATED;
      payload: QuestionCreatedPayload;
    })
  | (NotificationBase & {
      type: typeof ANSWER_POSTED;
      payload: AnswerPostedPayload;
    })
  | (NotificationBase & {
      type: typeof ANSWER_ACCEPTED;
      payload: AnswerAcceptedPayload;
    })
  | (NotificationBase & {
      type: typeof MEMBERSHIP_APPROVED;
      payload: MembershipDecisionPayload;
    })
  | (NotificationBase & {
      type: typeof MEMBERSHIP_REJECTED;
      payload: MembershipDecisionPayload;
    });

export type NotificationListResult = {
  items: ParsedNotification[];
  unreadCount: number;
};

const QUESTION_REF_TYPES: ReadonlySet<string> = new Set([
  QUESTION_CREATED,
  ANSWER_POSTED,
  ANSWER_ACCEPTED,
]);

export function parsePayload(n: Notification): ParsedNotification {
  const payload = JSON.parse(n.payload) as
    | QuestionCreatedPayload
    | AnswerPostedPayload
    | AnswerAcceptedPayload
    | MembershipDecisionPayload;
  // The discriminator is the row's `type` column; the union narrows on it.
  return { ...n, payload } as ParsedNotification;
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

export async function notifyAnswerPosted(
  answer: { id: string; authorId: string },
  question: { id: string; title: string; authorId: string },
  group: { slug: string; name: string },
  answererName: string | null,
): Promise<number> {
  if (question.authorId === answer.authorId) return 0;

  const payload: AnswerPostedPayload = {
    questionId: question.id,
    questionTitle: question.title,
    groupSlug: group.slug,
    groupName: group.name,
    answerId: answer.id,
    answererName,
  };
  await db.notification.create({
    data: {
      userId: question.authorId,
      type: ANSWER_POSTED,
      payload: JSON.stringify(payload),
    },
  });
  return 1;
}

export async function notifyAnswerAccepted(
  answer: { id: string; authorId: string },
  question: { id: string; title: string },
  group: { slug: string; name: string },
  actor: { id: string; name: string | null },
): Promise<number> {
  if (answer.authorId === actor.id) return 0;

  const payload: AnswerAcceptedPayload = {
    questionId: question.id,
    questionTitle: question.title,
    groupSlug: group.slug,
    groupName: group.name,
    answerId: answer.id,
    actorName: actor.name,
  };
  await db.notification.create({
    data: {
      userId: answer.authorId,
      type: ANSWER_ACCEPTED,
      payload: JSON.stringify(payload),
    },
  });
  return 1;
}

export async function notifyMembershipDecision(
  status: "approved" | "rejected",
  targetUserId: string,
  group: { slug: string; name: string },
  actor: { id: string; name: string | null },
): Promise<number> {
  if (targetUserId === actor.id) return 0;

  const payload: MembershipDecisionPayload = {
    groupSlug: group.slug,
    groupName: group.name,
    actorName: actor.name,
  };
  await db.notification.create({
    data: {
      userId: targetUserId,
      type: status === "approved" ? MEMBERSHIP_APPROVED : MEMBERSHIP_REJECTED,
      payload: JSON.stringify(payload),
    },
  });
  return 1;
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
    new Set(
      parsed
        .filter((p) => QUESTION_REF_TYPES.has(p.type))
        .map((p) => (p.payload as { questionId: string }).questionId),
    ),
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

  const items = parsed.filter((p) => {
    if (!QUESTION_REF_TYPES.has(p.type)) return true;
    return !deletedIds.has((p.payload as { questionId: string }).questionId);
  });
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
