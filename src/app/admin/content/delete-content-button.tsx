"use client";

import { useState, useTransition } from "react";
import { readCsrfToken } from "@/lib/csrf-client";
import { adminDeleteAnswerAction, adminDeleteQuestionAction } from "./actions";

type Props =
  | { kind: "question"; id: string; label: string }
  | { kind: "answer"; id: string; label: string };

export function DeleteContentButton(props: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onDelete = () => {
    const ok = window.confirm(
      `Permanently delete this ${props.kind}?\n\n${props.label}\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    startTransition(async () => {
      setError(null);
      const result =
        props.kind === "question"
          ? await adminDeleteQuestionAction(props.id, readCsrfToken())
          : await adminDeleteAnswerAction(props.id, readCsrfToken());
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700/60 dark:text-red-300 dark:hover:bg-red-900/20"
      >
        Delete
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}
