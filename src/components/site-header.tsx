import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { UserMenu } from "@/components/auth/user-menu";
import { ModeToggle } from "@/components/mode-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          SME Directory
        </Link>
        <div className="flex flex-1 items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            className="hidden w-full max-w-xs justify-start gap-2 text-muted-foreground md:flex"
            render={<Link href="/search" />}
          >
            <SearchIcon className="size-3.5" />
            <span>Search…</span>
          </Button>
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
