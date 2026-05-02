import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGroupBySlug } from "@/lib/groups";
import {
  getUserMembershipStatus,
  listSuccessorCandidates,
} from "@/lib/memberships";
import { confirmLeaveAction } from "../actions";

type Props = { params: Promise<{ slug: string }> };

export default async function LeaveGroupPage({ params }: Props) {
  const { slug } = await params;
  const session = await requireAuth();
  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  const membership = await getUserMembershipStatus(group.id, session.user.id);
  if (!membership) {
    redirect(`/groups/${slug}`);
  }

  const isApprovedOwner = membership.role === "owner" && membership.status === "approved";
  let isSoleOwner = false;
  let candidates: Awaited<ReturnType<typeof listSuccessorCandidates>> = [];

  if (isApprovedOwner) {
    const otherOwners = await db.membership.count({
      where: {
        groupId: group.id,
        role: "owner",
        status: "approved",
        userId: { not: session.user.id },
      },
    });
    isSoleOwner = otherOwners === 0;
    if (isSoleOwner) {
      candidates = await listSuccessorCandidates(group.id, session.user.id);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leave group</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re about to leave <span className="font-medium">{group.name}</span>.
        </p>
      </div>

      {isSoleOwner && candidates.length === 0 ? (
        <SoleOwnerNoSuccessorsCard slug={slug} />
      ) : isSoleOwner ? (
        <SoleOwnerWithSuccessorsCard slug={slug} candidates={candidates} />
      ) : (
        <SimpleLeaveCard slug={slug} />
      )}
    </div>
  );
}

function SimpleLeaveCard({ slug }: { slug: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Confirm</CardTitle>
        <CardDescription>You can re-apply later if you change your mind.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={confirmLeaveAction.bind(null, slug)} className="flex gap-2">
          <Button type="submit" variant="destructive">
            Yes, leave
          </Button>
          <Button variant="outline" render={<Link href={`/groups/${slug}`} />}>
            Cancel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SoleOwnerWithSuccessorsCard({
  slug,
  candidates,
}: {
  slug: string;
  candidates: Awaited<ReturnType<typeof listSuccessorCandidates>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pick a new owner</CardTitle>
        <CardDescription>
          You&apos;re the only owner. Promote another approved member to owner before you leave.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={confirmLeaveAction.bind(null, slug)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="successorUserId" className="block text-sm font-medium">
              New owner
            </label>
            <select
              id="successorUserId"
              name="successorUserId"
              required
              defaultValue=""
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="" disabled>
                Choose a member…
              </option>
              {candidates.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {(c.name ?? c.email ?? "Anonymous") +
                    (c.role !== "member" ? ` (${c.role})` : "")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive">
              Promote and leave
            </Button>
            <Button variant="outline" render={<Link href={`/groups/${slug}`} />}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SoleOwnerNoSuccessorsCard({ slug }: { slug: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">You can&apos;t leave yet</CardTitle>
        <CardDescription>
          You&apos;re the only member of this group, so there&apos;s no one to take over as
          owner. Group deletion isn&apos;t available yet — once the group has at least one
          other approved member you&apos;ll be able to transfer ownership and leave.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" render={<Link href={`/groups/${slug}`} />}>
          Back to group
        </Button>
      </CardContent>
    </Card>
  );
}
