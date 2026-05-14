import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { listAllQuestionsForAdmin } from "@/lib/admin";
import { DeleteContentButton } from "../delete-content-button";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function AdminQuestionsPage({ searchParams }: Props) {
  await requireSuperAdmin();
  const { page: pageRaw } = await searchParams;
  const page = Number(pageRaw) || 1;
  const { items, total, per } = await listAllQuestionsForAdmin({ page, per: 25 });
  const totalPages = Math.max(1, Math.ceil(total / per));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Questions ({total})</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Author</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((q) => (
              <tr key={q.id}>
                <td className="px-3 py-2">
                  <Link href={`/q/${q.id}`} className="font-medium hover:underline">
                    {q.title}
                  </Link>
                  {q.deletedAt ? (
                    <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-[10px] uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      Soft-deleted
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/groups/${q.groupSlug}`} className="hover:underline">
                    {q.groupName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {q.authorName ?? q.authorId}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {q.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <DeleteContentButton kind="question" id={q.id} label={q.title} />
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
              href={`/admin/content/questions?page=${page - 1}`}
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
              href={`/admin/content/questions?page=${page + 1}`}
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
