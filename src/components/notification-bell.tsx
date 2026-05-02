"use client";

import Link from "next/link";
import { BellIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import type {
  NotificationListResult,
  ParsedNotification,
} from "@/lib/notifications";

const POLL_INTERVAL_MS = 30_000;

type ClientNotification = Omit<ParsedNotification, "createdAt" | "readAt"> & {
  createdAt: string;
  readAt: string | null;
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const { status } = useSession();
  const [items, setItems] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as NotificationListResult;
      if (!mountedRef.current) return;
      setItems(body.items as unknown as ClientNotification[]);
      setUnreadCount(body.unreadCount);
    } catch {
      // network errors are silently swallowed; next poll will retry
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        void fetchNotifications();
      }, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        void fetchNotifications();
        start();
      }
    };
    // Initial fetch is queued as a microtask so React doesn't see the
    // setState as synchronous within the effect body.
    void Promise.resolve().then(fetchNotifications);
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [status, fetchNotifications]);

  const handleItemClick = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    void fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // optimistic update already applied; refetch to reconcile if it failed
      void fetchNotifications();
    }
  }, [fetchNotifications]);

  if (status !== "authenticated") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unreadCount > 0
                ? `Notifications (${unreadCount} unread)`
                : "Notifications"
            }
            className="relative"
          />
        }
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto py-1">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            items.map((n) => {
              const unread = !n.readAt;
              return (
                <Link
                  key={n.id}
                  href={`/q/${n.payload.questionId}`}
                  onClick={() => handleItemClick(n.id)}
                  className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    aria-hidden="true"
                    className={
                      "mt-1.5 size-2 shrink-0 rounded-full " +
                      (unread ? "bg-primary" : "bg-transparent")
                    }
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">
                      {n.payload.questionTitle}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {n.payload.authorName ?? "Someone"} in {n.payload.groupName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
