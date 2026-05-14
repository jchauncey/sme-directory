"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { assertCsrfToken } from "@/lib/csrf-server";
import { adminDeleteAnswer, adminDeleteQuestion } from "@/lib/admin";
import { mapAdminError } from "../error-map";

export type AdminActionResult = { error?: string; ok?: true };

async function authorize(csrfToken: string): Promise<{ userId: string } | { error: string }> {
  try {
    await assertCsrfToken(csrfToken);
  } catch (err) {
    return { error: mapAdminError(err, "Invalid request.") };
  }
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  return { userId: session.user.id };
}

export async function adminDeleteQuestionAction(
  questionId: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminDeleteQuestion(questionId, auth.userId);
    revalidatePath("/admin/content/questions");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not delete question.") };
  }
}

export async function adminDeleteAnswerAction(
  answerId: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminDeleteAnswer(answerId, auth.userId);
    revalidatePath("/admin/content/answers");
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not delete answer.") };
  }
}
