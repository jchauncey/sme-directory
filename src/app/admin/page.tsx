import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getAdminDashboardStats } from "@/lib/admin";

function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function AdminDashboardPage() {
  await requireSuperAdmin();
  const stats = await getAdminDashboardStats();
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Users" value={stats.totalUsers} href="/admin/users" />
        <StatCard label="Super admins" value={stats.totalSuperAdmins} href="/admin/users" />
        <StatCard label="Groups" value={stats.totalGroups} href="/admin/groups" />
        <StatCard label="Archived" value={stats.archivedGroups} href="/admin/groups" />
        <StatCard label="Questions" value={stats.totalQuestions} href="/admin/content/questions" />
        <StatCard label="Answers" value={stats.totalAnswers} href="/admin/content/answers" />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Recent admin actions</h2>
          <Link href="/admin/audit" className="text-sm hover:underline">
            View all →
          </Link>
        </div>
        {stats.recentActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {stats.recentActions.map((row) => (
              <li key={row.id} className="px-4 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {row.createdAt.toISOString()}
                </span>{" "}
                <span className="font-medium">
                  {row.actorName ?? row.actorEmail ?? "(deleted)"}
                </span>{" "}
                — <span className="font-mono">{row.action}</span>{" "}
                <span className="text-muted-foreground">
                  {row.targetType}:{row.targetId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
