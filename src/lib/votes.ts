import "server-only";
import { Prisma, type TargetType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  NotFoundError,
  assertApprovedMember,
} from "@/lib/memberships";

export type VoteTargetType = TargetType;

export type CastVoteResult = {
  voted: boolean;
  voteScore: number;
  targetType: VoteTargetType;
  targetId: string;
};

export async function voteScoresFor(
  targetType: VoteTargetType,
  ids: string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await db.vote.groupBy({
    by: ["targetId"],
    where: { targetType, targetId: { in: ids } },
    _sum: { value: true },
  });
  return new Map(rows.map((r) => [r.targetId, r._sum.value ?? 0]));
}

export async function viewerVotesFor(
  targetType: VoteTargetType,
  ids: string[],
  userId: string,
): Promise<Map<string, 1>> {
  if (ids.length === 0) return new Map<string, 1>();
  const rows = await db.vote.findMany({
    where: { userId, targetType, targetId: { in: ids } },
    select: { targetId: true, value: true },
  });
  const out = new Map<string, 1>();
  for (const r of rows) {
    if (r.value === 1) out.set(r.targetId, 1);
  }
  return out;
}

async function resolveTarget(
  targetType: VoteTargetType,
  targetId: string,
): Promise<{ groupId: string; authorId: string }> {
  if (targetType === "question") {
    const q = await db.question.findUnique({
      where: { id: targetId },
      select: { groupId: true, authorId: true },
    });
    if (!q) throw new NotFoundError("Question not found.");
    return q;
  }
  const a = await db.answer.findUnique({
    where: { id: targetId },
    select: {
      authorId: true,
      question: { select: { groupId: true } },
    },
  });
  if (!a) throw new NotFoundError("Answer not found.");
  return { groupId: a.question.groupId, authorId: a.authorId };
}

export async function castVote(
  input: { targetType: VoteTargetType; targetId: string },
  userId: string,
): Promise<CastVoteResult> {
  const { groupId, authorId } = await resolveTarget(input.targetType, input.targetId);
  if (authorId === userId) {
    throw new AuthorizationError("You cannot vote on your own content.");
  }
  await assertApprovedMember(groupId, userId);

  const existing = await db.vote.findUnique({
    where: {
      userId_targetType_targetId: {
        userId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    },
    select: { id: true },
  });

  let voted: boolean;
  if (existing) {
    try {
      await db.vote.delete({ where: { id: existing.id } });
    } catch (err) {
      // P2025: row already removed by a concurrent request — same outcome.
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
      ) {
        throw err;
      }
    }
    voted = false;
  } else {
    try {
      await db.vote.create({
        data: {
          userId,
          targetType: input.targetType,
          targetId: input.targetId,
          value: 1,
        },
      });
    } catch (err) {
      // P2002: a concurrent request inserted the same vote — same outcome.
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      ) {
        throw err;
      }
    }
    voted = true;
  }

  const scores = await voteScoresFor(input.targetType, [input.targetId]);
  return {
    voted,
    voteScore: scores.get(input.targetId) ?? 0,
    targetType: input.targetType,
    targetId: input.targetId,
  };
}
