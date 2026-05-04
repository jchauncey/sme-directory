import "server-only";
import type {
  MembershipStatus,
  QuestionStatus,
  Role,
  User,
} from "@prisma/client";
import { db } from "@/lib/db";
import { voteScoresFor } from "@/lib/votes";

export type ProfileQuestionAuthor = Pick<User, "id" | "email" | "name">;

export type ProfileQuestionItem = {
  id: string;
  title: string;
  status: QuestionStatus;
  createdAt: Date;
  updatedAt: Date;
  author: ProfileQuestionAuthor;
  answerCount: number;
  voteScore: number;
  group: { id: string; slug: string; name: string };
};

export type ProfileQuestionPage = {
  items: ProfileQuestionItem[];
  total: number;
  page: number;
  per: number;
};

export type ProfileAnswerItem = {
  id: string;
  bodyExcerpt: string;
  createdAt: Date;
  updatedAt: Date;
  voteScore: number;
  isAccepted: boolean;
  question: {
    id: string;
    title: string;
    status: QuestionStatus;
    group: { slug: string; name: string };
  };
};

export type ProfileAnswerPage = {
  items: ProfileAnswerItem[];
  total: number;
  page: number;
  per: number;
};

export type ProfileGroupItem = {
  id: string;
  slug: string;
  name: string;
  role: Role;
  status: MembershipStatus;
  joinedAt: Date;
};

export type ProfileFavoriteItem =
  | {
      kind: "question";
      id: string;
      title: string;
      groupSlug: string;
      groupName: string;
      favoritedAt: Date;
    }
  | {
      kind: "answer";
      id: string;
      bodyExcerpt: string;
      questionId: string;
      questionTitle: string;
      favoritedAt: Date;
    };

const EXCERPT_LENGTH = 200;

function excerpt(body: string): string {
  if (body.length <= EXCERPT_LENGTH) return body;
  return `${body.slice(0, EXCERPT_LENGTH)}…`;
}

export async function listQuestionsByAuthor(
  userId: string,
  opts: { page: number; per: number },
): Promise<ProfileQuestionPage> {
  const skip = (opts.page - 1) * opts.per;
  const [rows, total] = await Promise.all([
    db.question.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: opts.per,
      include: {
        author: { select: { id: true, email: true, name: true } },
        group: { select: { id: true, slug: true, name: true } },
        _count: { select: { answers: true } },
      },
    }),
    db.question.count({ where: { authorId: userId } }),
  ]);

  const scores = await voteScoresFor(
    "question",
    rows.map((r) => r.id),
  );

  const items: ProfileQuestionItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: r.author,
    answerCount: r._count.answers,
    voteScore: scores.get(r.id) ?? 0,
    group: r.group,
  }));

  return { items, total, page: opts.page, per: opts.per };
}

export async function listAnswersByAuthor(
  userId: string,
  opts: { page: number; per: number },
): Promise<ProfileAnswerPage> {
  const skip = (opts.page - 1) * opts.per;
  const [rows, total] = await Promise.all([
    db.answer.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: opts.per,
      include: {
        question: {
          select: {
            id: true,
            title: true,
            status: true,
            acceptedAnswerId: true,
            group: { select: { slug: true, name: true } },
          },
        },
      },
    }),
    db.answer.count({ where: { authorId: userId } }),
  ]);

  const scores = await voteScoresFor(
    "answer",
    rows.map((r) => r.id),
  );

  const items: ProfileAnswerItem[] = rows.map((r) => ({
    id: r.id,
    bodyExcerpt: excerpt(r.body),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    voteScore: scores.get(r.id) ?? 0,
    isAccepted: r.question.acceptedAnswerId === r.id,
    question: {
      id: r.question.id,
      title: r.question.title,
      status: r.question.status,
      group: r.question.group,
    },
  }));

  return { items, total, page: opts.page, per: opts.per };
}

export async function listGroupsForUser(
  userId: string,
  opts: { includePending: boolean },
): Promise<ProfileGroupItem[]> {
  const rows = await db.membership.findMany({
    where: {
      userId,
      ...(opts.includePending ? {} : { status: "approved" }),
    },
    orderBy: { createdAt: "asc" },
    include: { group: { select: { id: true, slug: true, name: true } } },
  });

  return rows.map((m) => ({
    id: m.group.id,
    slug: m.group.slug,
    name: m.group.name,
    role: m.role,
    status: m.status,
    joinedAt: m.createdAt,
  }));
}

export async function listFavoritesByUser(
  userId: string,
): Promise<ProfileFavoriteItem[]> {
  const favorites = await db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (favorites.length === 0) return [];

  const questionIds = favorites
    .filter((f) => f.targetType === "question")
    .map((f) => f.targetId);
  const answerIds = favorites
    .filter((f) => f.targetType === "answer")
    .map((f) => f.targetId);

  const [questions, answers] = await Promise.all([
    questionIds.length
      ? db.question.findMany({
          where: { id: { in: questionIds } },
          select: {
            id: true,
            title: true,
            group: { select: { slug: true, name: true } },
          },
        })
      : Promise.resolve(
          [] as Array<{
            id: string;
            title: string;
            group: { slug: string; name: string };
          }>,
        ),
    answerIds.length
      ? db.answer.findMany({
          where: { id: { in: answerIds } },
          select: {
            id: true,
            body: true,
            question: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve(
          [] as Array<{
            id: string;
            body: string;
            question: { id: string; title: string };
          }>,
        ),
  ]);

  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const answersById = new Map(answers.map((a) => [a.id, a]));

  const items: ProfileFavoriteItem[] = [];
  for (const f of favorites) {
    if (f.targetType === "question") {
      const q = questionsById.get(f.targetId);
      if (!q) continue;
      items.push({
        kind: "question",
        id: q.id,
        title: q.title,
        groupSlug: q.group.slug,
        groupName: q.group.name,
        favoritedAt: f.createdAt,
      });
    } else {
      const a = answersById.get(f.targetId);
      if (!a) continue;
      items.push({
        kind: "answer",
        id: a.id,
        bodyExcerpt: excerpt(a.body),
        questionId: a.question.id,
        questionTitle: a.question.title,
        favoritedAt: f.createdAt,
      });
    }
  }
  return items;
}

export async function getPublicUserProfile(
  userId: string,
): Promise<{ id: string; name: string | null } | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  return user;
}
