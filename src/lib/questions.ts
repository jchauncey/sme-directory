import "server-only";
import type { Answer, Question, User } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  NotFoundError,
  isOwnerOrModerator,
} from "@/lib/memberships";
import { viewerVotesFor, voteScoresFor } from "@/lib/votes";
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
      viewerVote: 1 | null;
    }
  >;
  voteScore: number;
  viewerVote: 1 | null;
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

export async function getQuestionById(
  id: string,
  viewerUserId?: string,
): Promise<QuestionDetail> {
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

  const answerIds = q.answers.map((a) => a.id);

  const [questionScores, answerScores, viewerQuestionVotes, viewerAnswerVotes] =
    await Promise.all([
      voteScoresFor("question", [q.id]),
      voteScoresFor("answer", answerIds),
      viewerUserId
        ? viewerVotesFor("question", [q.id], viewerUserId)
        : Promise.resolve(new Map<string, 1>()),
      viewerUserId
        ? viewerVotesFor("answer", answerIds, viewerUserId)
        : Promise.resolve(new Map<string, 1>()),
    ]);

  const mappedAnswers = q.answers.map((a) => ({
    id: a.id,
    body: a.body,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    author: a.author,
    voteScore: answerScores.get(a.id) ?? 0,
    viewerVote: viewerAnswerVotes.get(a.id) ?? null,
  }));
  const acceptedId = q.acceptedAnswerId;
  const sortedAnswers = acceptedId
    ? [...mappedAnswers].sort((a, b) => {
        if (a.id === acceptedId) return -1;
        if (b.id === acceptedId) return 1;
        return 0;
      })
    : mappedAnswers;

  return {
    ...q,
    voteScore: questionScores.get(q.id) ?? 0,
    viewerVote: viewerQuestionVotes.get(q.id) ?? null,
    answers: sortedAnswers,
  };
}

async function assertCanResolveQuestion(
  question: { authorId: string; groupId: string },
  userId: string,
): Promise<void> {
  if (question.authorId === userId) return;
  if (await isOwnerOrModerator(question.groupId, userId)) return;
  throw new AuthorizationError(
    "Only the question's author or a group moderator/owner can resolve this question.",
  );
}

export async function acceptAnswer(
  questionId: string,
  answerId: string | null,
  userId: string,
): Promise<Question> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true, authorId: true, groupId: true },
  });
  if (!question) throw new NotFoundError("Question not found.");

  await assertCanResolveQuestion(question, userId);

  if (answerId) {
    const answer = await db.answer.findUnique({
      where: { id: answerId },
      select: { id: true, questionId: true },
    });
    if (!answer || answer.questionId !== questionId) {
      throw new NotFoundError("Answer not found for this question.");
    }
  }

  return db.question.update({
    where: { id: questionId },
    data: { status: "answered", acceptedAnswerId: answerId },
  });
}

export async function reopenQuestion(
  questionId: string,
  userId: string,
): Promise<Question> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true, authorId: true, groupId: true },
  });
  if (!question) throw new NotFoundError("Question not found.");

  await assertCanResolveQuestion(question, userId);

  return db.question.update({
    where: { id: questionId },
    data: { status: "open", acceptedAnswerId: null },
  });
}
