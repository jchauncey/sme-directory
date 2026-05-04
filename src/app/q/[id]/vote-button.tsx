"use client";

import { ChevronUpIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { voteAction } from "./vote-actions";
import type { VoteTargetType } from "@/lib/votes";

type Props = {
  targetType: VoteTargetType;
  targetId: string;
  questionId: string;
  initialScore: number;
  initialVoted: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export function VoteButton({
  targetType,
  targetId,
  questionId,
  initialScore,
  initialVoted,
  disabled = false,
  disabledReason,
}: Props) {
  const [score, setScore] = useState(initialScore);
  const [voted, setVoted] = useState(initialVoted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (disabled || pending) return;
    setError(null);
    const prevScore = score;
    const prevVoted = voted;
    const optimisticScore = prevVoted ? prevScore - 1 : prevScore + 1;
    setScore(optimisticScore);
    setVoted(!prevVoted);

    startTransition(async () => {
      const result = await voteAction(targetType, targetId, questionId);
      if (result.ok) {
        setScore(result.voteScore);
        setVoted(result.voted);
      } else {
        setScore(prevScore);
        setVoted(prevVoted);
        setError(result.error);
      }
    });
  };

  const label = voted ? "Remove vote" : "Upvote";
  const title = disabled ? disabledReason ?? label : label;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        aria-pressed={voted}
        aria-label={label}
        title={title}
        className={
          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors " +
          (voted
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800") +
          " disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        <ChevronUpIcon className="h-3.5 w-3.5" />
        <span className="tabular-nums">{score}</span>
      </button>
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
