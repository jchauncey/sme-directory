import "server-only";
import type { Group, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertOwner, ConflictError, NotFoundError } from "@/lib/memberships";
import type { CreateGroupInput, UpdateGroupInput } from "@/lib/validation/groups";

export class SlugConflictError extends Error {
  readonly code = "SLUG_CONFLICT" as const;
  readonly field = "slug" as const;
  constructor(message = "A group with that slug already exists.") {
    super(message);
    this.name = "SlugConflictError";
  }
}

export type GroupWithOwner = Group & {
  createdBy: Pick<User, "id" | "email" | "name">;
};

export async function createGroup(input: CreateGroupInput, creatorUserId: string): Promise<Group> {
  try {
    return await db.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          autoApprove: input.autoApprove ?? false,
          createdById: creatorUserId,
        },
      });
      await tx.membership.create({
        data: {
          groupId: group.id,
          userId: creatorUserId,
          role: "owner",
          status: "approved",
        },
      });
      return group;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      (err.meta?.target as string[]).includes("slug")
    ) {
      throw new SlugConflictError();
    }
    throw err;
  }
}

export type GroupListItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  memberCount: number;
  recentQuestionCount: number;
  createdAt: Date;
  archivedAt: Date | null;
};

const RECENT_QUESTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function countRecentQuestionsByGroup(
  groupIds?: string[],
): Promise<Map<string, number>> {
  if (groupIds && groupIds.length === 0) return new Map();
  const since = new Date(Date.now() - RECENT_QUESTION_WINDOW_MS);
  const rows = await db.question.groupBy({
    by: ["groupId"],
    where: {
      deletedAt: null,
      createdAt: { gte: since },
      ...(groupIds ? { groupId: { in: groupIds } } : {}),
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.groupId, r._count._all]));
}

export type ListGroupsSort = "newest" | "members";

export type GroupListPage = {
  items: GroupListItem[];
  total: number;
  page: number;
  per: number;
};

