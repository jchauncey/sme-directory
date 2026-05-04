"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { MarkdownBody } from "@/components/markdown-body";
import {
  deleteAnswerAction,
  updateAnswerAction,
  type AnswerFormState,
} from "./actions";

const initialEditState: AnswerFormState = {};

function fieldError(state: AnswerFormState, path: string): string | undefined {
  return state.fieldErrors?.find((e) => e.path === path)?.message;
}

type Props = {
  answerId: string;
  questionId: string;
  body: string;
  canEdit: boolean;
  canDelete: boolean;
};

export function AnswerActions({
  answerId,
  questionId,
  body,
  canEdit,
  canDelete,
}: Props) {
  const [editing, setEditing] = useState(false);

  const editAction = updateAnswerAction.bind(null, answerId, questionId);
  const [editState, editFormAction, editPending] = useActionState(
    editAction,
    initialEditState,
  );

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();

  useEffect(() => {
    if (editState.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(false);
    }
  }, [editState.ok]);

  const onDeleteClick = () => {
    if (!confirm("Delete this answer? This cannot be undone.")) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteAnswerAction(answerId, questionId);
      if (result.error) setDeleteError(result.error);
    });
  };

  if (editing) {
    return (
      <form action={editFormAction} className="space-y-2">
        <textarea
          name="body"
          rows={6}
          required
          minLength={1}
          maxLength={20000}
          defaultValue={editState.values?.body ?? body}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-100"
        />
        {fieldError(editState, "body") ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {fieldError(editState, "body")}
          </p>
        ) : null}
        {editState.error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {editState.error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={editPending}
            className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {editPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <MarkdownBody source={body} />
      {canEdit || canDelete ? (
        <div className="flex items-center gap-3 pt-1">
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={onDeleteClick}
              disabled={deletePending}
              className="text-xs text-red-600 underline hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
            >
              {deletePending ? "Deleting…" : "Delete"}
            </button>
          ) : null}
          {deleteError ? (
            <span className="text-xs text-red-600 dark:text-red-400" role="alert">
              {deleteError}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
