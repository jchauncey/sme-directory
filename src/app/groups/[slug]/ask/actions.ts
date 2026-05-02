"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import { assertApprovedMember, AuthorizationError } from "@/lib/memberships";
import { createQuestion } from "@/lib/questions";
import { createQuestionSchema } from "@/lib/validation/questions";

export type FieldError = { path: string; message: string };

export type AskQuestionState = {
  error?: string;
  fieldErrors?: FieldError[];
  values?: { title?: string; body?: string };
};

export async function createQuestionAction(
  slug: string,
  _prev: AskQuestionState,
  formData: FormData,
): Promise<AskQuestionState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to post a question." };
  }

  const raw = {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  };

  const parsed = createQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      values: raw,
    };
  }

  const group = await getGroupBySlug(slug);
  if (!group) {
    return { error: "Group not found.", values: raw };
  }

  let questionId: string;
  try {
    await assertApprovedMember(group.id, session.user.id);
    const question = await createQuestion(parsed.data, group.id, session.user.id);
    questionId = question.id;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        error: "You must be an approved member of this group to post a question.",
        values: raw,
      };
    }
    return {
      error: err instanceof Error ? err.message : "Could not post question.",
      values: raw,
    };
  }

  redirect(`/q/${questionId}`);
}
