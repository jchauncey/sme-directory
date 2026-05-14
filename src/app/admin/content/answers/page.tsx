import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { listAllAnswersForAdmin } from "@/lib/admin";
import { DeleteContentButton } from "../delete-content-button";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function AdminAnswersPage({ searchParams }: Props) {
  await requireSuperAdmin();
  const { page: pageRaw } = await searchParams;
  const page = Number(pageRaw) || 1;
  const { items, total, per } = await listAllAnswersForAdmin({ page, per: 25 });
  const totalPages = Math.max(1, Math.ceil(total / per));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Answers ({total})</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Excerpt</th>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Author</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((a) => {
              const excerpt = a.body.length > 120 ? a.body.slice(0, 120) + "…" : a.body;
              return (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-xs">{excerpt}</td>
                  <td className="px-3 py-2">
                    <Link href={`/q/${a.questionId}`} className="hover:underline">
                      {a.questionTitle}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {a.authorName ?? a.authorId}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {a.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <DeleteContentButton kind="answer" id={a.id} label={excerpt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <nav className="flex items-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/content/answers?page=${page - 1}`}
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
              href={`/admin/content/answers?page=${page + 1}`}
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
