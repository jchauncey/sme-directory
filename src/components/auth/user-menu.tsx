"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { signOutAction } from "@/app/login/actions";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "unauthenticated") {
    return (
      <Link href="/login" className="hover:text-zinc-950 dark:hover:text-zinc-50">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/account"
        className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
      >
        {session?.user.email}
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
