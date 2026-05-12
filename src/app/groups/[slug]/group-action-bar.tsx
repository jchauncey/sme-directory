"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MaterialIcon } from "@/components/ui/material-icon";
import { NotificationPreferencesControl } from "@/components/notification-preferences-control";
import { GroupFavoriteButton } from "@/components/groups/group-favorite-button";
import { csrfFetch } from "@/lib/csrf-client";
import type { NotificationCategory } from "@/lib/notification-categories";

type MembershipShape = {
  role: "member" | "moderator" | "owner";
  status: "pending" | "approved" | "rejected";
};

type Props = {
  slug: string;
  groupId: string;
  groupName: string;
  isAuthenticated: boolean;
  currentUserId: string | null;
  membership: MembershipShape | null;
  isArchived: boolean;
  initialMutedTypes: NotificationCategory[];
  initialFavorited: boolean;
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function GroupActionBar({
  slug,
  groupId,
  groupName,
  isAuthenticated,
  currentUserId,
  membership,
  isArchived,
  initialMutedTypes,
  initialFavorited,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isApproved = membership?.status === "approved";
  const isPending = membership?.status === "pending";

  async function apply() {
    setBusy(true);
    try {
      const res = await csrfFetch(`/api/groups/${slug}/membership`, { method: "POST" });
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

  async function cancelApplication() {
    setBusy(true);
    try {
      const res = await csrfFetch(`/api/groups/${slug}/membership/${currentUserId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success("Application cancelled.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function renderMembershipControl() {
    if (isArchived) return null;

    if (!isAuthenticated) {
      return (
        <Button variant="default" size="sm" render={<Link href="/login" />}>
          Sign in to join
        </Button>
      );
    }

    if (isApproved) {
      return (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Leave group"
          title="Leave group"
          render={<Link href={`/groups/${slug}/leave`} />}
        >
          <MaterialIcon name="logout" />
        </Button>
      );
    }

    if (isPending) {
      return (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel application"
          title="Cancel application"
          disabled={busy}
          onClick={cancelApplication}
        >
          <MaterialIcon name="cancel" />
        </Button>
      );
    }

    // No membership or rejected.
    return (
      <Button variant="default" size="sm" disabled={busy} onClick={apply}>
        {busy ? "Applying…" : "Apply to join"}
      </Button>
    );
  }

  const showApproveeIcons = isApproved && !isArchived;

  return (
    <div className="flex items-center gap-1">
      {isAuthenticated ? (
        <GroupFavoriteButton groupId={groupId} slug={slug} initialFavorited={initialFavorited} />
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="View members"
        title="View members"
        render={<Link href={`/groups/${slug}/members`} />}
      >
        <MaterialIcon name="group" />
      </Button>

      {showApproveeIcons ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ask a question"
          title="Ask a question"
          render={<Link href={`/groups/${slug}/ask`} />}
        >
          <MaterialIcon name="add_comment" />
        </Button>
      ) : null}

      {showApproveeIcons ? (
        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notification settings"
                title="Notification settings"
              />
            }
          >
            <MaterialIcon name="notifications" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Notification settings</DialogTitle>
              <DialogDescription>
                Control which {groupName} activity sends you notifications.
              </DialogDescription>
            </DialogHeader>
            <NotificationPreferencesControl
              groupId={groupId}
              groupName={groupName}
              initialMutedTypes={initialMutedTypes}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {renderMembershipControl()}
    </div>
  );
}
