"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePersistedCollapse } from "./use-persisted-collapse";

type Props = {
  id: string;
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
};

export function DashboardBlock({ id, title, link, children }: Props) {
  const { collapsed, toggle } = usePersistedCollapse(id);
  const bodyId = `dashboard-block-body-${id}`;
  const toggleLabel = collapsed ? `Show ${title}` : `Hide ${title}`;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-3">
            {link ? (
              <Link
                href={link.href}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-controls={bodyId}
              aria-label={toggleLabel}
              title={toggleLabel}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {collapsed ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronUpIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent id={bodyId} hidden={collapsed} className="pt-4">
        {children}
      </CardContent>
    </Card>
  );
}
