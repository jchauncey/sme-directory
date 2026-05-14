"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { assertCsrfToken } from "@/lib/csrf-server";
import {
  adminRemoveMembership,
  adminSetMembershipRole,
  adminSetMembershipStatus,
} from "@/lib/admin";
import { mapAdminError } from "../../error-map";

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

function revalidateSurfaces(slug: string) {
  revalidatePath("/admin/groups");
  revalidatePath(`/admin/groups/${slug}`);
  revalidatePath(`/groups/${slug}`);
  revalidatePath(`/groups/${slug}/settings`);
}

const ROLES: ReadonlyArray<Role> = ["member", "moderator", "owner"];
const STATUSES = ["approved", "rejected", "pending"] as const;

export async function adminSetMembershipRoleAction(
  groupId: string,
  groupSlug: string,
  userId: string,
  role: Role,
  csrfToken: string,
): Promise<AdminActionResult> {
  if (!ROLES.includes(role)) return { error: "Invalid role." };
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminSetMembershipRole(groupId, userId, role, auth.userId);
    revalidateSurfaces(groupSlug);
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not change role.") };
  }
}

export async function adminSetMembershipStatusAction(
  groupId: string,
  groupSlug: string,
  userId: string,
  status: (typeof STATUSES)[number],
  csrfToken: string,
): Promise<AdminActionResult> {
  if (!STATUSES.includes(status)) return { error: "Invalid status." };
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminSetMembershipStatus(groupId, userId, status, auth.userId);
    revalidateSurfaces(groupSlug);
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not change status.") };
  }
}

export async function adminRemoveMembershipAction(
  groupId: string,
  groupSlug: string,
  userId: string,
  csrfToken: string,
): Promise<AdminActionResult> {
  const auth = await authorize(csrfToken);
  if ("error" in auth) return { error: auth.error };
  try {
    await adminRemoveMembership(groupId, userId, auth.userId);
    revalidateSurfaces(groupSlug);
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not remove member.") };
  }
}
