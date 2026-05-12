"use client";

import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { CsrfField } from "@/components/csrf-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "unauthenticated") {
    return (
      <Button variant="ghost" size="sm" render={<Link href="/login" />}>
        Sign in
      </Button>
    );
  }

  const user = session?.user;
  const display = user?.name?.trim() || user?.email || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Open account menu"
          />
        }
      >
        <UserAvatar
          user={{
            name: user?.name ?? null,
            email: user?.email ?? null,
            image: user?.image ?? null,
          }}
          size="sm"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {/* Base UI requires GroupLabel to live inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{display}</span>
              {user?.email ? (
                <span className="text-xs text-muted-foreground">{user.email}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/me" />}>Your profile</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <CsrfField />
          <DropdownMenuItem render={<button type="submit" className="w-full" />}>
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
