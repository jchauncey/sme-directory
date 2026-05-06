import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GroupAvatar } from "@/components/ui/group-avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getSession } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import {
  countApprovedMembers,
  getMembership,
  listApprovedMembers,
} from "@/lib/memberships";
import { listQuestionsForGroup } from "@/lib/questions";
import { MembershipActions } from "./membership-actions";

type Props = { params: Promise<{ slug: string }> };

const MEMBER_PREVIEW_LIMIT = 12;

function authorLabel(a: { name: string | null; email: string | null }): string {
  return a.name ?? a.email ?? "unknown";
}

export default async function GroupDetailPage({ params }: Props) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  const session = await getSession();
  const [memberCount, members, membership, questions] = await Promise.all([
    countApprovedMembers(group.id),
    listApprovedMembers(group.id, MEMBER_PREVIEW_LIMIT),
    session ? getMembership(group.id, session.user.id) : Promise.resolve(null),
    listQuestionsForGroup(group.id, { page: 1, per: 20 }),
  ]);

  const isOwner = membership?.role === "owner" && membership.status === "approved";
  const isApproved = membership?.status === "approved";
  const isArchived = group.archivedAt != null;
  const memberLabel = memberCount === 1 ? "1 member" : `${memberCount} members`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {isArchived ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20">
          <CardContent className="py-3 text-sm">
            <strong>This group is archived.</strong>{" "}
            It is read-only — no new questions, answers, votes, or applications. Existing
            content remains visible.
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <GroupAvatar group={group} size="lg" />
              <div className="space-y-1">
                <CardTitle className="text-xl">
                  {group.name}
                  {isArchived ? (
                    <span className="ml-2 rounded-md border border-border px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Archived
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  <span className="font-mono text-xs">{group.slug}</span>
                  {" · "}
                  <span>{memberLabel}</span>
                  {" · "}
                  <span>
                    {group.autoApprove
                      ? "auto-approves new members"
                      : "requires owner approval"}
                  </span>
                </CardDescription>
              </div>
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
          {isArchived ? null : (
            <MembershipActions
              slug={group.slug}
              isAuthenticated={Boolean(session)}
              currentUserId={session?.user.id ?? null}
              membership={
                membership ? { role: membership.role, status: membership.status } : null
              }
            />
          )}
          {isApproved && !isArchived ? (
            <Button
              variant="default"
              size="sm"
              render={<Link href={`/groups/${group.slug}/ask`} />}
            >
              Ask a question
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {memberCount === 0
              ? "No members yet."
              : `${memberLabel}${
                  members.length < memberCount ? ` · showing ${members.length}` : ""
                }`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 text-sm">
                  <UserAvatar user={m} size="sm" />
                  <span>{m.name ?? m.email ?? "Anonymous"}</span>
                  {m.role !== "member" ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {m.role}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Questions {questions.total > 0 ? `(${questions.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {questions.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions yet.
              {isApproved ? " Be the first to ask one." : ""}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {questions.items.map((q) => (
                <li key={q.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/q/${q.id}`} className="text-sm font-medium hover:underline">
                    {q.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {authorLabel(q.author)} · {q.answerCount}{" "}
                    {q.answerCount === 1 ? "answer" : "answers"} · Score {q.voteScore}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
