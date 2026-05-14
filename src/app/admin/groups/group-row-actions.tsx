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
import {
  adminArchiveGroupAction,
  adminDeleteGroupAction,
  adminUnarchiveGroupAction,
} from "./actions";

type Props = {
  slug: string;
  name: string;
  archived: boolean;
};

export function GroupRowActions({ slug, name, archived }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [slugConfirmation, setSlugConfirmation] = useState("");

  const runArchive = () =>
    startTransition(async () => {
      setError(null);
      const result = await adminArchiveGroupAction(slug, readCsrfToken());
      if (result.error) setError(result.error);
    });

  const runUnarchive = () =>
    startTransition(async () => {
      setError(null);
      const result = await adminUnarchiveGroupAction(slug, readCsrfToken());
      if (result.error) setError(result.error);
    });

  const openDelete = () => {
    setSlugConfirmation("");
    setError(null);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (slugConfirmation !== slug) return;
    setDeleteOpen(false);
    startTransition(async () => {
      setError(null);
      const result = await adminDeleteGroupAction(slug, readCsrfToken());
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {archived ? (
        <button
          type="button"
          onClick={runUnarchive}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          onClick={runArchive}
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
        >
          Archive
        </button>
      )}
      <button
        type="button"
        onClick={openDelete}
        disabled={pending}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700/60 dark:text-red-300 dark:hover:bg-red-900/20"
      >
        Delete
      </button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{name}&rdquo; entirely?</DialogTitle>
            <DialogDescription>
              This permanently removes the group along with every question, answer, vote,
              favorite, and membership. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <label className="block text-sm">
            <span className="text-muted-foreground">
              Type <span className="font-mono font-semibold">{slug}</span> to confirm:
            </span>
            <input
              type="text"
              value={slugConfirmation}
              onChange={(e) => setSlugConfirmation(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-sm"
              aria-label="Group slug confirmation"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={slugConfirmation !== slug}
            >
              Delete group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}
