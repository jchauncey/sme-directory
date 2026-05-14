import Link from "next/link";
import type { ReactNode } from "react";

import { requireSuperAdmin } from "@/lib/auth";

export const metadata = {
  title: "Admin",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-baseline justify-between border-b border-border pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Portal Admin</h1>
        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Super admin
        </span>
      </header>
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link className="hover:underline" href="/admin">
          Dashboard
        </Link>
        <Link className="hover:underline" href="/admin/groups">
          Groups
        </Link>
        <Link className="hover:underline" href="/admin/users">
          Users
        </Link>
        <Link className="hover:underline" href="/admin/content/questions">
          Questions
        </Link>
        <Link className="hover:underline" href="/admin/content/answers">
          Answers
        </Link>
        <Link className="hover:underline" href="/admin/audit">
          Audit log
        </Link>
      </nav>
      {children}
    </div>
  );
}
