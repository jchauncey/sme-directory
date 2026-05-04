import "server-only";
import { Prisma, type TargetType } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/memberships";

export type FavoriteTargetType = TargetType;

export type ToggleFavoriteResult = {
  favorited: boolean;
  targetType: FavoriteTargetType;
  targetId: string;
};

export type FavoritedQuestion = {
  id: string;
  title: string;
  status: "open" | "answered";
  createdAt: Date;
  favoritedAt: Date;
  author: { id: string; email: string | null; name: string | null };
  group: { id: string; slug: string; name: string };
};

export type FavoritedAnswer = {
  id: string;
  body: string;
  createdAt: Date;
  favoritedAt: Date;
  author: { id: string; email: string | null; name: string | null };
  question: { id: string; title: string };
};

export type FavoritesForUser = {
  questions: FavoritedQuestion[];
  answers: FavoritedAnswer[];
};

export async function viewerFavoritesFor(
  targetType: FavoriteTargetType,
  ids: string[],
  userId: string,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set<string>();
  const rows = await db.favorite.findMany({
    where: { userId, targetType, targetId: { in: ids } },
    select: { targetId: true },
  });
  return new Set(rows.map((r) => r.targetId));
}

async function assertTargetExists(
  targetType: FavoriteTargetType,
  targetId: string,
): Promise<void> {
  if (targetType === "question") {
    const q = await db.question.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!q) throw new NotFoundError("Question not found.");
    return;
  }
  const a = await db.answer.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!a) throw new NotFoundError("Answer not found.");
}

export async function toggleFavorite(
  input: { targetType: FavoriteTargetType; targetId: string },
  userId: string,
): Promise<ToggleFavoriteResult> {
  await assertTargetExists(input.targetType, input.targetId);

  const existing = await db.favorite.findUnique({
    where: {
      userId_targetType_targetId: {
        userId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    },
    select: { id: true },
  });

  let favorited: boolean;
  if (existing) {
    try {
      await db.favorite.delete({ where: { id: existing.id } });
    } catch (err) {
      // P2025: row already removed by a concurrent request — same outcome.
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      ) {
        throw err;
      }
    }
    favorited = false;
  } else {
    try {
      await db.favorite.create({
        data: {
          userId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      });
    } catch (err) {
      // P2002: a concurrent request inserted the same row — same outcome.
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      ) {
        throw err;
      }
    }
    favorited = true;
  }

  return {
    favorited,
    targetType: input.targetType,
    targetId: input.targetId,
  };
}

export async function listFavoritesForUser(
  userId: string,
): Promise<FavoritesForUser> {
  const rows = await db.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { targetType: true, targetId: true, createdAt: true },
  });

  const questionIds: string[] = [];
  const answerIds: string[] = [];
  const favoritedAt = new Map<string, Date>();
  for (const r of rows) {
    favoritedAt.set(`${r.targetType}:${r.targetId}`, r.createdAt);
    if (r.targetType === "question") questionIds.push(r.targetId);
    else answerIds.push(r.targetId);
  }

  const [questionRows, answerRows] = await Promise.all([
    questionIds.length === 0
      ? Promise.resolve([])
      : db.question.findMany({
          where: { id: { in: questionIds } },
          include: {
            author: { select: { id: true, email: true, name: true } },
            group: { select: { id: true, slug: true, name: true } },
          },
        }),
    answerIds.length === 0
      ? Promise.resolve([])
      : db.answer.findMany({
          where: { id: { in: answerIds } },
          include: {
            author: { select: { id: true, email: true, name: true } },
            question: { select: { id: true, title: true } },
          },
        }),
  ]);

  const questionsById = new Map(questionRows.map((q) => [q.id, q]));
  const answersById = new Map(answerRows.map((a) => [a.id, a]));

  const questions: FavoritedQuestion[] = [];
  const answers: FavoritedAnswer[] = [];
  for (const r of rows) {
    if (r.targetType === "question") {
      const q = questionsById.get(r.targetId);
      if (!q) continue;
      questions.push({
        id: q.id,
        title: q.title,
        status: q.status,
        createdAt: q.createdAt,
        favoritedAt: r.createdAt,
        author: q.author,
        group: q.group,
      });
    } else {
      const a = answersById.get(r.targetId);
      if (!a) continue;
      answers.push({
        id: a.id,
        body: a.body,
        createdAt: a.createdAt,
        favoritedAt: r.createdAt,
        author: a.author,
        question: a.question,
      });
    }
  }

  return { questions, answers };
}
