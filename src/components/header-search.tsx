"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GROUP_PATH = /^\/groups\/([^/]+)/;

function currentGroupSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(GROUP_PATH);
  if (!match) return null;
  const slug = match[1];
  if (slug === "new") return null;
  return slug;
}

export function HeaderSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const slug = currentGroupSlug(pathname);
    if (slug) params.set("groupSlug", slug);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="hidden w-full max-w-xs items-center gap-1 md:flex"
      role="search"
    >
      <div className="relative flex-1">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search…"
          aria-label="Search"
          className="pl-7"
        />
      </div>
      <Button variant="ghost" size="icon-sm" type="submit" aria-label="Submit search">
        <SearchIcon className="size-3.5" />
      </Button>
    </form>
  );
}
