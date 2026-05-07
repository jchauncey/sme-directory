"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readCsrfToken } from "@/lib/csrf-client";
import { archiveGroupAction, unarchiveGroupAction } from "./actions";

type Props = {
  slug: string;
  archived: boolean;
};

export function ArchiveControls({ slug, archived }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onArchiveConfirm = () => {
    setError(null);
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await archiveGroupAction(slug, readCsrfToken());
      if (result.error) setError(result.error);
    });
  };

  const onUnarchive = () => {
    setError(null);
    startTransition(async () => {
      const result = await unarchiveGroupAction(slug, readCsrfToken());
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {archived ? (
        <button
          type="button"
          onClick={onUnarchive}
          disabled={pending}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {pending ? "Restoring…" : "Restore group"}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700/60 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            {pending ? "Archiving…" : "Archive group"}
          </button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archive this group?</DialogTitle>
                <DialogDescription>
                  It becomes read-only — no new questions, answers, votes, or applications. The
                  group is hidden from the default list and search; existing content stays
                  browsable. You can restore it later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={onArchiveConfirm}>
                  Archive group
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
