import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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
  const memberLabel = memberCount === 1 ? "1 member" : `${memberCount} members`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-xl">{group.name}</CardTitle>
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
          {isApproved ? (
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
                  <Avatar size="sm">
                    <AvatarFallback>{initials(m.name, m.email)}</AvatarFallback>
                  </Avatar>
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
