"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { assertCsrfToken } from "@/lib/csrf-server";
import {
  adminArchiveGroup,
  adminDeleteGroup,
  adminUnarchiveGroup,
} from "@/lib/admin";
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

function revalidateGroupSurfaces(slug: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/groups");
  revalidatePath(`/admin/groups/${slug}`);
  revalidatePath("/groups");
  revalidatePath(`/groups/${slug}`);
  revalidatePath("/");
}

export async function adminArchiveGroupAction(
  slug: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminArchiveGroup(slug, auth.userId);
    revalidateGroupSurfaces(slug);
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not archive group.") };
  }
}

export async function adminUnarchiveGroupAction(
  slug: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminUnarchiveGroup(slug, auth.userId);
    revalidateGroupSurfaces(slug);
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not restore group.") };
  }
}

export async function adminDeleteGroupAction(
  slug: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminDeleteGroup(slug, auth.userId);
    revalidatePath("/admin");
    revalidatePath("/admin/groups");
    revalidatePath("/groups");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not delete group.") };
  }
}
