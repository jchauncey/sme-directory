"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type MembershipShape = {
  role: "member" | "moderator" | "owner";
  status: "pending" | "approved" | "rejected";
};

type Props = {
  slug: string;
  isAuthenticated: boolean;
  currentUserId: string | null;
  membership: MembershipShape | null;
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function MembershipActions({ slug, isAuthenticated, currentUserId, membership }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) {
    return (
      <Button variant="default" size="sm" render={<Link href="/login" />}>
        Sign in to join
      </Button>
    );
  }

  if (membership?.role === "owner" && membership.status === "approved") {
    return null;
  }

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${slug}/membership`, { method: "POST" });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      const body = (await res.json()) as { membership: MembershipShape };
      toast.success(
        body.membership.status === "approved"
          ? "You're a member of this group."
          : "Application submitted.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function leaveOrCancel() {
    if (!currentUserId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${slug}/membership/${currentUserId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success(
        membership?.status === "pending" ? "Application cancelled." : "Left the group.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!membership || membership.status === "rejected") {
    return (
      <Button variant="default" size="sm" disabled={busy} onClick={apply}>
        {busy ? "Applying…" : "Apply to join"}
      </Button>
    );
  }

  if (membership.status === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Application pending review.</span>
        <Button variant="outline" size="sm" disabled={busy} onClick={leaveOrCancel}>
          {busy ? "Cancelling…" : "Cancel application"}
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={leaveOrCancel}>
      {busy ? "Leaving…" : "Leave group"}
    </Button>
  );
}
