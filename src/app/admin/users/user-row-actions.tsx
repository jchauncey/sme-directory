"use client";

import { useState, useTransition } from "react";
import { readCsrfToken } from "@/lib/csrf-client";
import {
  adminDeleteUserAction,
  adminDemoteUserAction,
  adminPromoteUserAction,
} from "./actions";

type Props = {
  userId: string;
  userLabel: string;
  isSuperAdmin: boolean;
  isSelf: boolean;
};

export function UserRowActions({ userId, userLabel, isSuperAdmin, isSelf }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string; ok?: true }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
    });

  const onPromote = () => run(() => adminPromoteUserAction(userId, readCsrfToken()));
  const onDemote = () => {
    const ok = window.confirm(`Remove super-admin from ${userLabel}?`);
    if (!ok) return;
    run(() => adminDemoteUserAction(userId, readCsrfToken()));
  };
  const onDelete = () => {
    const ok = window.confirm(
      `Delete ${userLabel} entirely? Their questions, answers, votes, and memberships will be removed.`,
    );
    if (!ok) return;
    run(() => adminDeleteUserAction(userId, readCsrfToken()));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isSuperAdmin ? (
        <button
          type="button"
          onClick={onDemote}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
        >
          Demote
        </button>
      ) : (
        <button
          type="button"
          onClick={onPromote}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
        >
          Promote
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending || isSelf}
        title={isSelf ? "You cannot delete your own account from /admin" : undefined}
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
