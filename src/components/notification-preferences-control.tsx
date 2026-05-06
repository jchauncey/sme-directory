"use client";

import { useState, useTransition } from "react";

import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notification-categories";

const TYPE_LABELS: Record<NotificationCategory, string> = {
  question: "New questions",
  answer: "New answers",
  membership: "Membership updates",
};

type Props = {
  groupId: string;
  groupName: string;
  initialMutedTypes: NotificationCategory[];
};

export function NotificationPreferencesControl({
  groupId,
  groupName,
  initialMutedTypes,
}: Props) {
  const [mutedTypes, setMutedTypes] = useState<NotificationCategory[]>(initialMutedTypes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function persist(next: NotificationCategory[]) {
    setError(null);
    try {
      const res = await fetch(`/api/notification-preferences/${groupId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutedTypes: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Failed to update preferences.");
      }
    } catch {
      setError("Network error. Try again.");
    }
  }

  function toggle(category: NotificationCategory, muted: boolean) {
    const next = muted
      ? Array.from(new Set([...mutedTypes, category]))
      : mutedTypes.filter((t) => t !== category);
    // Keep canonical order so the server-rendered HTML matches across reloads.
    const ordered = NOTIFICATION_CATEGORIES.filter((c) => next.includes(c));
    setMutedTypes(ordered);
    startTransition(() => {
      void persist(ordered);
    });
  }

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Mute notifications for {groupName}</legend>
      <p className="text-xs text-muted-foreground">
        Pick which kinds of activity in {groupName} should not generate notifications.
      </p>
      <ul className="space-y-1">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const muted = mutedTypes.includes(category);
          const inputId = `mute-${groupId}-${category}`;
          return (
            <li key={category} className="flex items-center gap-2 text-sm">
              <input
                id={inputId}
                type="checkbox"
                className="size-4 rounded border-input"
                checked={muted}
                disabled={isPending}
                onChange={(e) => toggle(category, e.target.checked)}
              />
              <label htmlFor={inputId} className="cursor-pointer">
                Mute {TYPE_LABELS[category].toLowerCase()}
              </label>
            </li>
          );
        })}
      </ul>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}
