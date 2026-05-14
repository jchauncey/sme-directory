import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { listAdminAuditLog } from "@/lib/admin";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function AdminAuditPage({ searchParams }: Props) {
  await requireSuperAdmin();
  const { page: pageRaw } = await searchParams;
  const page = Number(pageRaw) || 1;
  const { items, total, per } = await listAdminAuditLog({ page, per: 50 });
  const totalPages = Math.max(1, Math.ceil(total / per));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Audit log ({total})</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.actorName ?? r.actorEmail ?? (
                    <span className="text-muted-foreground">(deleted)</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.targetType}:{r.targetId}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-all">
                    {r.metadata}
                  </pre>
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
              href={`/admin/audit?page=${page - 1}`}
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
              href={`/admin/audit?page=${page + 1}`}
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
