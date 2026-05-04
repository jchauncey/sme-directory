import { requireAuth } from "@/lib/auth";

export default async function AccountPage() {
  const session = await requireAuth();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You&rsquo;re signed in. The data below comes from your session token.
        </p>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">User ID</dt>
        <dd className="font-mono">{session.user.id}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
        <dd>{session.user.email}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
        <dd>{session.user.name ?? "—"}</dd>
      </dl>
    </div>
  );
}
