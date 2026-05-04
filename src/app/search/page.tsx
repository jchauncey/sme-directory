import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import { listGroupsForUser } from "@/lib/profile";
import { searchContent, type SearchHit } from "@/lib/search";
import { searchQuerySchema } from "@/lib/validation/search";

import { applyGroupSlugDefault } from "./normalize";
import { SearchControls, type MyGroup } from "./search-controls";

type Props = {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    groupIds?: string;
    groupSlug?: string;
    page?: string;
    per?: string;
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

function HitCard({ hit }: { hit: SearchHit }) {
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
        <span>{authorLabel(hit.author)}</span>
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

function PageLink({
  to,
  q,
  scope,
  groupIds,
  groupSlug,
  per,
  children,
  disabled,
}: {
  to: number;
  q: string;
  scope: string;
  groupIds: string | undefined;
  groupSlug: string | undefined;
  per: number;
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
  const params = new URLSearchParams({ q, scope, page: String(to), per: String(per) });
  if (groupIds) params.set("groupIds", groupIds);
  if (groupSlug) params.set("groupSlug", groupSlug);
  return (
    <Button variant="outline" size="sm" render={<Link href={`/search?${params.toString()}`} />}>
      {children}
    </Button>
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

  if (rawQ.length > 0) {
    const parsed = searchQuerySchema.safeParse({
      q: rawQ,
      scope: normalized.scope,
      groupIds: groupIdsCsv,
      page: String(requestedPage),
      per: String(per),
    });
    if (parsed.success) {
      results = await searchContent(parsed.data);
    } else {
      validationMessage = parsed.error.issues[0]?.message ?? "Invalid query.";
    }
  }

  const totalPages = results ? Math.max(Math.ceil(results.total / per), 1) : 1;
  const currentPage = results?.page ?? requestedPage;

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
      />

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
                <HitCard key={`${hit.type}-${hit.answerId ?? hit.questionId}`} hit={hit} />
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <PageLink
                to={currentPage - 1}
                q={rawQ}
                scope={normalized.scope}
                groupIds={groupIdsCsv}
                groupSlug={normalized.groupSlugForUrl ?? undefined}
                per={per}
                disabled={currentPage <= 1}
              >
                Previous
              </PageLink>
              <PageLink
                to={currentPage + 1}
                q={rawQ}
                scope={normalized.scope}
                groupIds={groupIdsCsv}
                groupSlug={normalized.groupSlugForUrl ?? undefined}
                per={per}
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
