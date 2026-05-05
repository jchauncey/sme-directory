import Link from "next/link";
import { GroupCard } from "@/components/groups/group-card";
import { SortTabs } from "@/components/groups/sort-tabs";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { listGroups, type ListGroupsSort } from "@/lib/groups";

type Props = {
  searchParams: Promise<{ sort?: string; includeArchived?: string }>;
};

function parseSort(value: string | undefined): ListGroupsSort {
  return value === "members" ? "members" : "newest";
}

function buildToggleHref(sort: ListGroupsSort, includeArchived: boolean): string {
  const params = new URLSearchParams();
  if (sort === "members") params.set("sort", "members");
  if (!includeArchived) params.set("includeArchived", "1");
  const qs = params.toString();
  return qs ? `/groups?${qs}` : "/groups";
}

export default async function GroupsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const includeArchived = sp.includeArchived === "1";
  const [session, groups] = await Promise.all([
    getSession(),
    listGroups({ sort, includeArchived }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Browse subject-matter expert groups.
          </p>
        </div>
        {session ? <Button render={<Link href="/groups/new" />}>Create group</Button> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SortTabs active={sort} includeArchived={includeArchived} />
        <Link
          href={buildToggleHref(sort, includeArchived)}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No groups yet.{" "}
          {session ? (
            <Link href="/groups/new" className="underline">
              Create the first one
            </Link>
          ) : (
            "Sign in to create one."
          )}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
