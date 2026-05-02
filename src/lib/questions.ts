import "server-only";
import type { Answer, Question, User } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/memberships";
import type { CreateQuestionInput } from "@/lib/validation/questions";

export type QuestionAuthor = Pick<User, "id" | "email" | "name">;

export type QuestionListItem = Pick<
  Question,
  "id" | "title" | "status" | "createdAt" | "updatedAt"
> & {
  author: QuestionAuthor;
  answerCount: number;
  voteScore: number;
};

export type QuestionListPage = {
  items: QuestionListItem[];
  total: number;
  page: number;
  per: number;
};

export type QuestionDetail = Question & {
  author: QuestionAuthor;
  group: { id: string; slug: string; name: string };
  answers: Array<
    Pick<Answer, "id" | "body" | "createdAt" | "updatedAt"> & {
      author: QuestionAuthor;
      voteScore: number;
    }
  >;
  voteScore: number;
};

export async function createQuestion(
  input: CreateQuestionInput,
  groupId: string,
  authorId: string,
): Promise<Question> {
  return db.question.create({
    data: {
      groupId,
      authorId,
      title: input.title,
      body: input.body,
    },
  });
}

async function voteScoresFor(targetType: "question" | "answer", ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await db.vote.groupBy({
    by: ["targetId"],
    where: { targetType, targetId: { in: ids } },
    _sum: { value: true },
  });
  return new Map(rows.map((r) => [r.targetId, r._sum.value ?? 0]));
}

export async function listQuestionsForGroup(
  groupId: string,
  opts: { page: number; per: number },
): Promise<QuestionListPage> {
  const skip = (opts.page - 1) * opts.per;
  const [rows, total] = await Promise.all([
    db.question.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      skip,
      take: opts.per,
      include: {
        author: { select: { id: true, email: true, name: true } },
        _count: { select: { answers: true } },
      },
    }),
    db.question.count({ where: { groupId } }),
  ]);

  const scores = await voteScoresFor(
    "question",
    rows.map((r) => r.id),
  );

  const items: QuestionListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: r.author,
    answerCount: r._count.answers,
    voteScore: scores.get(r.id) ?? 0,
  }));

  return { items, total, page: opts.page, per: opts.per };
}

export async function getQuestionById(id: string): Promise<QuestionDetail> {
  const q = await db.question.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, email: true, name: true } },
      group: { select: { id: true, slug: true, name: true } },
      answers: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });
  if (!q) throw new NotFoundError("Question not found.");

  const [questionScores, answerScores] = await Promise.all([
    voteScoresFor("question", [q.id]),
    voteScoresFor(
      "answer",
      q.answers.map((a) => a.id),
    ),
  ]);

  return {
    ...q,
    voteScore: questionScores.get(q.id) ?? 0,
    answers: q.answers.map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      author: a.author,
      voteScore: answerScores.get(a.id) ?? 0,
    })),
  };
}
