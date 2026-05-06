"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { updateUserProfile } from "@/lib/profile";
import { updateMeSchema } from "@/lib/validation/users";

export type FieldError = { path: string; message: string };

export type MeFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: FieldError[];
  values?: { name?: string; bio?: string };
};

export async function updateMeAction(
  _prev: MeFormState,
  formData: FormData,
): Promise<MeFormState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to edit your profile." };
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    bio: String(formData.get("bio") ?? ""),
  };
  const parsed = updateMeSchema.safeParse(raw);
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
    await updateUserProfile(session.user.id, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not update profile.",
      values: raw,
    };
  }

  revalidatePath("/me");
  revalidatePath(`/u/${session.user.id}`);
  return { ok: true };
}
