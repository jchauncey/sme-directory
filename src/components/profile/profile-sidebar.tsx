"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type LeafItem = { href: string; label: string; exact?: boolean };
type ParentItem = {
  label: string;
  matchPrefix: string;
  children: LeafItem[];
};
type Item = LeafItem | ParentItem;

const items: Item[] = [
  { href: "/me", label: "Overview", exact: true },
  { href: "/me/questions", label: "Questions" },
  { href: "/me/answers", label: "Answers" },
  {
    label: "Favorites",
    matchPrefix: "/me/favorites",
    children: [
      { href: "/me/favorites/questions", label: "Questions" },
      { href: "/me/favorites/answers", label: "Answers" },
      { href: "/me/favorites/groups", label: "Groups" },
    ],
  },
  { href: "/me/groups", label: "Groups" },
  { href: "/me/settings", label: "Settings" },
  { href: "/me/notification-settings", label: "Notification settings" },
];

function isLeafActive(pathname: string, item: LeafItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ProfileSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Profile sections" className="text-sm">
      <ul className="space-y-1">
        {items.map((item) => {
          if ("children" in item) {
            const parentActive = pathname.startsWith(item.matchPrefix);
            return (
              <li key={item.label}>
                <div
                  className={cn(
                    "px-2 py-1.5 rounded-md text-muted-foreground",
                    parentActive && "text-foreground font-medium",
                  )}
                >
                  {item.label}
                </div>
                <ul className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                  {item.children.map((child) => {
                    const active = isLeafActive(pathname, child);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "block rounded-md px-2 py-1.5 transition-colors",
                            active
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          }
          const active = isLeafActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2 py-1.5 transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
