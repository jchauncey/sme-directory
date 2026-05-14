import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { listAllUsersForAdmin } from "@/lib/admin";
import { UserRowActions } from "./user-row-actions";

type Props = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await requireSuperAdmin();
  const { page: pageRaw, q } = await searchParams;
  const page = Number(pageRaw) || 1;
  const { items, total, per } = await listAllUsersForAdmin({ page, per: 25, search: q });
  const totalPages = Math.max(1, Math.ceil(total / per));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">All users ({total})</h2>
      </div>
      <form method="get" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search email or name"
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Search
        </button>
        {q ? (
          <Link href="/admin/users" className="text-sm hover:underline">
            Clear
          </Link>
        ) : null}
      </form>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Memberships</th>
              <th className="px-3 py-2">Questions</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <div className="font-medium">{u.name ?? "(no name)"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-3 py-2">{u.membershipCount}</td>
                <td className="px-3 py-2">{u.questionCount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {u.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  {u.isSuperAdmin ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      Super admin
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">user</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <UserRowActions
                    userId={u.id}
                    userLabel={u.name?.trim() || u.email || u.id}
                    isSuperAdmin={u.isSuperAdmin}
                    isSelf={session.user.id === u.id}
                  />
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
              href={`/admin/users?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
              href={`/admin/users?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
