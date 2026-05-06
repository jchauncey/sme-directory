import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  label?: string;
};

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  label = "Pagination",
}: Props) {
  if (totalPages <= 1) return null;

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-3 pt-2"
    >
      <PageButton href={buildHref(currentPage - 1)} disabled={prevDisabled}>
        Previous
      </PageButton>
      <span className="text-xs text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <PageButton href={buildHref(currentPage + 1)} disabled={nextDisabled}>
        Next
      </PageButton>
    </nav>
  );
}

function PageButton({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" render={<Link href={href} />}>
      {children}
    </Button>
  );
}
