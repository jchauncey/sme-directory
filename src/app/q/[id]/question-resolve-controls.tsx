"use client";

import { useState, useTransition } from "react";
import { acceptAnswerAction, reopenQuestionAction } from "./actions";

type Props = {
  questionId: string;
  status: "open" | "answered";
  canResolve: boolean;
};

export function QuestionResolveControls({
  questionId,
  status,
  canResolve,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "answered" && !canResolve) {
    return (
      <span className="inline-flex items-center rounded-full border border-green-600/40 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-500/40 dark:bg-green-950/40 dark:text-green-300">
        Answered
      </span>
    );
  }

  if (!canResolve) return null;

  const onMarkAnswered = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptAnswerAction(questionId, null);
      if (result.error) setError(result.error);
    });
  };

  const onReopen = () => {
    setError(null);
    startTransition(async () => {
      const result = await reopenQuestionAction(questionId);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-3">
      {status === "answered" ? (
        <>
          <span className="inline-flex items-center rounded-full border border-green-600/40 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-500/40 dark:bg-green-950/40 dark:text-green-300">
            Answered
          </span>
          <button
            type="button"
            onClick={onReopen}
            disabled={pending}
            className="text-xs text-zinc-600 underline hover:text-zinc-900 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {pending ? "Reopening…" : "Reopen"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onMarkAnswered}
          disabled={pending}
          className="rounded border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {pending ? "Saving…" : "Mark as answered"}
        </button>
      )}
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
