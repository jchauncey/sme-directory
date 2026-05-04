"use client";

import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";

function initialsFor(value: string | null | undefined): string {
  if (!value) return "?";
  const trimmed = value.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

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
  const initials = initialsFor(user?.name || user?.email);

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
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{display}</span>
            {user?.email ? (
              <span className="text-xs text-muted-foreground">{user.email}</span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/me" />}>Your profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account" />}>Account</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem render={<button type="submit" className="w-full" />}>
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
