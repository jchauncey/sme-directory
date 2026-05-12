"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { assertCsrf, assertCsrfToken, CsrfError } from "@/lib/csrf-server";
import { archiveGroup, unarchiveGroup, updateGroup } from "@/lib/groups";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/memberships";
import { updateGroupSchema } from "@/lib/validation/groups";

export type ToggleAutoApproveState = {
  error?: string;
  autoApprove?: boolean;
};

export type FieldError = { path: string; message: string };

export type UpdateGroupDetailsState = {
  error?: string;
  fieldErrors?: FieldError[];
  values?: { name?: string; description?: string };
  ok?: true;
};

export async function updateGroupDetailsAction(
  _prev: UpdateGroupDetailsState,
  formData: FormData,
): Promise<UpdateGroupDetailsState> {
  try {
    await assertCsrf(formData);
  } catch (err) {
    if (err instanceof CsrfError) return { error: err.message };
    throw err;
  }
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const slug = String(formData.get("slug") ?? "");
  const raw = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };

  const parsed = updateGroupSchema.safeParse({
    name: raw.name,
    description: raw.description.length > 0 ? raw.description : null,
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

  try {
    await updateGroup(slug, parsed.data, session.user.id);
    revalidatePath("/");
    revalidatePath("/groups");
    revalidatePath(`/groups/${slug}`);
    revalidatePath(`/groups/${slug}/settings`);
    revalidatePath("/me/groups");
    revalidatePath("/me/favorites/groups");
    return { ok: true, values: raw };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: "Only the owner can change settings.", values: raw };
    }
    if (err instanceof NotFoundError) {
      return { error: "Group not found.", values: raw };
    }
    if (err instanceof ConflictError) {
      return { error: err.message, values: raw };
    }
    return {
      error: err instanceof Error ? err.message : "Could not update settings.",
      values: raw,
    };
  }
}

export async function toggleAutoApproveAction(
  _prev: ToggleAutoApproveState,
  formData: FormData,
): Promise<ToggleAutoApproveState> {
  try {
    await assertCsrf(formData);
  } catch (err) {
    if (err instanceof CsrfError) return { error: err.message };
    throw err;
  }
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const slug = String(formData.get("slug") ?? "");
  const desired = formData.get("autoApprove") === "on";

  try {
    const updated = await updateGroup(slug, { autoApprove: desired }, session.user.id);
    revalidatePath(`/groups/${slug}`);
    revalidatePath(`/groups/${slug}/settings`);
    return { autoApprove: updated.autoApprove };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: "Only the owner can change settings." };
    }
    if (err instanceof NotFoundError) {
      return { error: "Group not found." };
    }
    if (err instanceof ConflictError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Could not update settings.",
    };
  }
}

export type ArchiveActionResult = { error?: string; ok?: true };

export async function archiveGroupAction(
  slug: string,
  csrfToken: string,
): Promise<ArchiveActionResult> {
  try {
    await assertCsrfToken(csrfToken);
  } catch (err) {
    if (err instanceof CsrfError) return { error: err.message };
    throw err;
  }
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  try {
    await archiveGroup(slug, session.user.id);
    revalidatePath("/groups");
    revalidatePath(`/groups/${slug}`);
    revalidatePath(`/groups/${slug}/settings`);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: "Only the owner can archive this group." };
    }
    if (err instanceof NotFoundError) {
      return { error: "Group not found." };
    }
    if (err instanceof ConflictError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Could not archive group.",
    };
  }
}

export async function unarchiveGroupAction(
  slug: string,
  csrfToken: string,
): Promise<ArchiveActionResult> {
  try {
    await assertCsrfToken(csrfToken);
  } catch (err) {
    if (err instanceof CsrfError) return { error: err.message };
    throw err;
  }
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  try {
    await unarchiveGroup(slug, session.user.id);
    revalidatePath("/groups");
    revalidatePath(`/groups/${slug}`);
    revalidatePath(`/groups/${slug}/settings`);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: "Only the owner can restore this group." };
    }
    if (err instanceof NotFoundError) {
      return { error: "Group not found." };
    }
    if (err instanceof ConflictError) {
      return { error: err.message };
    }
    return {
      error: err instanceof Error ? err.message : "Could not restore group.",
    };
  }
}
