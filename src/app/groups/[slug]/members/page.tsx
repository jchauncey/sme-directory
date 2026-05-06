import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getGroupBySlug } from "@/lib/groups";
import { listApprovedMembersPage } from "@/lib/memberships";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

const PER_PAGE = 20;

export default async function GroupMembersPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  const page = Math.max(Number(sp.page) || 1, 1);
  const membersPage = await listApprovedMembersPage(group.id, { page, per: PER_PAGE });

  const totalPages = Math.max(Math.ceil(membersPage.total / PER_PAGE), 1);
  const memberLabel =
    membersPage.total === 1 ? "1 member" : `${membersPage.total} members`;

  const buildHref = (p: number): string =>
    p > 1
      ? `/groups/${group.slug}/members?page=${p}`
      : `/groups/${group.slug}/members`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/groups/${group.slug}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to {group.name}
        </Link>
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Members of {group.name}</CardTitle>
          <CardDescription>{memberLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {membersPage.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {membersPage.items.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3 text-sm">
                    <UserAvatar user={m} size="sm" />
                    <Link
                      href={`/u/${m.userId}`}
                      className="hover:underline"
                    >
                      {m.name ?? m.email ?? "Anonymous"}
                    </Link>
                    {m.role !== "member" ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {m.role}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                buildHref={buildHref}
                label="Members pagination"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
