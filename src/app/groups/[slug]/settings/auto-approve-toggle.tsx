"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { toggleAutoApproveAction, type ToggleAutoApproveState } from "./actions";

const initialState: ToggleAutoApproveState = {};

type Props = { slug: string; initial: boolean };

export function AutoApproveToggle({ slug, initial }: Props) {
  const [state, formAction, isPending] = useActionState(toggleAutoApproveAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const checked = state.autoApprove ?? initial;

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex items-center justify-between gap-4 rounded-md border p-4"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="space-y-0.5">
        <label htmlFor="autoApprove" className="text-sm font-medium">
          Auto-approve membership requests
        </label>
        <p className="text-xs text-muted-foreground">
          New applications are accepted immediately without owner review.
        </p>
      </div>
      <input
        id="autoApprove"
        name="autoApprove"
        type="checkbox"
        defaultChecked={checked}
        disabled={isPending}
        onChange={() => formRef.current?.requestSubmit()}
        className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </form>
  );
}
