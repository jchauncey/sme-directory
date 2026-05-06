import "server-only";
import { db } from "@/lib/db";
import { AuthorizationError, NotFoundError, isApprovedMember } from "@/lib/memberships";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  isCategory,
} from "@/lib/notification-categories";

export {
  NOTIFICATION_CATEGORIES,
  isCategory,
  categoryFor,
} from "@/lib/notification-categories";
export type { NotificationCategory } from "@/lib/notification-categories";

function parseMutedTypes(raw: string): NotificationCategory[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is NotificationCategory => typeof v === "string" && isCategory(v));
  } catch {
    return [];
  }
}

function normalizeMutedTypes(input: readonly string[]): NotificationCategory[] {
  const seen = new Set<NotificationCategory>();
  for (const v of input) {
    if (isCategory(v)) seen.add(v);
  }
  return NOTIFICATION_CATEGORIES.filter((c) => seen.has(c));
}

export type GroupPreference = {
  groupId: string;
  groupSlug: string;
  groupName: string;
  mutedTypes: NotificationCategory[];
};

export async function getPreferenceForGroup(
  userId: string,
  groupId: string,
): Promise<NotificationCategory[]> {
  const row = await db.notificationPreference.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  return row ? parseMutedTypes(row.mutedTypes) : [];
}

export async function listPreferencesForUser(userId: string): Promise<GroupPreference[]> {
  const rows = await db.notificationPreference.findMany({
    where: { userId },
    include: { group: { select: { id: true, slug: true, name: true } } },
  });
  return rows.map((r) => ({
    groupId: r.group.id,
    groupSlug: r.group.slug,
    groupName: r.group.name,
    mutedTypes: parseMutedTypes(r.mutedTypes),
  }));
}

export async function setPreferenceForGroup(
  userId: string,
  groupId: string,
  mutedTypes: readonly string[],
): Promise<NotificationCategory[]> {
  const group = await db.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw new NotFoundError("Group not found.");
  if (!(await isApprovedMember(groupId, userId))) {
    throw new AuthorizationError("You must be an approved member to set notification preferences.");
  }

  const normalized = normalizeMutedTypes(mutedTypes);
  const json = JSON.stringify(normalized);
  await db.notificationPreference.upsert({
    where: { userId_groupId: { userId, groupId } },
    create: { userId, groupId, mutedTypes: json },
    update: { mutedTypes: json },
  });
  return normalized;
}

/**
 * Given candidate recipient userIds for a single group + category, return
 * those who have NOT muted the category. One query, in-memory filter.
 */
export async function filterMuted(
  userIds: readonly string[],
  groupId: string,
  category: NotificationCategory,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db.notificationPreference.findMany({
    where: { groupId, userId: { in: [...userIds] } },
    select: { userId: true, mutedTypes: true },
  });
  const muted = new Set<string>();
  for (const r of rows) {
    if (parseMutedTypes(r.mutedTypes).includes(category)) muted.add(r.userId);
  }
  return userIds.filter((id) => !muted.has(id));
}
