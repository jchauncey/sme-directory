"use client";

import { useState, useTransition } from "react";
import { acceptAnswerAction } from "./actions";

type Props = {
  questionId: string;
  answerId: string;
};

export function AcceptAnswerButton({ questionId, answerId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptAnswerAction(questionId, answerId);
      if (result.error) setError(result.error);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-xs text-green-700 underline hover:text-green-800 disabled:opacity-60 dark:text-green-400 dark:hover:text-green-300"
      >
        {pending ? "Accepting…" : "Accept this answer"}
      </button>
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
