"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CsrfField } from "@/components/csrf-field";
import { useFocusFirstError, useUnsavedChangesWarning } from "@/lib/forms";
import { updateGroupDetailsAction, type UpdateGroupDetailsState } from "./actions";

const initialState: UpdateGroupDetailsState = {};

type Props = {
  slug: string;
  initialName: string;
  initialDescription: string | null;
};

function fieldError(state: UpdateGroupDetailsState, path: string): string | undefined {
  return state.fieldErrors?.find((e) => e.path === path)?.message;
}

export function GroupDetailsForm({ slug, initialName, initialDescription }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateGroupDetailsAction,
    initialState,
  );
  const [name, setName] = useState(state.values?.name ?? initialName);
  const [description, setDescription] = useState(
    state.values?.description ?? initialDescription ?? "",
  );
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useFocusFirstError(formRef, state.fieldErrors);
  useUnsavedChangesWarning(isDirty && !isPending);

  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDirty(false);
      toast.success("Group details updated.");
    }
  }, [state.ok]);

  const nameError = fieldError(state, "name");
  const descriptionError = fieldError(state, "description");

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={() => setIsDirty(true)}
      className="space-y-4"
    >
      <CsrfField />
      <input type="hidden" name="slug" value={slug} />

      <div className="space-y-1">
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(nameError)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
        />
        {nameError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="description" className="block text-sm font-medium">
          Description <span className="text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={Boolean(descriptionError)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
        />
        {descriptionError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {descriptionError}
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
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
