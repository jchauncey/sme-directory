"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  AuthorizationError,
  NotFoundError,
  assertApprovedMember,
} from "@/lib/memberships";
import {
  createAnswer,
  deleteAnswer,
  updateAnswer,
} from "@/lib/answers";
import {
  acceptAnswer,
  reopenQuestion,
  softDeleteQuestion,
  updateQuestion,
} from "@/lib/questions";
import { db } from "@/lib/db";
import {
  createAnswerSchema,
  updateAnswerSchema,
} from "@/lib/validation/answers";
import { updateQuestionSchema } from "@/lib/validation/questions";

export type FieldError = { path: string; message: string };

export type AnswerFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: FieldError[];
  values?: { body?: string };
};

export async function createAnswerAction(
  questionId: string,
  _prev: AnswerFormState,
  formData: FormData,
): Promise<AnswerFormState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to post an answer." };
  }

  const raw = { body: String(formData.get("body") ?? "") };
  const parsed = createAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      values: raw,
    };
  }

  try {
    const question = await db.question.findUnique({
      where: { id: questionId },
      select: { id: true, groupId: true, deletedAt: true },
    });
    if (!question || question.deletedAt) {
      return { error: "Question not found.", values: raw };
    }
    await assertApprovedMember(question.groupId, session.user.id);
    await createAnswer(parsed.data, question.id, session.user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        error: "You must be an approved member of this group to post an answer.",
        values: raw,
      };
    }
    if (err instanceof NotFoundError) {
      return { error: err.message, values: raw };
    }
    return {
      error: err instanceof Error ? err.message : "Could not post answer.",
      values: raw,
    };
  }

  revalidatePath(`/q/${questionId}`);
  return { ok: true };
}

export async function updateAnswerAction(
  answerId: string,
  questionId: string,
  _prev: AnswerFormState,
  formData: FormData,
): Promise<AnswerFormState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to edit an answer." };
  }

  const raw = { body: String(formData.get("body") ?? "") };
  const parsed = updateAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      values: raw,
    };
  }

  try {
    await updateAnswer(answerId, parsed.data, session.user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: "Only the answer's author can edit it.", values: raw };
    }
    if (err instanceof NotFoundError) {
      return { error: err.message, values: raw };
    }
    return {
      error: err instanceof Error ? err.message : "Could not update answer.",
      values: raw,
    };
  }

  revalidatePath(`/q/${questionId}`);
  return { ok: true };
}

export type QuestionFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: FieldError[];
  values?: { title?: string; body?: string };
};

export async function updateQuestionAction(
  questionId: string,
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to edit a question." };
  }

  const raw = {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
  const parsed = updateQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      values: raw,
    };
  }

  try {
    await updateQuestion(questionId, parsed.data, session.user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: "Only the question's author can edit it.", values: raw };
    }
    if (err instanceof NotFoundError) {
      return { error: err.message, values: raw };
    }
    return {
      error: err instanceof Error ? err.message : "Could not update question.",
      values: raw,
    };
  }

  revalidatePath(`/q/${questionId}`);
  return { ok: true };
}

export type ResolveQuestionResult = { error?: string; ok?: boolean };

export async function acceptAnswerAction(
  questionId: string,
  answerId: string | null,
): Promise<ResolveQuestionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to mark a question as answered." };
  }

  try {
    await acceptAnswer(questionId, answerId, session.user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        error:
          "Only the question's author or a group moderator/owner can mark this question as answered.",
      };
    }
    if (err instanceof NotFoundError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Could not mark question as answered.",
    };
  }

  revalidatePath(`/q/${questionId}`);
  return { ok: true };
}

export async function reopenQuestionAction(
  questionId: string,
): Promise<ResolveQuestionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to reopen a question." };
  }

  try {
    await reopenQuestion(questionId, session.user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        error:
          "Only the question's author or a group moderator/owner can reopen this question.",
      };
    }
    if (err instanceof NotFoundError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Could not reopen question.",
    };
  }

  revalidatePath(`/q/${questionId}`);
  return { ok: true };
}

export type DeleteQuestionResult = { error?: string; ok?: boolean };

export async function deleteQuestionAction(
  questionId: string,
): Promise<DeleteQuestionResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to delete a question." };
  }

  let groupSlug: string | null = null;
  try {
    const result = await softDeleteQuestion(questionId, session.user.id);
    groupSlug = result.groupSlug;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        error:
          "Only the question's author or a group moderator/owner can delete this question.",
      };
    }
    if (err instanceof NotFoundError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Could not delete question.",
    };
  }

  revalidatePath(`/q/${questionId}`);
  if (groupSlug) revalidatePath(`/groups/${groupSlug}`);
  return { ok: true };
}

export type DeleteAnswerResult = { error?: string; ok?: boolean };

export async function deleteAnswerAction(
  answerId: string,
  questionId: string,
): Promise<DeleteAnswerResult> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to delete an answer." };
  }

  try {
    await deleteAnswer(answerId, session.user.id);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: "Only moderators or owners can delete answers." };
    }
    if (err instanceof NotFoundError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Could not delete answer.",
    };
  }

  revalidatePath(`/q/${questionId}`);
  return { ok: true };
}
