"use client";

import { useState, useTransition } from "react";
import { deleteQuestionAction } from "./actions";

type Props = {
  questionId: string;
};

export function QuestionDeleteButton({ questionId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (
      !confirm(
        "Delete this question? It will be hidden from listings and search. Existing answers stay in the database but the page will show a tombstone.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteQuestionAction(questionId);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-xs text-red-600 underline hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
      >
        {pending ? "Deleting…" : "Delete question"}
      </button>
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
