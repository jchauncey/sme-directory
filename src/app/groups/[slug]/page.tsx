import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import { getMembership } from "@/lib/memberships";
import { MembershipActions } from "./membership-actions";

type Props = { params: Promise<{ slug: string }> };

export default async function GroupDetailPage({ params }: Props) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  const session = await getSession();
  const membership = session ? await getMembership(group.id, session.user.id) : null;
  const isOwner = membership?.role === "owner" && membership.status === "approved";

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl">{group.name}</CardTitle>
              <CardDescription>
                <span className="font-mono text-xs">{group.slug}</span>
                {" · "}
                <span>
                  {group.autoApprove ? "auto-approves new members" : "requires owner approval"}
                </span>
              </CardDescription>
            </div>
            {isOwner ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/groups/${group.slug}/settings`} />}
              >
                Settings
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {group.description ? (
            <p className="text-sm">{group.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description yet.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Owner: {group.createdBy.name ?? group.createdBy.email}
          </p>
          <MembershipActions
            slug={group.slug}
            isAuthenticated={Boolean(session)}
            currentUserId={session?.user.id ?? null}
            membership={membership ? { role: membership.role, status: membership.status } : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
