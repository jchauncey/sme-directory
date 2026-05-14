"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { assertCsrfToken } from "@/lib/csrf-server";
import { adminDeleteUser, adminDemoteUser, adminPromoteUser } from "@/lib/admin";
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

function revalidateUsers() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
}

export async function adminPromoteUserAction(
  targetUserId: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminPromoteUser(targetUserId, auth.userId);
    revalidateUsers();
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not promote user.") };
  }
}

export async function adminDemoteUserAction(
  targetUserId: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminDemoteUser(targetUserId, auth.userId);
    revalidateUsers();
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not demote user.") };
  }
}

export async function adminDeleteUserAction(
  targetUserId: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminDeleteUser(targetUserId, auth.userId);
    revalidateUsers();
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not delete user.") };
  }
}
