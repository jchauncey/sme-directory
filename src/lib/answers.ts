import "server-only";
import type { Answer } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  NotFoundError,
  assertOwnerOrModerator,
} from "@/lib/memberships";
import type {
  CreateAnswerInput,
  UpdateAnswerInput,
} from "@/lib/validation/answers";

export type AnswerWithQuestion = Answer & {
  question: { id: string; groupId: string; authorId: string };
};

export async function createAnswer(
  input: CreateAnswerInput,
  questionId: string,
  authorId: string,
): Promise<Answer> {
  return db.answer.create({
    data: {
      questionId,
      authorId,
      body: input.body,
    },
  });
}

export async function getAnswerWithQuestion(
  answerId: string,
): Promise<AnswerWithQuestion> {
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    include: {
      question: { select: { id: true, groupId: true, authorId: true } },
    },
  });
  if (!answer) throw new NotFoundError("Answer not found.");
  return answer;
}

export async function updateAnswer(
  answerId: string,
  input: UpdateAnswerInput,
  userId: string,
): Promise<Answer> {
  const existing = await getAnswerWithQuestion(answerId);
  if (existing.authorId !== userId) {
    throw new AuthorizationError("Only the answer's author can edit it.");
  }
  return db.answer.update({
    where: { id: answerId },
    data: { body: input.body },
  });
}

export async function deleteAnswer(
  answerId: string,
  userId: string,
): Promise<void> {
  const existing = await getAnswerWithQuestion(answerId);
  await assertOwnerOrModerator(existing.question.groupId, userId);
  await db.answer.delete({ where: { id: answerId } });
}
