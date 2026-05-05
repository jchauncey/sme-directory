"use client";

import { useActionState, useEffect, useState } from "react";
import { MarkdownBody } from "@/components/markdown-body";
import { updateQuestionAction, type QuestionFormState } from "./actions";

const initialState: QuestionFormState = {};

function fieldError(state: QuestionFormState, path: string): string | undefined {
  return state.fieldErrors?.find((e) => e.path === path)?.message;
}

type Props = {
  questionId: string;
  title: string;
  body: string;
  canEdit: boolean;
};

export function EditQuestionForm({ questionId, title, body, canEdit }: Props) {
  const [editing, setEditing] = useState(false);

  const action = updateQuestionAction.bind(null, questionId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(false);
    }
  }, [state.ok]);

  if (editing) {
    return (
      <form action={formAction} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="edit-question-title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="edit-question-title"
            name="title"
            type="text"
            required
            minLength={5}
            maxLength={200}
            defaultValue={state.values?.title ?? title}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
          />
          {fieldError(state, "title") ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {fieldError(state, "title")}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-question-body" className="block text-sm font-medium">
            Body <span className="text-zinc-500">(Markdown supported)</span>
          </label>
          <textarea
            id="edit-question-body"
            name="body"
            rows={12}
            required
            minLength={1}
            maxLength={20000}
            defaultValue={state.values?.body ?? body}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
          />
          {fieldError(state, "body") ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {fieldError(state, "body")}
            </p>
          ) : null}
        </div>

        {state.error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <MarkdownBody source={body} />
      {canEdit ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Edit
          </button>
        </div>
      ) : null}
    </>
  );
}
