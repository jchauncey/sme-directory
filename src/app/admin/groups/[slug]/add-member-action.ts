"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { assertCsrfToken } from "@/lib/csrf-server";
import { adminSetMembershipRole } from "@/lib/admin";
import { NotFoundError } from "@/lib/memberships";
import { mapAdminError } from "../../error-map";

export type AddMemberResult = { error?: string; ok?: true };

export async function adminAddMembershipAction(
  groupId: string,
  groupSlug: string,
  email: string,
  role: Role,
  csrfToken: string,
): Promise<AddMemberResult> {
  try {
    await assertCsrfToken(csrfToken);
  } catch (err) {
    return { error: mapAdminError(err, "Invalid request.") };
  }
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };

  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  // Intentional disclosure: only super admins reach this code, and the admin
  // needs a specific signal so they can decide whether to invite the user.
  if (!user) {
    return { error: mapAdminError(new NotFoundError("No user with that email."), "User not found.") };
  }

  try {
    await adminSetMembershipRole(groupId, user.id, role, session.user.id);
    revalidatePath(`/admin/groups/${groupSlug}`);
    revalidatePath(`/groups/${groupSlug}`);
    return { ok: true };
  } catch (err) {
    return { error: mapAdminError(err, "Could not add member.") };
  }
}
