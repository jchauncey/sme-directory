import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import { listGroupsForUser } from "@/lib/profile";
import {
  searchContent,
  type SearchHit,
  type SearchRange,
  type SearchSort,
  type SearchStatus,
} from "@/lib/search";
import { getUserSummaryById } from "@/lib/users";
import { searchQuerySchema } from "@/lib/validation/search";

import { applyGroupSlugDefault } from "./normalize";
import { SearchControls, type AuthorOption, type MyGroup } from "./search-controls";

type Props = {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    groupIds?: string;
    groupSlug?: string;
    page?: string;
    per?: string;
    status?: string;
    range?: string;
    authorId?: string;
    sort?: string;
  }>;
};

const SNIPPET_MARK = /<mark>([\s\S]*?)<\/mark>/g;

/**
 * Render an FTS-emitted snippet ("…match <mark>foo</mark> here…") as React,
 * escaping everything outside <mark> tags and replacing <mark>...</mark> with
 * a styled span. We do this manually rather than dangerouslySetInnerHTML so
 * arbitrary user content can't inject markup.
 */
function renderSnippet(snippet: string): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of snippet.matchAll(SNIPPET_MARK)) {
    const idx = m.index ?? 0;
    if (idx > cursor) out.push(snippet.slice(cursor, idx));
    out.push(
      <mark
        key={key++}
        className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/30"
      >
        {m[1]}
      </mark>,
    );
    cursor = idx + m[0].length;
  }
  if (cursor < snippet.length) out.push(snippet.slice(cursor));
  return out;
}

function authorLabel(a: { name: string | null; email: string | null }): string {
  return a.name ?? a.email ?? "unknown";
}

type CommonUrlState = {
  q: string;
  scope: string;
  groupIds: string | undefined;
  groupSlug: string | undefined;
  status: SearchStatus;
  range: SearchRange;
  authorId: string | undefined;
  sort: SearchSort;
  per: number;
};

function buildSearchUrl(state: CommonUrlState, overrides: Partial<CommonUrlState & { page: number }>): string {
  const merged: CommonUrlState & { page?: number } = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  params.set("scope", merged.scope);
  if (merged.groupIds) params.set("groupIds", merged.groupIds);
  if (merged.groupSlug) params.set("groupSlug", merged.groupSlug);
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.range !== "all") params.set("range", merged.range);
  if (merged.sort !== "relevance") params.set("sort", merged.sort);
  if (merged.authorId) params.set("authorId", merged.authorId);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  if (merged.per !== 20) params.set("per", String(merged.per));
  return `/search?${params.toString()}`;
}

function HitCard({
  hit,
  authorFilterUrl,
}: {
  hit: SearchHit;
  authorFilterUrl: string;
}) {
  const titleNode = hit.titleSnippet ? renderSnippet(hit.titleSnippet) : hit.title;
  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-sm border border-border px-1.5 py-0.5 font-medium uppercase tracking-wide">
          {hit.type === "question" ? "Question" : "Answer"}
        </span>
        <Link href={`/groups/${hit.group.slug}`} className="hover:underline">
          {hit.group.name}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href={authorFilterUrl}
          className="hover:underline"
          title="Filter by this author"
        >
          {authorLabel(hit.author)}
        </Link>
      </div>
      <h2 className="mt-1 text-lg font-semibold leading-snug">
        <Link
          href={hit.answerId ? `/q/${hit.questionId}#a-${hit.answerId}` : `/q/${hit.questionId}`}
          className="hover:underline"
        >
          {titleNode}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{renderSnippet(hit.bodyExcerpt)}</p>
    </li>
  );
}

const STATUS_LABEL: Record<SearchStatus, string> = {
  all: "All",
  answered: "Answered",
  unanswered: "Unanswered",
};

const RANGE_LABEL: Record<SearchRange, string> = {
  all: "Any time",
  week: "Past week",
  month: "Past month",
  year: "Past year",
};

const SORT_LABEL: Record<SearchSort, string> = {
  relevance: "Relevance",
  newest: "Newest",
};

