"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { archiveGroup, unarchiveGroup, updateGroup } from "@/lib/groups";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/memberships";

export type ToggleAutoApproveState = {
  error?: string;
  autoApprove?: boolean;
};

export async function toggleAutoApproveAction(
  _prev: ToggleAutoApproveState,
  formData: FormData,
): Promise<ToggleAutoApproveState> {
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

export async function archiveGroupAction(slug: string): Promise<ArchiveActionResult> {
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

export async function unarchiveGroupAction(slug: string): Promise<ArchiveActionResult> {
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
