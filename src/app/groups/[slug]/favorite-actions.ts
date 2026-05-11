"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { assertCsrfToken, CsrfError } from "@/lib/csrf-server";
import { NotFoundError } from "@/lib/memberships";
import { RateLimitError, assertRateLimitForAction } from "@/lib/rate-limit";
import { toggleFavorite } from "@/lib/favorites";

export type GroupFavoriteActionResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: string };

export async function favoriteGroupAction(
  groupId: string,
  slug: string,
  csrfToken: string,
): Promise<GroupFavoriteActionResult> {
  try {
    await assertCsrfToken(csrfToken);
  } catch (err) {
    if (err instanceof CsrfError) return { ok: false, error: err.message };
    throw err;
  }
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to favorite." };
  }

  try {
    await assertRateLimitForAction("favorites");
  } catch (err) {
    if (err instanceof RateLimitError) {
      const seconds = Math.max(1, Math.ceil(err.retryAfterMs / 1000));
      return {
        ok: false,
        error: `Too many favorites. Try again in ${seconds} seconds.`,
      };
    }
    throw err;
  }

  try {
    const result = await toggleFavorite(
      { targetType: "group", targetId: groupId },
      session.user.id,
    );
    revalidatePath(`/groups/${slug}`);
    revalidatePath("/");
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
