"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;
const MAX_GROUP_IDS = 50;

export type ScopeOption = "all" | "my" | "pick";

export type MyGroup = { id: string; slug: string; name: string };

type Props = {
  initialQ: string;
  initialScope: "all" | "selected" | "current";
  initialGroupIds: string[];
  myGroups: MyGroup[];
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

export function SearchControls({ initialQ, initialScope, initialGroupIds, myGroups }: Props) {
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

  // When the URL's q changes from outside (header submit, back button), reset
  // the local typing buffer. Uses React's "adjust state during render" pattern.
  const [prevInitialQ, setPrevInitialQ] = useState(initialQ);
  if (prevInitialQ !== initialQ) {
    setPrevInitialQ(initialQ);
    setQ(initialQ);
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

      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [q, surfaceScope, pickedGroupIds, myGroupIds, router]);

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
        <ScopeButton pressed={surfaceScope === "all"} onClick={() => setSurfaceScope("all")}>
          All groups
        </ScopeButton>
        <ScopeButton
          pressed={surfaceScope === "my"}
          onClick={() => setSurfaceScope("my")}
          disabled={myDisabled}
          title={myDisabled ? "Join a group to use this scope." : undefined}
        >
          My groups
        </ScopeButton>
        <ScopeButton pressed={surfaceScope === "pick"} onClick={() => setSurfaceScope("pick")}>
          Pick groups
        </ScopeButton>
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
    </div>
  );
}

function ScopeButton({
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
