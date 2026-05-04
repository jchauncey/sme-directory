"use client";

import { StarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { favoriteAction } from "./favorite-actions";
import type { FavoriteTargetType } from "@/lib/favorites";

type Props = {
  targetType: FavoriteTargetType;
  targetId: string;
  questionId: string;
  initialFavorited: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export function FavoriteButton({
  targetType,
  targetId,
  questionId,
  initialFavorited,
  disabled = false,
  disabledReason,
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (disabled || pending) return;
    setError(null);
    const prevFavorited = favorited;
    setFavorited(!prevFavorited);

    startTransition(async () => {
      const result = await favoriteAction(targetType, targetId, questionId);
      if (result.ok) {
        setFavorited(result.favorited);
      } else {
        setFavorited(prevFavorited);
        setError(result.error);
      }
    });
  };

  const label = favorited ? "Remove from favorites" : "Add to favorites";
  const title = disabled ? disabledReason ?? label : label;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        aria-pressed={favorited}
        aria-label={label}
        title={title}
        className={
          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors " +
          (favorited
            ? "border-amber-500 bg-amber-100 text-amber-800 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200"
            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800") +
          " disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        <StarIcon
          className="h-3.5 w-3.5"
          fill={favorited ? "currentColor" : "none"}
        />
      </button>
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
