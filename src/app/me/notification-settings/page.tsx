import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotificationPreferencesControl } from "@/components/notification-preferences-control";
import { requireAuth } from "@/lib/auth";
import { listPreferencesForUser } from "@/lib/notification-preferences";
import { listGroupsForUser } from "@/lib/profile";

export default async function NotificationSettingsPage() {
  const session = await requireAuth();
  const userId = session.user.id;

  const [groups, preferences] = await Promise.all([
    listGroupsForUser(userId, { includePending: false }),
    listPreferencesForUser(userId),
  ]);

  const mutedByGroupId = new Map(preferences.map((p) => [p.groupId, p.mutedTypes]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Notification settings</CardTitle>
          <CardDescription>
            Mute categories of notifications per group. Changes save automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You&rsquo;re not in any groups yet.{" "}
              <Link href="/groups" className="underline">
                Browse groups
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-4">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="space-y-2 rounded-md border border-border p-3"
                >
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
                  </div>
                  <NotificationPreferencesControl
                    groupId={g.id}
                    groupName={g.name}
                    initialMutedTypes={mutedByGroupId.get(g.id) ?? []}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
