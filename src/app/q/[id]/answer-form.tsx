"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAnswerAction, type AnswerFormState } from "./actions";

const initialState: AnswerFormState = {};

function fieldError(state: AnswerFormState, path: string): string | undefined {
  return state.fieldErrors?.find((e) => e.path === path)?.message;
}

type Props = { questionId: string };

export function AnswerForm({ questionId }: Props) {
  const action = createAnswerAction.bind(null, questionId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="answer-body" className="block text-sm font-medium">
          Your answer <span className="text-zinc-500">(Markdown supported)</span>
        </label>
        <textarea
          id="answer-body"
          name="body"
          rows={6}
          required
          minLength={1}
          maxLength={20000}
          defaultValue={state.values?.body ?? ""}
          placeholder="Share what you know. Be concrete and link to sources where helpful."
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

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Posting…" : "Post answer"}
      </button>
    </form>
  );
}
