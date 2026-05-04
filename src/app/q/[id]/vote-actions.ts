"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { AuthorizationError, NotFoundError } from "@/lib/memberships";
import { castVote, type VoteTargetType } from "@/lib/votes";

export type VoteActionResult =
  | { ok: true; voted: boolean; voteScore: number }
  | { ok: false; error: string };

export async function voteAction(
  targetType: VoteTargetType,
  targetId: string,
  questionId: string,
): Promise<VoteActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to vote." };
  }

  try {
    const result = await castVote({ targetType, targetId }, session.user.id);
    revalidatePath(`/q/${questionId}`);
    return { ok: true, voted: result.voted, voteScore: result.voteScore };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof NotFoundError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not register vote.",
    };
  }
}
