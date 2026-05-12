import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileGroupList } from "@/components/profile/profile-group-list";
import { requireAuth } from "@/lib/auth";
import { listPreferencesForUser } from "@/lib/notification-preferences";
import { listGroupsForUser } from "@/lib/profile";

export default async function MyGroupsPage() {
  const session = await requireAuth();
  const userId = session.user.id;

  const [allGroups, preferences] = await Promise.all([
    listGroupsForUser(userId, { includePending: true }),
    listPreferencesForUser(userId),
  ]);

  const approved = allGroups.filter((g) => g.status === "approved");
  const pending = allGroups.filter((g) => g.status !== "approved");

  const mutedTypesByGroupId = Object.fromEntries(preferences.map((p) => [p.groupId, p.mutedTypes]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your groups {approved.length > 0 ? `(${approved.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileGroupList
            items={approved}
            viewer="self"
            mutedTypesByGroupId={mutedTypesByGroupId}
            emptyState={
              <>
                You&rsquo;re not in any groups yet.{" "}
                <Link href="/groups" className="underline">
                  Browse groups
                </Link>
                .
              </>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Pending applications {pending.length > 0 ? `(${pending.length})` : ""}
          </CardTitle>
          <CardDescription>Groups you&rsquo;ve applied to, with current status.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileGroupList items={pending} viewer="self" emptyState="No pending applications." />
        </CardContent>
      </Card>
    </div>
  );
}
