"use client";

import { StarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { readCsrfToken } from "@/lib/csrf-client";
import { favoriteGroupAction } from "@/app/groups/[slug]/favorite-actions";

type Props = {
  groupId: string;
  slug: string;
  initialFavorited: boolean;
};

export function GroupFavoriteButton({ groupId, slug, initialFavorited }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (pending) return;
    setError(null);
    const prevFavorited = favorited;
    setFavorited(!prevFavorited);

    startTransition(async () => {
      const result = await favoriteGroupAction(groupId, slug, readCsrfToken());
      if (result.ok) {
        setFavorited(result.favorited);
      } else {
        setFavorited(prevFavorited);
        setError(result.error);
      }
    });
  };

  const label = favorited ? "Remove from favorites" : "Add to favorites";

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={favorited}
        aria-label={label}
        title={label}
        className={
          "inline-flex items-center justify-center rounded-md p-1.5 text-sm transition-colors " +
          (favorited
            ? "text-amber-600 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/40"
            : "text-muted-foreground hover:bg-accent hover:text-foreground") +
          " disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        <StarIcon className="h-4 w-4" fill={favorited ? "currentColor" : "none"} />
      </button>
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
