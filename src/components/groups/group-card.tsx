import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GroupListItem } from "@/lib/groups";

export function GroupCard({ group }: { group: GroupListItem }) {
  const memberLabel = group.memberCount === 1 ? "member" : "members";
  const isArchived = group.archivedAt != null;
  return (
    <Link
      href={`/groups/${group.slug}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-xl"
    >
      <Card
        className={`h-full transition-shadow hover:shadow-md ${isArchived ? "opacity-70" : ""}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{group.name}</CardTitle>
            {isArchived ? (
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Archived
              </span>
            ) : null}
          </div>
          <CardDescription>
            <span className="font-mono text-xs">{group.slug}</span>
            {" · "}
            <span>
              {group.memberCount} {memberLabel}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {group.description ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">{group.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description yet.</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
