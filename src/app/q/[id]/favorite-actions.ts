"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { NotFoundError } from "@/lib/memberships";
import { toggleFavorite, type FavoriteTargetType } from "@/lib/favorites";

export type FavoriteActionResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: string };

export async function favoriteAction(
  targetType: FavoriteTargetType,
  targetId: string,
  questionId: string,
): Promise<FavoriteActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to favorite." };
  }

  try {
    const result = await toggleFavorite({ targetType, targetId }, session.user.id);
    revalidatePath(`/q/${questionId}`);
    revalidatePath("/me/favorites");
    return { ok: true, favorited: result.favorited };
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update favorite.",
    };
  }
}
