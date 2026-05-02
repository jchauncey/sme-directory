import "server-only";
import type { Group, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertOwner, NotFoundError } from "@/lib/memberships";
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
  memberCount: number;
  createdAt: Date;
};

export type ListGroupsSort = "newest" | "members";

export async function listGroups(opts: { sort: ListGroupsSort }): Promise<GroupListItem[]> {
  const [groups, counts] = await Promise.all([
    db.group.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        createdAt: true,
      },
    }),
    db.membership.groupBy({
      by: ["groupId"],
      where: { status: "approved" },
      _count: { _all: true },
    }),
  ]);

  const countByGroupId = new Map(counts.map((c) => [c.groupId, c._count._all]));

  const items: GroupListItem[] = groups.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    createdAt: g.createdAt,
    memberCount: countByGroupId.get(g.id) ?? 0,
  }));

  if (opts.sort === "members") {
    items.sort((a, b) => {
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  } else {
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
  const data: Prisma.GroupUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.autoApprove !== undefined) data.autoApprove = input.autoApprove;
  return db.group.update({ where: { id: group.id }, data });
}
