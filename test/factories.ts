import type { PrismaClient } from "@prisma/client";

let counter = 0;
/** Stable-ish unique suffix combining time and a monotonic counter. */
export function uniqueId(label = "id"): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}`;
}

export type MakeUserOpts = {
  email?: string;
  name?: string | null;
};

export async function makeUser(db: PrismaClient, opts: MakeUserOpts = {}) {
  return db.user.create({
    data: {
      email: opts.email ?? `${uniqueId("u")}@example.com`,
      name: opts.name ?? null,
    },
  });
}

export type MakeGroupOpts = {
  ownerId?: string;
  slug?: string;
  name?: string;
  autoApprove?: boolean;
};

/**
 * Creates a Group plus an approved owner Membership, mirroring the
 * `createGroup` transaction. If `ownerId` is omitted, a fresh owner User is
 * created and returned alongside the group.
 */
export async function makeGroup(db: PrismaClient, opts: MakeGroupOpts = {}) {
  const owner = opts.ownerId
    ? await db.user.findUniqueOrThrow({ where: { id: opts.ownerId } })
    : await makeUser(db, { name: "Owner" });
  const group = await db.group.create({
    data: {
      slug: opts.slug ?? uniqueId("g"),
      name: opts.name ?? "Group",
      createdById: owner.id,
      autoApprove: opts.autoApprove ?? false,
    },
  });
  await db.membership.create({
    data: {
      groupId: group.id,
      userId: owner.id,
      role: "owner",
      status: "approved",
    },
  });
  return { owner, group };
}

export type MakeQuestionOpts = {
  groupId: string;
  authorId: string;
  title?: string;
  body?: string;
};

export async function makeQuestion(db: PrismaClient, opts: MakeQuestionOpts) {
  return db.question.create({
    data: {
      groupId: opts.groupId,
      authorId: opts.authorId,
      title: opts.title ?? "Question title",
      body: opts.body ?? "Question body",
    },
  });
}

export type MakeAnswerOpts = {
  questionId: string;
  authorId: string;
  body?: string;
};

export async function makeAnswer(db: PrismaClient, opts: MakeAnswerOpts) {
  return db.answer.create({
    data: {
      questionId: opts.questionId,
      authorId: opts.authorId,
      body: opts.body ?? "Answer body",
    },
  });
}
