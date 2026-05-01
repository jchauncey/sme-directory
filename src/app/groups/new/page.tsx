import { requireAuth } from "@/lib/auth";
import { NewGroupForm } from "./new-group-form";

export default async function NewGroupPage() {
  await requireAuth();

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create a group</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;ll become the owner of this group and can edit its settings later.
        </p>
      </div>
      <NewGroupForm />
    </div>
  );
}
