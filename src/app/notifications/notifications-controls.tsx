"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notification-categories";

type Props = {
  selectedTypes: NotificationCategory[];
  unreadOnly: boolean;
  per: number;
  hasUnread: boolean;
};

const TYPE_LABELS: Record<NotificationCategory, string> = {
  question: "Questions",
  answer: "Answers",
  membership: "Memberships",
};

function buildQuery(params: {
  types?: NotificationCategory[];
  unread?: boolean;
  per: number;
}): string {
  const sp = new URLSearchParams();
  sp.set("page", "1");
  sp.set("per", String(params.per));
  if (params.types && params.types.length > 0) sp.set("types", params.types.join(","));
  if (params.unread) sp.set("unread", "1");
  return sp.toString();
}

export function NotificationsControls({ selectedTypes, unreadOnly, per, hasUnread }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(qs: string) {
    startTransition(() => {
      router.replace(`/notifications?${qs}`, { scroll: false });
    });
  }

  function toggleType(t: NotificationCategory) {
    const next = selectedTypes.includes(t)
      ? selectedTypes.filter((x) => x !== t)
      : [...selectedTypes, t];
    navigate(buildQuery({ types: next, unread: unreadOnly, per }));
  }

  function setAllTypes() {
    navigate(buildQuery({ types: [], unread: unreadOnly, per }));
  }

  function setUnread(value: boolean) {
    navigate(buildQuery({ types: selectedTypes, unread: value, per }));
  }

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) return;
      router.refresh();
    } catch {
      // surface no error UI for now; page will reload manually if needed
    }
  }

  const allSelected = selectedTypes.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">
          <Button
            type="button"
            variant={allSelected ? "secondary" : "outline"}
            size="sm"
            onClick={setAllTypes}
            aria-pressed={allSelected}
          >
            All
          </Button>
          {NOTIFICATION_CATEGORIES.map((t) => {
            const pressed = selectedTypes.includes(t);
            return (
              <Button
                key={t}
                type="button"
                variant={pressed ? "secondary" : "outline"}
                size="sm"
                onClick={() => toggleType(t)}
                aria-pressed={pressed}
              >
                {TYPE_LABELS[t]}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Read state</span>
        <div className="flex gap-1" role="group" aria-label="Filter by read state">
          <Button
            type="button"
            variant={!unreadOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setUnread(false)}
            aria-pressed={!unreadOnly}
          >
            All
          </Button>
          <Button
            type="button"
            variant={unreadOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setUnread(true)}
            aria-pressed={unreadOnly}
          >
            Unread only
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isPending ? (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Updating…
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={!hasUnread}
          >
            Mark all read
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MarkRowReadButton({
  id,
  alreadyRead,
}: {
  id: string;
  alreadyRead: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (alreadyRead) {
    return (
      <span className="text-xs text-muted-foreground" aria-label="Already read">
        Read
      </span>
    );
  }

  async function onClick() {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) return;
      startTransition(() => router.refresh());
    } catch {
      // ignore
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={isPending}
      aria-label="Mark as read"
    >
      Mark read
    </Button>
  );
}
