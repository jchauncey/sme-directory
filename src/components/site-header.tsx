import Link from "next/link";

import { UserMenu } from "@/components/auth/user-menu";
import { HeaderSearch } from "@/components/header-search";
import { ModeToggle } from "@/components/mode-toggle";
import { NotificationBell } from "@/components/notification-bell";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          SME Directory
        </Link>
        <div className="flex flex-1 items-center justify-end gap-3">
          <HeaderSearch />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/groups" className="text-muted-foreground hover:text-foreground">
              Groups
            </Link>
            <ModeToggle />
            <NotificationBell />
            <UserMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
