"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import { leaveGroup, transferOwnershipAndLeave } from "@/lib/memberships";

export async function confirmLeaveAction(slug: string, formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?returnTo=/groups/${slug}`);
  }
  const group = await getGroupBySlug(slug);
  if (!group) redirect("/groups");

  const raw = formData.get("successorUserId");
  const successorUserId = typeof raw === "string" && raw.length > 0 ? raw : null;
  if (successorUserId) {
    await transferOwnershipAndLeave(group.id, session.user.id, successorUserId);
  } else {
    await leaveGroup(group.id, session.user.id);
  }
  revalidatePath(`/groups/${slug}`);
  revalidatePath("/groups");
  redirect(`/groups/${slug}`);
}
