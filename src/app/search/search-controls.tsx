"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchRange, SearchSort, SearchStatus } from "@/lib/search";

const DEBOUNCE_MS = 250;
const AUTHOR_DEBOUNCE_MS = 200;
const MAX_GROUP_IDS = 50;

export type ScopeOption = "all" | "my" | "pick";

export type MyGroup = { id: string; slug: string; name: string };

export type AuthorOption = {
  id: string;
  name: string | null;
  email: string | null;
};

type Props = {
  initialQ: string;
  initialScope: "all" | "selected" | "current";
  initialGroupIds: string[];
  myGroups: MyGroup[];
  initialStatus: SearchStatus;
  initialRange: SearchRange;
  initialSort: SearchSort;
  initialAuthor: AuthorOption | null;
};

function arraysEqualSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

function deriveSurfaceScope(
  apiScope: "all" | "selected" | "current",
  groupIds: string[],
  myGroupIds: string[],
): ScopeOption {
  if (apiScope === "all") return "all";
  if (apiScope === "selected" && myGroupIds.length > 0 && arraysEqualSet(groupIds, myGroupIds)) {
    return "my";
  }
  return "pick";
}

function authorLabel(a: AuthorOption): string {
  return a.name ?? a.email ?? "unknown";
}

export function SearchControls({
  initialQ,
  initialScope,
  initialGroupIds,
  myGroups,
  initialStatus,
  initialRange,
  initialSort,
  initialAuthor,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const myGroupIds = useMemo(() => myGroups.map((g) => g.id), [myGroups]);

  const [q, setQ] = useState(initialQ);
  const [surfaceScope, setSurfaceScope] = useState<ScopeOption>(() =>
    deriveSurfaceScope(initialScope, initialGroupIds, myGroupIds),
  );
  const [pickedGroupIds, setPickedGroupIds] = useState<string[]>(() => {
    if (initialScope === "selected" || initialScope === "current") return initialGroupIds;
    return [];
  });
  const [status, setStatus] = useState<SearchStatus>(initialStatus);
  const [range, setRange] = useState<SearchRange>(initialRange);
  const [sort, setSort] = useState<SearchSort>(initialSort);
  const [author, setAuthor] = useState<AuthorOption | null>(initialAuthor);

  // When the URL's q changes from outside (header submit, back button), reset
  // the local typing buffer. Uses React's "adjust state during render" pattern.
  const [prevInitialQ, setPrevInitialQ] = useState(initialQ);
  if (prevInitialQ !== initialQ) {
    setPrevInitialQ(initialQ);
    setQ(initialQ);
  }

  // Sync filter state when the URL changes from outside (e.g. clear-all link).
  const [prevAuthorId, setPrevAuthorId] = useState(initialAuthor?.id ?? null);
  if ((initialAuthor?.id ?? null) !== prevAuthorId) {
    setPrevAuthorId(initialAuthor?.id ?? null);
    setAuthor(initialAuthor);
  }
  const [prevStatus, setPrevStatus] = useState(initialStatus);
  if (initialStatus !== prevStatus) {
    setPrevStatus(initialStatus);
    setStatus(initialStatus);
  }
  const [prevRange, setPrevRange] = useState(initialRange);
  if (initialRange !== prevRange) {
    setPrevRange(initialRange);
    setRange(initialRange);
  }
  const [prevSort, setPrevSort] = useState(initialSort);
  if (initialSort !== prevSort) {
    setPrevSort(initialSort);
    setSort(initialSort);
  }

  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      const trimmed = q.trim();
      if (trimmed) params.set("q", trimmed);

      if (surfaceScope === "all") {
        params.set("scope", "all");
      } else if (surfaceScope === "my") {
        if (myGroupIds.length > 0) {
          params.set("scope", "selected");
          params.set("groupIds", myGroupIds.join(","));
        } else {
          params.set("scope", "all");
        }
      } else {
        params.set("scope", "selected");
        if (pickedGroupIds.length > 0) {
          params.set("groupIds", pickedGroupIds.join(","));
        }
      }

      if (status !== "all") params.set("status", status);
      if (range !== "all") params.set("range", range);
      if (sort !== "relevance") params.set("sort", sort);
      if (author?.id) params.set("authorId", author.id);

      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [q, surfaceScope, pickedGroupIds, myGroupIds, status, range, sort, author, router]);

  const myDisabled = myGroups.length === 0;
  const noPicked = surfaceScope === "pick" && pickedGroupIds.length === 0;

  function togglePicked(groupId: string) {
    setPickedGroupIds((prev) => {
      if (prev.includes(groupId)) return prev.filter((g) => g !== groupId);
      if (prev.length >= MAX_GROUP_IDS) return prev;
      return [...prev, groupId];
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search questions and answers…"
          aria-label="Search query"
          className="max-w-md flex-1"
          autoFocus
        />
        {isPending ? (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Searching…
          </span>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center gap-1"
        role="radiogroup"
        aria-label="Search scope"
      >
        <ToggleButton pressed={surfaceScope === "all"} onClick={() => setSurfaceScope("all")}>
          All groups
        </ToggleButton>
        <ToggleButton
          pressed={surfaceScope === "my"}
          onClick={() => setSurfaceScope("my")}
          disabled={myDisabled}
          title={myDisabled ? "Join a group to use this scope." : undefined}
        >
          My groups
        </ToggleButton>
        <ToggleButton pressed={surfaceScope === "pick"} onClick={() => setSurfaceScope("pick")}>
          Pick groups
        </ToggleButton>
      </div>

      {surfaceScope === "pick" ? (
        myGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            You aren&apos;t a member of any groups yet.
          </p>
        ) : (
          <fieldset className="space-y-1 rounded-lg border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Choose groups ({pickedGroupIds.length} selected)
            </legend>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {myGroups.slice(0, MAX_GROUP_IDS).map((g) => {
                const checked = pickedGroupIds.includes(g.id);
                return (
                  <li key={g.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePicked(g.id)}
                        className="size-4 rounded border-input"
                      />
                      <span className="truncate">{g.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {noPicked ? (
              <p className="px-1 pt-1 text-xs text-muted-foreground">
                Pick at least one group to see results.
              </p>
            ) : null}
          </fieldset>
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by question status">
          <ToggleButton pressed={status === "all"} onClick={() => setStatus("all")}>
            All
          </ToggleButton>
          <ToggleButton pressed={status === "answered"} onClick={() => setStatus("answered")}>
            Answered
          </ToggleButton>
          <ToggleButton pressed={status === "unanswered"} onClick={() => setStatus("unanswered")}>
            Unanswered
          </ToggleButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Date</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by date range">
          <ToggleButton pressed={range === "all"} onClick={() => setRange("all")}>
            Any time
          </ToggleButton>
          <ToggleButton pressed={range === "week"} onClick={() => setRange("week")}>
            Past week
          </ToggleButton>
          <ToggleButton pressed={range === "month"} onClick={() => setRange("month")}>
            Past month
          </ToggleButton>
          <ToggleButton pressed={range === "year"} onClick={() => setRange("year")}>
            Past year
          </ToggleButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Sort</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sort results">
          <ToggleButton pressed={sort === "relevance"} onClick={() => setSort("relevance")}>
            Relevance
          </ToggleButton>
          <ToggleButton pressed={sort === "newest"} onClick={() => setSort("newest")}>
            Newest
          </ToggleButton>
        </div>
      </div>

      <AuthorPicker
        author={author}
        onChange={setAuthor}
      />
    </div>
  );
}

function AuthorPicker({
  author,
  onChange,
}: {
  author: AuthorOption | null;
  onChange: (a: AuthorOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuthorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (author) return; // hide picker when one is selected
    const term = query.trim();
    if (!term) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(term)}&limit=8`,
          { credentials: "same-origin" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: AuthorOption[] };
        if (!cancelled) setResults(data.items ?? []);
      } catch {
        // swallow — typeahead is best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, AUTHOR_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, author]);

  if (author) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Author</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
          {authorLabel(author)}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setResults([]);
            }}
            aria-label={`Remove author filter ${authorLabel(author)}`}
            className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Author</span>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // delay so click on a result fires before close
            setTimeout(() => setOpen(false), 120);
          }}
          placeholder="Filter by author…"
          aria-label="Filter by author"
          aria-autocomplete="list"
          className="w-64"
        />
        {open && query.trim() ? (
          <ul
            role="listbox"
            className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
          >
            {loading ? (
              <li className="px-2 py-1 text-xs text-muted-foreground">Searching…</li>
            ) : results.length === 0 ? (
              <li className="px-2 py-1 text-xs text-muted-foreground">No matches.</li>
            ) : (
              results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(u);
                      setQuery("");
                      setResults([]);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start rounded-sm px-2 py-1 text-left hover:bg-muted"
                  >
                    <span>{u.name ?? u.email ?? "unknown"}</span>
                    {u.name && u.email ? (
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function ToggleButton({
  pressed,
  onClick,
  disabled,
  title,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "secondary" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
    >
      {children}
    </Button>
  );
}