function ActiveFilters({
  state,
  authorLabelText,
}: {
  state: CommonUrlState;
  authorLabelText: string | null;
}) {
  const chips: { key: string; label: string; clearUrl: string }[] = [];
  if (state.status !== "all") {
    chips.push({
      key: "status",
      label: `Status: ${STATUS_LABEL[state.status]}`,
      clearUrl: buildSearchUrl(state, { status: "all", page: 1 }),
    });
  }
  if (state.range !== "all") {
    chips.push({
      key: "range",
      label: `Date: ${RANGE_LABEL[state.range]}`,
      clearUrl: buildSearchUrl(state, { range: "all", page: 1 }),
    });
  }
  if (state.authorId && authorLabelText) {
    chips.push({
      key: "author",
      label: `Author: ${authorLabelText}`,
      clearUrl: buildSearchUrl(state, { authorId: undefined, page: 1 }),
    });
  }
  if (state.sort !== "relevance") {
    chips.push({
      key: "sort",
      label: `Sort: ${SORT_LABEL[state.sort]}`,
      clearUrl: buildSearchUrl(state, { sort: "relevance", page: 1 }),
    });
  }

  if (chips.length === 0) return null;

  const clearAllUrl = buildSearchUrl(state, {
    status: "all",
    range: "all",
    authorId: undefined,
    sort: "relevance",
    page: 1,
  });

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2"
      role="region"
      aria-label="Active filters"
    >
      <span className="text-xs font-medium text-muted-foreground">Active:</span>
      {chips.map((c) => (
        <Link
          key={c.key}
          href={c.clearUrl}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted"
          aria-label={`Clear ${c.label}`}
        >
          <span>{c.label}</span>
          <span aria-hidden>×</span>
        </Link>
      ))}
      <Link
        href={clearAllUrl}
        className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawQ = sp.q?.trim() ?? "";
  const per = Math.min(Math.max(Number(sp.per) || 20, 1), 50);
  const requestedPage = Math.max(Number(sp.page) || 1, 1);

  const [session, contextGroup] = await Promise.all([
    getSession(),
    sp.groupSlug ? getGroupBySlug(sp.groupSlug) : Promise.resolve(null),
  ]);

  const myGroups: MyGroup[] = session
    ? (await listGroupsForUser(session.user.id, { includePending: false })).map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
      }))
    : [];

  const normalized = applyGroupSlugDefault(
    sp.scope,
    sp.groupIds,
    contextGroup?.id ?? null,
    sp.groupSlug,
  );

  const groupIdsCsv = normalized.groupIds.length > 0 ? normalized.groupIds.join(",") : undefined;

  let results: { items: SearchHit[]; total: number; page: number; per: number } | null = null;
  let validationMessage: string | null = null;

  // Default the parsed filters so the page always has well-typed state, even
  // before the user has typed a query.
  let parsedStatus: SearchStatus = "all";
  let parsedRange: SearchRange = "all";
  let parsedSort: SearchSort = "relevance";
  let parsedAuthorId: string | undefined = sp.authorId?.trim() || undefined;

  if (rawQ.length > 0) {
    const parsed = searchQuerySchema.safeParse({
      q: rawQ,
      scope: normalized.scope,
      groupIds: groupIdsCsv,
      page: String(requestedPage),
      per: String(per),
      status: sp.status,
      range: sp.range,
      authorId: parsedAuthorId,
      sort: sp.sort,
    });
    if (parsed.success) {
      parsedStatus = parsed.data.status;
      parsedRange = parsed.data.range;
      parsedSort = parsed.data.sort;
      parsedAuthorId = parsed.data.authorId;
      results = await searchContent(parsed.data);
    } else {
      validationMessage = parsed.error.issues[0]?.message ?? "Invalid query.";
    }
  } else {
    // Validate filter shape even with no query so the controls stay in sync.
    const parsed = searchQuerySchema.safeParse({
      q: "x",
      scope: normalized.scope,
      groupIds: groupIdsCsv,
      page: String(requestedPage),
      per: String(per),
      status: sp.status,
      range: sp.range,
      authorId: parsedAuthorId,
      sort: sp.sort,
    });
    if (parsed.success) {
      parsedStatus = parsed.data.status;
      parsedRange = parsed.data.range;
      parsedSort = parsed.data.sort;
      parsedAuthorId = parsed.data.authorId;
    }
  }

  const selectedAuthor = parsedAuthorId ? await getUserSummaryById(parsedAuthorId) : null;
  const initialAuthor: AuthorOption | null = selectedAuthor
    ? { id: selectedAuthor.id, name: selectedAuthor.name, email: selectedAuthor.email }
    : null;
  const authorLabelText = selectedAuthor
    ? (selectedAuthor.name ?? selectedAuthor.email)
    : null;

  const totalPages = results ? Math.max(Math.ceil(results.total / per), 1) : 1;
  const currentPage = results?.page ?? requestedPage;

  const urlState: CommonUrlState = {
    q: rawQ,
    scope: normalized.scope,
    groupIds: groupIdsCsv,
    groupSlug: normalized.groupSlugForUrl ?? undefined,
    status: parsedStatus,
    range: parsedRange,
    authorId: parsedAuthorId,
    sort: parsedSort,
    per,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search questions and answers across groups.
          {contextGroup ? (
            <>
              {" "}
              Defaulting to <span className="font-medium">{contextGroup.name}</span>.
            </>
          ) : null}
        </p>
      </div>

      <SearchControls
        initialQ={rawQ}
        initialScope={normalized.scope}
        initialGroupIds={normalized.groupIds}
        myGroups={myGroups}
        initialStatus={parsedStatus}
        initialRange={parsedRange}
        initialSort={parsedSort}
        initialAuthor={initialAuthor}
      />

      <ActiveFilters state={urlState} authorLabelText={authorLabelText} />

      {validationMessage ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {validationMessage}
        </p>
      ) : null}

      {rawQ.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Type a query to search.
        </p>
      ) : results ? (
        results.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No matches for <span className="font-medium">“{rawQ}”</span>.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {results.total} match{results.total === 1 ? "" : "es"} · page {currentPage} of{" "}
              {totalPages}
            </p>
            <ul className="space-y-3">
              {results.items.map((hit) => (
                <HitCard
                  key={`${hit.type}-${hit.answerId ?? hit.questionId}`}
                  hit={hit}
                  authorFilterUrl={buildSearchUrl(urlState, {
                    authorId: hit.author.id,
                    page: 1,
                  })}
                />
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <PageLink
                to={currentPage - 1}
                state={urlState}
                disabled={currentPage <= 1}
              >
                Previous
              </PageLink>
              <PageLink
                to={currentPage + 1}
                state={urlState}
                disabled={currentPage >= totalPages}
              >
                Next
              </PageLink>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function PageLink({
  to,
  state,
  children,
  disabled,
}: {
  to: number;
  state: CommonUrlState;
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      render={<Link href={buildSearchUrl(state, { page: to })} />}
    >
      {children}
    </Button>
  );
}
