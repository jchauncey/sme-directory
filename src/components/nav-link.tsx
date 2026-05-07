"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  exact?: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  children: React.ReactNode;
};

export function NavLink({
  href,
  exact = false,
  className,
  activeClassName = "text-foreground font-medium",
  inactiveClassName = "text-muted-foreground hover:text-foreground",
  children,
}: Props) {
  const pathname = usePathname();
  // The root path "/" matches every pathname's startsWith check, so always treat it as exact.
  const exactMatch = exact || href === "/";
  const isActive = exactMatch
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(className, isActive ? activeClassName : inactiveClassName)}
    >
      {children}
    </Link>
  );
}
