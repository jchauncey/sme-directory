import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import {
  DEFAULT_PER,
  MAX_PER,
  listForUser,
  type ParsedNotification,
} from "@/lib/notifications";
import {
  isCategory,
  type NotificationCategory,
} from "@/lib/notification-categories";

import { MarkRowReadButton, NotificationsControls } from "./notifications-controls";

type Props = {
  searchParams: Promise<{
    page?: string;
    per?: string;
    types?: string;
    unread?: string;
  }>;
};

function parseTypes(raw: string | undefined): NotificationCategory[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter(isCategory);
}

function parsePositiveInt(raw: string | undefined, fallback: number, max?: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max !== undefined ? Math.min(n, max) : n;
}

function relativeTime(date: Date): string {
  const ms = Date.now() - date.getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString();
}

function descriptionFor(n: ParsedNotification): { headline: string; subline: string; href: string } {
  switch (n.type) {
    case "question.created":
      return {
        headline: n.payload.questionTitle,
        subline: `New question · ${n.payload.authorName ?? "Someone"} in ${n.payload.groupName}`,
        href: `/q/${n.payload.questionId}`,
      };
    case "answer.posted":
      return {
        headline: `New answer: ${n.payload.questionTitle}`,
        subline: `${n.payload.answererName ?? "Someone"} answered in ${n.payload.groupName}`,
        href: `/q/${n.payload.questionId}`,
      };
    case "answer.accepted":
      return {
        headline: "Your answer was accepted",
        subline: `${n.payload.actorName ?? "Someone"} on ${n.payload.questionTitle}`,
        href: `/q/${n.payload.questionId}`,
      };
    case "membership.approved":
      return {
        headline: `Approved to join ${n.payload.groupName}`,
        subline: `${n.payload.actorName ?? "A moderator"} approved your application`,
        href: "/me/applications",
      };
    case "membership.rejected":
      return {
        headline: `Application to ${n.payload.groupName} declined`,
        subline: `${n.payload.actorName ?? "A moderator"} declined your application`,
        href: "/me/applications",
      };
  }
}

function PageButton({
  to,
  per,
  types,
  unread,
  disabled,
  children,
}: {
  to: number;
  per: number;
  types: NotificationCategory[];
  unread: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  const sp = new URLSearchParams();
  sp.set("page", String(to));
  sp.set("per", String(per));
  if (types.length > 0) sp.set("types", types.join(","));
  if (unread) sp.set("unread", "1");
  return (
    <Button
      variant="outline"
      size="sm"
      render={<Link href={`/notifications?${sp.toString()}`} />}
    >
      {children}
    </Button>
  );
}

export default async function NotificationsPage({ searchParams }: Props) {
  const session = await requireAuth();
  const sp = await searchParams;
  const page = parsePositiveInt(sp.page, 1);
  const per = parsePositiveInt(sp.per, DEFAULT_PER, MAX_PER);
  const types = parseTypes(sp.types);
  const unreadOnly = sp.unread === "1" || sp.unread === "true";

  const result = await listForUser(session.user.id, { page, per, types, unreadOnly });
  const totalPages = Math.max(Math.ceil(result.total / per), 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Full history. Filter by type or read state, and mute groups from{" "}
          <Link href="/me" className="underline">
            your profile
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <NotificationsControls
            selectedTypes={types}
            unreadOnly={unreadOnly}
            per={per}
            hasUnread={result.unreadCount > 0}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {result.total === 0
            ? "No notifications match these filters."
            : `${result.total} ${result.total === 1 ? "notification" : "notifications"} · page ${result.page} of ${totalPages} · ${result.unreadCount} unread`}
        </p>

        {result.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing here yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {result.items.map((n) => {
              const desc = descriptionFor(n);
              const unread = !n.readAt;
              return (
                <li
                  key={n.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <span
                    aria-hidden="true"
                    className={
                      "mt-1.5 size-2 shrink-0 rounded-full " +
                      (unread ? "bg-primary" : "bg-transparent")
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Link
                      href={desc.href}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {desc.headline}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{desc.subline}</p>
                    <p className="text-xs text-muted-foreground">{relativeTime(n.createdAt)}</p>
                  </div>
                  <MarkRowReadButton id={n.id} alreadyRead={!unread} />
                </li>
              );
            })}
          </ul>
        )}

        {result.total > per ? (
          <div className="flex items-center justify-between pt-2">
            <PageButton
              to={page - 1}
              per={per}
              types={types}
              unread={unreadOnly}
              disabled={page <= 1}
            >
              Previous
            </PageButton>
            <PageButton
              to={page + 1}
              per={per}
              types={types}
              unread={unreadOnly}
              disabled={page >= totalPages}
            >
              Next
            </PageButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
