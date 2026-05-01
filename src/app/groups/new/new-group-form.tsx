"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/slug";
import { createGroupAction, type CreateGroupState } from "./actions";

const initialState: CreateGroupState = {};

function fieldError(state: CreateGroupState, path: string): string | undefined {
  return state.fieldErrors?.find((e) => e.path === path)?.message;
}

export function NewGroupForm() {
  const [state, formAction, isPending] = useActionState(createGroupAction, initialState);
  const [name, setName] = useState(state.values?.name ?? "");
  const [slugOverride, setSlugOverride] = useState<string | null>(
    state.values?.slug ?? null,
  );
  const slug = slugOverride ?? slugify(name);

  return (
    <form action={formAction} className="space-y-5">
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
          placeholder="Kubernetes"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
        />
        {fieldError(state, "name") ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {fieldError(state, "name")}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="slug" className="block text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          minLength={2}
          maxLength={64}
          value={slug}
          onChange={(e) => setSlugOverride(e.target.value)}
          placeholder="kubernetes"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          URL-safe identifier. Auto-derived from the name; edit if you want a different one.
        </p>
        {fieldError(state, "slug") ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {fieldError(state, "slug")}
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
          defaultValue={state.values?.description ?? ""}
          placeholder="What is this group about?"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
        />
        {fieldError(state, "description") ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {fieldError(state, "description")}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="autoApprove"
          name="autoApprove"
          type="checkbox"
          defaultChecked={state.values?.autoApprove ?? false}
          className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <label htmlFor="autoApprove" className="text-sm">
          Auto-approve membership requests
        </label>
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
        {isPending ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