export async function listGroups(opts: {
  sort: ListGroupsSort;
  includeArchived?: boolean;
  page?: number;
  per?: number;
}): Promise<GroupListPage> {
  const page = Math.max(opts.page ?? 1, 1);
  const per = Math.min(Math.max(opts.per ?? 20, 1), 50);
  const where = opts.includeArchived ? {} : { archivedAt: null };
  const [groups, counts, recentByGroupId] = await Promise.all([
    db.group.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        image: true,
        createdAt: true,
        archivedAt: true,
      },
    }),
    db.membership.groupBy({
      by: ["groupId"],
      where: { status: "approved" },
      _count: { _all: true },
    }),
    countRecentQuestionsByGroup(),
  ]);

  const countByGroupId = new Map(counts.map((c) => [c.groupId, c._count._all]));

  const items: GroupListItem[] = groups.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    image: g.image,
    createdAt: g.createdAt,
    archivedAt: g.archivedAt,
    memberCount: countByGroupId.get(g.id) ?? 0,
    recentQuestionCount: recentByGroupId.get(g.id) ?? 0,
  }));

  if (opts.sort === "members") {
    items.sort((a, b) => {
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  } else {
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const total = items.length;
  const start = (page - 1) * per;
  return { items: items.slice(start, start + per), total, page, per };
}

// Window (in days) over which `listGroupsByActivity` measures question/answer activity.
const ACTIVITY_WINDOW_DAYS = 30;

export async function listGroupsByActivity(
  limit: number,
  opts: { since?: Date } = {},
): Promise<GroupListItem[]> {
  const since =
    opts.since ?? new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [questionAgg, answerAgg] = await Promise.all([
    db.question.groupBy({
      by: ["groupId"],
      where: { deletedAt: null, createdAt: { gte: since }, group: { archivedAt: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.answer.groupBy({
      by: ["questionId"],
      where: {
        createdAt: { gte: since },
        question: { deletedAt: null, group: { archivedAt: null } },
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  // Map answer counts (keyed by questionId) up to groupId.
  const answeredQuestionIds = answerAgg.map((a) => a.questionId);
  const questionToGroup =
    answeredQuestionIds.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await db.question.findMany({
              where: { id: { in: answeredQuestionIds } },
              select: { id: true, groupId: true },
            })
          ).map((q) => [q.id, q.groupId]),
        );

  type Activity = { count: number; latest: Date };
  const byGroup = new Map<string, Activity>();
  for (const row of questionAgg) {
    const cur = byGroup.get(row.groupId) ?? { count: 0, latest: new Date(0) };
    cur.count += row._count._all;
    if (row._max.createdAt && row._max.createdAt > cur.latest) cur.latest = row._max.createdAt;
    byGroup.set(row.groupId, cur);
  }
  for (const row of answerAgg) {
    const groupId = questionToGroup.get(row.questionId);
    if (!groupId) continue;
    const cur = byGroup.get(groupId) ?? { count: 0, latest: new Date(0) };
    cur.count += row._count._all;
    if (row._max.createdAt && row._max.createdAt > cur.latest) cur.latest = row._max.createdAt;
    byGroup.set(groupId, cur);
  }

  if (byGroup.size === 0) {
    const page = await listGroups({ sort: "members", per: limit });
    return page.items;
  }

  const rankedIds = [...byGroup.entries()]
    .sort(([, a], [, b]) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.latest.getTime() - a.latest.getTime();
    })
    .slice(0, limit)
    .map(([id]) => id);

  const [groupRows, memberCounts, recentByGroupId] = await Promise.all([
    db.group.findMany({
      where: { id: { in: rankedIds }, archivedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        image: true,
        archivedAt: true,
        createdAt: true,
      },
    }),
    db.membership.groupBy({
      by: ["groupId"],
      where: { groupId: { in: rankedIds }, status: "approved" },
      _count: { _all: true },
    }),
    countRecentQuestionsByGroup(rankedIds),
  ]);

  const countByGroupId = new Map(memberCounts.map((c) => [c.groupId, c._count._all]));
  const groupById = new Map(groupRows.map((g) => [g.id, g]));

  const items: GroupListItem[] = [];
  for (const id of rankedIds) {
    const g = groupById.get(id);
    if (!g) continue;
    items.push({
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      image: g.image,
      archivedAt: g.archivedAt,
      createdAt: g.createdAt,
      memberCount: countByGroupId.get(g.id) ?? 0,
      recentQuestionCount: recentByGroupId.get(g.id) ?? 0,
    });
  }
  return items;
}

export async function getGroupBySlug(slug: string): Promise<GroupWithOwner | null> {
  return db.group.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function getGroupBySlugOrThrow(slug: string): Promise<GroupWithOwner> {
  const group = await getGroupBySlug(slug);
  if (!group) throw new NotFoundError("Group not found.");
  return group;
}

export async function updateGroup(
  slug: string,
  input: UpdateGroupInput,
  actorUserId: string,
): Promise<Group> {
  const group = await getGroupBySlugOrThrow(slug);
  await assertOwner(group.id, actorUserId);
  if (group.archivedAt) {
    throw new ConflictError("This group is archived and is read-only.");
  }
  const data: Prisma.GroupUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.autoApprove !== undefined) data.autoApprove = input.autoApprove;
  return db.group.update({ where: { id: group.id }, data });
}

export async function assertGroupNotArchived(groupId: string): Promise<void> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { archivedAt: true },
  });
  if (!group) throw new NotFoundError("Group not found.");
  if (group.archivedAt) {
    throw new ConflictError("This group is archived and is read-only.");
  }
}

export async function archiveGroup(slug: string, actorUserId: string): Promise<Group> {
  const group = await getGroupBySlugOrThrow(slug);
  await assertOwner(group.id, actorUserId);
  if (group.archivedAt) {
    throw new ConflictError("Group is already archived.");
  }
  return db.group.update({
    where: { id: group.id },
    data: { archivedAt: new Date() },
  });
}

export async function unarchiveGroup(slug: string, actorUserId: string): Promise<Group> {
  const group = await getGroupBySlugOrThrow(slug);
  await assertOwner(group.id, actorUserId);
  if (!group.archivedAt) {
    throw new ConflictError("Group is not archived.");
  }
  return db.group.update({
    where: { id: group.id },
    data: { archivedAt: null },
  });
}
