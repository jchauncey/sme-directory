import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ListGroupsSort } from "@/lib/groups";

const TABS: ReadonlyArray<{ value: ListGroupsSort; label: string; href: string }> = [
  { value: "newest", label: "Newest", href: "/groups" },
  { value: "members", label: "Most members", href: "/groups?sort=members" },
];

export function SortTabs({ active }: { active: ListGroupsSort }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={t.href}
          aria-current={t.value === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            t.value === active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
