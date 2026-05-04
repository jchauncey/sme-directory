import Link from "next/link";
import type { ProfileGroupItem } from "@/lib/profile";

type Props = {
  items: ProfileGroupItem[];
  viewer: "self" | "public";
  emptyState: React.ReactNode;
};

export function ProfileGroupList({ items, viewer, emptyState }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyState}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((g) => (
        <li key={g.id} className="flex items-center gap-2 text-sm">
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
        </li>
      ))}
    </ul>
  );
}
