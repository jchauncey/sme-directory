"use client";

import { useActionState } from "react";
import { createQuestionAction, type AskQuestionState } from "./actions";

const initialState: AskQuestionState = {};

function fieldError(state: AskQuestionState, path: string): string | undefined {
  return state.fieldErrors?.find((e) => e.path === path)?.message;
}

type Props = { slug: string };

export function AskQuestionForm({ slug }: Props) {
  const action = createQuestionAction.bind(null, slug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={5}
          maxLength={200}
          defaultValue={state.values?.title ?? ""}
          placeholder="What is your question?"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
        />
        {fieldError(state, "title") ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {fieldError(state, "title")}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="body" className="block text-sm font-medium">
          Body <span className="text-zinc-500">(Markdown supported)</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={12}
          required
          minLength={1}
          maxLength={20000}
          defaultValue={state.values?.body ?? ""}
          placeholder="Provide context, what you've tried, and what you expect to happen."
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
        className="w-full rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Posting…" : "Post question"}
      </button>
    </form>
  );
}
