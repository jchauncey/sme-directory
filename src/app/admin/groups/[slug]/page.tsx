import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { getAdminGroupBySlug, listGroupMembersForAdmin } from "@/lib/admin";
import { AddMemberForm } from "./add-member-form";
import { MemberRowActions } from "./member-row-actions";

type Props = { params: Promise<{ slug: string }> };

export default async function AdminGroupDetailPage({ params }: Props) {
  await requireSuperAdmin();
  const { slug } = await params;
  const group = await getAdminGroupBySlug(slug);
  if (!group) notFound();

  const members = await listGroupMembersForAdmin(group.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">{group.name}</h2>
          <p className="text-xs text-muted-foreground">/{group.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/groups/${group.slug}`} className="text-sm hover:underline">
            View public page →
          </Link>
          {group.archivedAt ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Archived
            </span>
          ) : null}
        </div>
      </div>

      {group.description ? (
        <p className="rounded-lg border border-border bg-card p-3 text-sm">{group.description}</p>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-medium">Add member</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Look up an existing user by email and add them to this group at the chosen role. The
          membership is created as approved.
        </p>
        <AddMemberForm groupId={group.id} groupSlug={group.slug} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">Members ({members.length})</h3>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const label = m.name?.trim() || m.email || m.userId;
                return (
                  <tr key={m.membershipId}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.name ?? "(no name)"}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {m.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <MemberRowActions
                        groupId={group.id}
                        groupSlug={group.slug}
                        userId={m.userId}
                        userLabel={label}
                        role={m.role}
                        status={m.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
