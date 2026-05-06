import Link from "next/link";
import { NotificationPreferencesControl } from "@/components/notification-preferences-control";
import type { NotificationCategory } from "@/lib/notification-categories";
import type { ProfileGroupItem } from "@/lib/profile";

type Props = {
  items: ProfileGroupItem[];
  viewer: "self" | "public";
  emptyState: React.ReactNode;
  /** Map of groupId -> muted category list. Only honored when viewer === "self". */
  mutedTypesByGroupId?: Record<string, NotificationCategory[]>;
};

export function ProfileGroupList({
  items,
  viewer,
  emptyState,
  mutedTypesByGroupId,
}: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyState}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((g) => {
        const showMutes = viewer === "self" && g.status === "approved";
        const muted = mutedTypesByGroupId?.[g.id] ?? [];
        return (
          <li key={g.id} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                href={`/groups/${g.slug}`}
                className="font-medium hover:underline"
              >
                {g.name}
              </Link>
              <span className="font-mono text-xs text-muted-foreground">
                {g.slug}
              </span>
              {g.role !== "member" ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.role}
                </span>
              ) : null}
              {viewer === "self" && g.status !== "approved" ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {g.status}
                </span>
              ) : null}
            </div>
            {showMutes ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Notification settings
                </summary>
                <div className="pt-2">
                  <NotificationPreferencesControl
                    groupId={g.id}
                    groupName={g.name}
                    initialMutedTypes={muted}
                  />
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
