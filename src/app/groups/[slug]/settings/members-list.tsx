"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

export type MembersListItem = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "member" | "moderator" | "owner";
};

type Props = {
  slug: string;
  viewerUserId: string;
  viewerIsOwner: boolean;
  archived: boolean;
  members: MembersListItem[];
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function MembersList({
  slug,
  viewerUserId,
  viewerIsOwner,
  archived,
  members,
}: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members yet.</p>;
  }

  async function changeRole(member: MembersListItem, role: "member" | "moderator") {
    setBusyId(member.userId);
    try {
      const res = await fetch(`/api/groups/${slug}/membership/${member.userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success(
        role === "moderator"
          ? `Promoted ${member.name ?? member.email ?? "member"} to moderator.`
          : `Demoted ${member.name ?? member.email ?? "moderator"} to member.`,
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: MembersListItem) {
    const label = member.name ?? member.email ?? "this member";
    if (!confirm(`Remove ${label} from the group? They will lose access immediately.`)) {
      return;
    }
    setBusyId(member.userId);
    try {
      const res = await fetch(`/api/groups/${slug}/membership/${member.userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success(`Removed ${label} from the group.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="divide-y rounded-md border">
      {members.map((m) => {
        const showPromote =
          viewerIsOwner && m.role === "member" && !archived;
        const showDemote =
          viewerIsOwner && m.role === "moderator" && !archived;
        const showRemove =
          m.role !== "owner" && m.userId !== viewerUserId && !archived;
        const disabled = busyId !== null;

        return (
          <li key={m.userId} className="flex items-center justify-between gap-4 p-3">
            <div className="flex items-center gap-3">
              <UserAvatar user={m} size="sm" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {m.name ?? m.email ?? m.userId}
                </p>
                {m.name && m.email ? (
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                ) : null}
              </div>
              {m.role !== "member" ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {m.role}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {showPromote ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => changeRole(m, "moderator")}
                >
                  {busyId === m.userId ? "…" : "Promote to moderator"}
                </Button>
              ) : null}
              {showDemote ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => changeRole(m, "member")}
                >
                  {busyId === m.userId ? "…" : "Demote to member"}
                </Button>
              ) : null}
              {showRemove ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => remove(m)}
                >
                  {busyId === m.userId ? "…" : "Remove"}
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
