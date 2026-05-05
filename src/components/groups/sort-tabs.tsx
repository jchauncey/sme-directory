import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ListGroupsSort } from "@/lib/groups";

const TABS: ReadonlyArray<{ value: ListGroupsSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "members", label: "Most members" },
];

function buildHref(sort: ListGroupsSort, includeArchived: boolean): string {
  const params = new URLSearchParams();
  if (sort === "members") params.set("sort", "members");
  if (includeArchived) params.set("includeArchived", "1");
  const qs = params.toString();
  return qs ? `/groups?${qs}` : "/groups";
}

export function SortTabs({
  active,
  includeArchived,
}: {
  active: ListGroupsSort;
  includeArchived: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={buildHref(t.value, includeArchived)}
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
