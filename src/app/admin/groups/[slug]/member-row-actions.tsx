"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { readCsrfToken } from "@/lib/csrf-client";
import {
  adminRemoveMembershipAction,
  adminSetMembershipRoleAction,
  adminSetMembershipStatusAction,
} from "./actions";

type Status = "approved" | "rejected" | "pending";

type Props = {
  groupId: string;
  groupSlug: string;
  userId: string;
  userLabel: string;
  role: Role;
  status: Status;
};

const ROLE_OPTIONS: Role[] = ["member", "moderator", "owner"];
const STATUS_OPTIONS: Status[] = ["approved", "rejected", "pending"];

export function MemberRowActions({
  groupId,
  groupSlug,
  userId,
  userLabel,
  role,
  status,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onRoleChange = (next: Role) => {
    if (next === role) return;
    startTransition(async () => {
      setError(null);
      const result = await adminSetMembershipRoleAction(
        groupId,
        groupSlug,
        userId,
        next,
        readCsrfToken(),
      );
      if (result.error) setError(result.error);
    });
  };

  const onStatusChange = (next: Status) => {
    if (next === status) return;
    startTransition(async () => {
      setError(null);
      const result = await adminSetMembershipStatusAction(
        groupId,
        groupSlug,
        userId,
        next,
        readCsrfToken(),
      );
      if (result.error) setError(result.error);
    });
  };

  const onRemove = () => {
    const ok = window.confirm(`Remove ${userLabel} from this group?`);
    if (!ok) return;
    startTransition(async () => {
      setError(null);
      const result = await adminRemoveMembershipAction(
        groupId,
        groupSlug,
        userId,
        readCsrfToken(),
      );
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs">
        <span className="sr-only">Role</span>
        <select
          aria-label={`Role for ${userLabel}`}
          value={role}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          disabled={pending}
          className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="sr-only">Status</span>
        <select
          aria-label={`Status for ${userLabel}`}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as Status)}
          disabled={pending}
          className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700/60 dark:text-red-300 dark:hover:bg-red-900/20"
      >
        Remove
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}
