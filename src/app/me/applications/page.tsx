import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileGroupList } from "@/components/profile/profile-group-list";
import { requireAuth } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/profile";

export default async function ApplicationsPage() {
  const session = await requireAuth();
  const groups = await listGroupsForUser(session.user.id, {
    includePending: true,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your applications {groups.length > 0 ? `(${groups.length})` : ""}
          </CardTitle>
          <CardDescription>
            Groups you&rsquo;ve joined or applied to, with current status.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileGroupList
            items={groups}
            viewer="self"
            emptyState="You haven't applied to any groups yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
