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
  return (
    <Link
      href={`/groups/${group.slug}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-xl"
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-base">{group.name}</CardTitle>
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
