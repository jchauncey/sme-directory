"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createGroup, SlugConflictError } from "@/lib/groups";
import { createGroupSchema } from "@/lib/validation/groups";

export type FieldError = { path: string; message: string };

export type CreateGroupState = {
  error?: string;
  fieldErrors?: FieldError[];
  values?: { name?: string; slug?: string; description?: string; autoApprove?: boolean };
};

export async function createGroupAction(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in to create a group." };
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    autoApprove: formData.get("autoApprove") === "on",
  };

  const parsed = createGroupSchema.safeParse({
    name: raw.name,
    slug: raw.slug,
    description: raw.description.length > 0 ? raw.description : undefined,
    autoApprove: raw.autoApprove,
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      values: raw,
    };
  }

  let slug: string;
  try {
    const group = await createGroup(parsed.data, session.user.id);
    slug = group.slug;
  } catch (err) {
    if (err instanceof SlugConflictError) {
      return {
        fieldErrors: [{ path: "slug", message: err.message }],
        values: raw,
      };
    }
    return {
      error: err instanceof Error ? err.message : "Could not create group.",
      values: raw,
    };
  }
  redirect(`/groups/${slug}`);
}
