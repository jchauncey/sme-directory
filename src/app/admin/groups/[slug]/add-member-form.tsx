"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { readCsrfToken } from "@/lib/csrf-client";
import { adminAddMembershipAction } from "./add-member-action";

const ROLES: Role[] = ["member", "moderator", "owner"];

export function AddMemberForm({ groupId, groupSlug }: { groupId: string; groupSlug: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const result = await adminAddMembershipAction(
        groupId,
        groupSlug,
        trimmed,
        role,
        readCsrfToken(),
      );
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Added ${trimmed} as ${role}.`);
        setEmail("");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">User email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          placeholder="user@example.com"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md border border-border bg-background px-1.5 py-1 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add member"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
      {success ? (
        <span className="text-xs text-green-700 dark:text-green-400">{success}</span>
      ) : null}
    </form>
  );
}
