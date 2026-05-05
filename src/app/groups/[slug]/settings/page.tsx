import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import { isOwner, listPendingApplications } from "@/lib/memberships";
import { ArchiveControls } from "./archive-controls";
import { AutoApproveToggle } from "./auto-approve-toggle";
import { PendingApplicationsList, type PendingApplicationView } from "./pending-applications-list";

type Props = { params: Promise<{ slug: string }> };

export default async function GroupSettingsPage({ params }: Props) {
  const { slug } = await params;
  const session = await requireAuth();
  const group = await getGroupBySlug(slug);
  if (!group) notFound();
  if (!(await isOwner(group.id, session.user.id))) notFound();

  const pending = group.archivedAt
    ? []
    : await listPendingApplications(group.id);
  const applications: PendingApplicationView[] = pending.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    appliedAt: m.createdAt.toISOString(),
  }));

  const isArchived = group.archivedAt != null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-xs">{group.slug}</span>
            {" · "}
            {group.name}
            {isArchived ? (
              <span className="ml-2 rounded-md border border-border px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Archived
              </span>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" render={<Link href={`/groups/${group.slug}`} />}>
          Back to group
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membership</CardTitle>
          <CardDescription>
            {isArchived
              ? "Archived groups are read-only. Restore the group to manage membership."
              : "Control how new members join this group."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isArchived ? (
            <p className="text-sm text-muted-foreground">
              Auto-approve is currently {group.autoApprove ? "on" : "off"}.
            </p>
          ) : (
            <AutoApproveToggle slug={group.slug} initial={group.autoApprove} />
          )}
        </CardContent>
      </Card>

      {isArchived ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Pending applications</CardTitle>
            <CardDescription>
              {applications.length === 0
                ? "Nothing waiting for review."
                : `${applications.length} ${applications.length === 1 ? "person is" : "people are"} waiting to join.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingApplicationsList slug={group.slug} applications={applications} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isArchived ? "Restore" : "Danger zone"}</CardTitle>
          <CardDescription>
            {isArchived
              ? "Restore this group to make it read-write again. It will reappear in the default group list and search."
              : "Archive this group to make it read-only. The page stays browsable so existing links keep working."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArchiveControls slug={group.slug} archived={isArchived} />
        </CardContent>
      </Card>
    </div>
  );
}
