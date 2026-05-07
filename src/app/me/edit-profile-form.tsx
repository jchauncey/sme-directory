"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CsrfField } from "@/components/csrf-field";
import { MarkdownBody } from "@/components/markdown-body";
import { useFocusFirstError, useUnsavedChangesWarning } from "@/lib/forms";
import { updateMeAction, type MeFormState } from "./actions";

const initialState: MeFormState = {};

function fieldError(state: MeFormState, path: string): string | undefined {
  return state.fieldErrors?.find((e) => e.path === path)?.message;
}

type Props = {
  name: string | null;
  bio: string | null;
};

export function EditProfileForm({ name, bio }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateMeAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);

  useFocusFirstError(formRef, state.fieldErrors);
  useUnsavedChangesWarning(editing && isDirty && !isPending);

  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(false);
      setIsDirty(false);
    }
  }, [state.ok]);

  if (editing) {
    return (
      <form
        ref={formRef}
        action={formAction}
        onChange={() => setIsDirty(true)}
        onSubmit={() => setIsDirty(false)}
        className="space-y-3"
      >
        <CsrfField />
        <div className="space-y-1">
          <label htmlFor="edit-profile-name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="edit-profile-name"
            name="name"
            type="text"
            required
            minLength={1}
            maxLength={100}
            defaultValue={state.values?.name ?? name ?? ""}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
          />
          {fieldError(state, "name") ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {fieldError(state, "name")}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-profile-bio" className="block text-sm font-medium">
            Bio <span className="text-zinc-500">(Markdown supported, optional)</span>
          </label>
          <textarea
            id="edit-profile-bio"
            name="bio"
            rows={6}
            maxLength={1000}
            defaultValue={state.values?.bio ?? bio ?? ""}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
          />
          {fieldError(state, "bio") ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {fieldError(state, "bio")}
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
            onClick={() => {
              setEditing(false);
              setIsDirty(false);
            }}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {bio ? <MarkdownBody source={bio} /> : null}
      <div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Edit profile
        </button>
      </div>
    </div>
  );
}
