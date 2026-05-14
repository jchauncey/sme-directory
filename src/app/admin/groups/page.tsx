import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { listAllGroupsForAdmin } from "@/lib/admin";
import { GroupRowActions } from "./group-row-actions";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function AdminGroupsPage({ searchParams }: Props) {
  await requireSuperAdmin();
  const { page: pageRaw } = await searchParams;
  const page = Number(pageRaw) || 1;
  const { items, total, per } = await listAllGroupsForAdmin({ page, per: 25 });
  const totalPages = Math.max(1, Math.ceil(total / per));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">All groups ({total})</h2>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Members</th>
              <th className="px-3 py-2">Questions</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((g) => (
              <tr key={g.id}>
                <td className="px-3 py-2">
                  <Link href={`/admin/groups/${g.slug}`} className="font-medium hover:underline">
                    {g.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">/{g.slug}</div>
                </td>
                <td className="px-3 py-2">{g.memberCount}</td>
                <td className="px-3 py-2">{g.questionCount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {g.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  {g.archivedAt ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      Archived
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">active</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <GroupRowActions slug={g.slug} name={g.name} archived={g.archivedAt != null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <nav className="flex items-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/groups?page=${page - 1}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-muted"
            >
              ← Previous
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/admin/groups?page=${page + 1}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-muted"
            >
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
