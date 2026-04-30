import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          SME Directory
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/groups" className="hover:text-zinc-950 dark:hover:text-zinc-50">
            Groups
          </Link>
          <Link href="/search" className="hover:text-zinc-950 dark:hover:text-zinc-50">
            Search
          </Link>
          <span className="text-zinc-400 dark:text-zinc-600">Sign in</span>
        </nav>
      </div>
    </header>
  );
}
