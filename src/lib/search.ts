import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SearchMatchType = "question" | "answer";

export type SearchHitAuthor = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
};

export type SearchHitGroup = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
};

export type SearchHit = {
  type: SearchMatchType;
  questionId: string;
  answerId: string | null;
  title: string;
  titleSnippet: string | null;
  bodyExcerpt: string;
  group: SearchHitGroup;
  author: SearchHitAuthor;
  score: number;
  createdAt: Date;
};

export type SearchResultsPage = {
  items: SearchHit[];
  total: number;
  page: number;
  per: number;
};

export type SearchStatus = "all" | "answered" | "unanswered";
export type SearchRange = "all" | "week" | "month" | "year";
export type SearchSort = "relevance" | "newest";

export type SearchOptions = {
  q: string;
  scope: "current" | "selected" | "all";
  groupIds: string[];
  page: number;
  per: number;
  status?: SearchStatus;
  range?: SearchRange;
  authorId?: string | undefined;
  sort?: SearchSort;
};

type ResolvedOptions = Required<Omit<SearchOptions, "authorId">> & {
  authorId: string | undefined;
};

function resolveOptions(opts: SearchOptions): ResolvedOptions {
  return {
    q: opts.q,
    scope: opts.scope,
    groupIds: opts.groupIds,
    page: opts.page,
    per: opts.per,
    status: opts.status ?? "all",
    range: opts.range ?? "all",
    sort: opts.sort ?? "relevance",
    authorId: opts.authorId,
  };
}

/**
 * Convert a free-form user query into a safe FTS5 MATCH expression.
 * - Lowercases, splits on whitespace.
 * - Strips characters FTS5 treats as syntax (`"`, `*`, `:`, parens, `-`, etc.).
 * - Wraps each remaining token in double quotes and ANDs them together.
 * - Appends `*` to the final token for prefix matching.
 *
 * Returns null if the query reduces to zero usable tokens, in which case the
 * caller should short-circuit to an empty result set rather than running FTS.
 */
export function toFtsMatchExpr(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  const quoted = tokens.map((t) => `"${t}"`);
  // Prefix-match the trailing token so partial typing returns hits.
  quoted[quoted.length - 1] = `${quoted[quoted.length - 1]}*`;
  return quoted.join(" AND ");
}

type RawQuestionHit = {
  question_id: string;
  title: string;
  title_snippet: string;
  body_excerpt: string;
  created_at: Date;
  group_id: string;
  author_id: string;
  score: number;
};

type RawAnswerHit = {
  answer_id: string;
  question_id: string;
  title: string;
  body_excerpt: string;
  created_at: Date;
  group_id: string;
  author_id: string;
  score: number;
};

type DriverResult = {
  questionRows: RawQuestionHit[];
  answerRows: RawAnswerHit[];
  questionTotal: number;
  answerTotal: number;
  toPublicScore: (raw: number) => number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeToSince(range: SearchRange): Date | null {
  switch (range) {
    case "week":
      return new Date(Date.now() - 7 * DAY_MS);
    case "month":
      return new Date(Date.now() - 30 * DAY_MS);
    case "year":
      return new Date(Date.now() - 365 * DAY_MS);
    case "all":
    default:
      return null;
  }
}

function questionStatusClause(status: SearchStatus): Prisma.Sql {
  if (status === "answered") return Prisma.sql`AND q.status = 'answered'`;
  if (status === "unanswered") return Prisma.sql`AND q.status = 'open'`;
  return Prisma.empty;
}

export async function searchContent(opts: SearchOptions): Promise<SearchResultsPage> {
  const resolved = resolveOptions(opts);
  const { q, page, per, sort } = resolved;
  const expr = toFtsMatchExpr(q);

  if (expr === null) {
    return { items: [], total: 0, page, per };
  }

  const provider = (process.env["DATABASE_PROVIDER"] ?? "sqlite").toLowerCase();
  const driver: DriverResult =
    provider === "postgres"
      ? await runTsvector(resolved, expr)
      : await runFts5(resolved, expr);

  const { questionRows, answerRows, questionTotal, answerTotal, toPublicScore } = driver;
  const total = questionTotal + answerTotal;

  if (questionRows.length === 0 && answerRows.length === 0) {
    return { items: [], total, page, per };
  }

  const allGroupIds = new Set<string>();
  const allAuthorIds = new Set<string>();
  for (const r of questionRows) {
    allGroupIds.add(r.group_id);
    allAuthorIds.add(r.author_id);
  }
  for (const r of answerRows) {
    allGroupIds.add(r.group_id);
    allAuthorIds.add(r.author_id);
  }

  const [groupRows, authorRows] = await Promise.all([
    db.group.findMany({
      where: { id: { in: [...allGroupIds] } },
      select: { id: true, slug: true, name: true, image: true },
    }),
    db.user.findMany({
      where: { id: { in: [...allAuthorIds] } },
      select: { id: true, email: true, name: true, image: true },
    }),
  ]);
  const groupsById = new Map(groupRows.map((g) => [g.id, g]));
  const authorsById = new Map(authorRows.map((u) => [u.id, u]));

  const questionHits: SearchHit[] = questionRows.flatMap((r) => {
    const group = groupsById.get(r.group_id);
    const author = authorsById.get(r.author_id);
    if (!group || !author) return [];
    return [
      {
        type: "question",
        questionId: r.question_id,
        answerId: null,
        title: r.title,
        titleSnippet: r.title_snippet,
        bodyExcerpt: r.body_excerpt,
        group,
        author,
        score: toPublicScore(r.score),
        createdAt: r.created_at,
      },
    ];
  });

  const answerHits: SearchHit[] = answerRows.flatMap((r) => {
    const group = groupsById.get(r.group_id);
    const author = authorsById.get(r.author_id);
    if (!group || !author) return [];
    return [
      {
        type: "answer",
        questionId: r.question_id,
        answerId: r.answer_id,
        title: r.title,
        titleSnippet: null,
        bodyExcerpt: r.body_excerpt,
        group,
        author,
        score: toPublicScore(r.score),
        createdAt: r.created_at,
      },
    ];
  });

  const merged = [...questionHits, ...answerHits].sort((a, b) => {
    if (sort === "newest") {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    if (b.score !== a.score) return b.score - a.score;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const start = (page - 1) * per;
  const items = merged.slice(start, start + per);

  return { items, total, page, per };
}

async function runFts5(opts: ResolvedOptions, expr: string): Promise<DriverResult> {
  const { scope, groupIds, page, per, status, range, authorId, sort } = opts;

  const useGroupFilter =
    (scope === "current" || scope === "selected") && groupIds.length > 0;
  const groupFilter = useGroupFilter
    ? Prisma.sql`AND q."groupId" IN (${Prisma.join(groupIds)})`
    : Prisma.empty;

  const since = rangeToSince(range);
  const statusFilter = questionStatusClause(status);

  const questionDateFilter = since
    ? Prisma.sql`AND q."createdAt" > ${since}`
    : Prisma.empty;
  const answerDateFilter = since
    ? Prisma.sql`AND a."createdAt" > ${since}`
    : Prisma.empty;

  const questionAuthorFilter = authorId
    ? Prisma.sql`AND q."authorId" = ${authorId}`
    : Prisma.empty;
  const answerAuthorFilter = authorId
    ? Prisma.sql`AND a."authorId" = ${authorId}`
    : Prisma.empty;

  const questionOrder =
    sort === "newest"
      ? Prisma.sql`ORDER BY created_at DESC`
      : Prisma.sql`ORDER BY score ASC, created_at DESC`;
  const answerOrder = questionOrder;

  const fetchLimit = page * per;

  const [questionRows, answerRows, questionTotalRows, answerTotalRows] =
    await Promise.all([
      db.$queryRaw<RawQuestionHit[]>(Prisma.sql`
        SELECT
          q.id AS question_id,
          q.title AS title,
          snippet(question_fts, 1, '<mark>', '</mark>', '…', 12) AS title_snippet,
          snippet(question_fts, 2, '<mark>', '</mark>', '…', 24) AS body_excerpt,
          q."createdAt" AS created_at,
          q."groupId" AS group_id,
          q."authorId" AS author_id,
          bm25(question_fts) AS score
        FROM question_fts
        JOIN "Question" q ON q.id = question_fts.id
        JOIN "Group" g ON g.id = q."groupId"
        WHERE question_fts MATCH ${expr}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${questionDateFilter}
        ${questionAuthorFilter}
        ${questionOrder}
        LIMIT ${fetchLimit}
      `),
      db.$queryRaw<RawAnswerHit[]>(Prisma.sql`
        SELECT
          a.id AS answer_id,
          a."questionId" AS question_id,
          q.title AS title,
          snippet(answer_fts, 1, '<mark>', '</mark>', '…', 24) AS body_excerpt,
          a."createdAt" AS created_at,
          q."groupId" AS group_id,
          a."authorId" AS author_id,
          bm25(answer_fts) AS score
        FROM answer_fts
        JOIN "Answer" a ON a.id = answer_fts.id
        JOIN "Question" q ON q.id = a."questionId"
        JOIN "Group" g ON g.id = q."groupId"
        WHERE answer_fts MATCH ${expr}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${answerDateFilter}
        ${answerAuthorFilter}
        ${answerOrder}
        LIMIT ${fetchLimit}
      `),
      db.$queryRaw<{ n: number | bigint }[]>(Prisma.sql`
        SELECT COUNT(*) AS n
        FROM question_fts
        JOIN "Question" q ON q.id = question_fts.id
        JOIN "Group" g ON g.id = q."groupId"
        WHERE question_fts MATCH ${expr}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${questionDateFilter}
        ${questionAuthorFilter}
      `),
      db.$queryRaw<{ n: number | bigint }[]>(Prisma.sql`
        SELECT COUNT(*) AS n
        FROM answer_fts
        JOIN "Answer" a ON a.id = answer_fts.id
        JOIN "Question" q ON q.id = a."questionId"
        JOIN "Group" g ON g.id = q."groupId"
        WHERE answer_fts MATCH ${expr}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${answerDateFilter}
        ${answerAuthorFilter}
      `),
    ]);

  return {
    questionRows,
    answerRows,
    questionTotal: Number(questionTotalRows[0]?.n ?? 0),
    answerTotal: Number(answerTotalRows[0]?.n ?? 0),
    // FTS5 BM25: lower = better, often negative. Negate so callers see
    // higher = better. Magnitude is opaque outside a single response.
    toPublicScore: (bm25) => -bm25,
  };
}

async function runTsvector(opts: ResolvedOptions, expr: string): Promise<DriverResult> {
  // Postgres branch — wired for the prod connector swap. SQLite tests don't
  // exercise this path; the structure mirrors runFts5 so filters stay aligned.
  void expr;
  const { q, scope, groupIds, page, per, status, range, authorId, sort } = opts;

  const useGroupFilter =
    (scope === "current" || scope === "selected") && groupIds.length > 0;
  const groupFilter = useGroupFilter
    ? Prisma.sql`AND q."groupId" IN (${Prisma.join(groupIds)})`
    : Prisma.empty;

  const since = rangeToSince(range);
  const statusFilter = questionStatusClause(status);
  const questionDateFilter = since
    ? Prisma.sql`AND q."createdAt" > ${since}`
    : Prisma.empty;
  const answerDateFilter = since
    ? Prisma.sql`AND a."createdAt" > ${since}`
    : Prisma.empty;
  const questionAuthorFilter = authorId
    ? Prisma.sql`AND q."authorId" = ${authorId}`
    : Prisma.empty;
  const answerAuthorFilter = authorId
    ? Prisma.sql`AND a."authorId" = ${authorId}`
    : Prisma.empty;

  const questionOrder =
    sort === "newest"
      ? Prisma.sql`ORDER BY created_at DESC`
      : Prisma.sql`ORDER BY score DESC, created_at DESC`;
  const answerOrder = questionOrder;

  const fetchLimit = page * per;

  const tsq = Prisma.sql`plainto_tsquery('english', ${q})`;
  const headlineOpts = "StartSel=<mark>, StopSel=</mark>, MaxWords=24, MinWords=12";

  const [questionRows, answerRows, questionTotalRows, answerTotalRows] =
    await Promise.all([
      db.$queryRaw<RawQuestionHit[]>(Prisma.sql`
        SELECT
          q.id AS question_id,
          q.title AS title,
          ts_headline('english', q.title, ${tsq}, ${headlineOpts}) AS title_snippet,
          ts_headline('english', q.body, ${tsq}, ${headlineOpts}) AS body_excerpt,
          q."createdAt" AS created_at,
          q."groupId" AS group_id,
          q."authorId" AS author_id,
          ts_rank_cd(
            to_tsvector('english', q.title || ' ' || q.body),
            ${tsq}
          ) AS score
        FROM "Question" q
        JOIN "Group" g ON g.id = q."groupId"
        WHERE to_tsvector('english', q.title || ' ' || q.body) @@ ${tsq}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${questionDateFilter}
        ${questionAuthorFilter}
        ${questionOrder}
        LIMIT ${fetchLimit}
      `),
      db.$queryRaw<RawAnswerHit[]>(Prisma.sql`
        SELECT
          a.id AS answer_id,
          a."questionId" AS question_id,
          q.title AS title,
          ts_headline('english', a.body, ${tsq}, ${headlineOpts}) AS body_excerpt,
          a."createdAt" AS created_at,
          q."groupId" AS group_id,
          a."authorId" AS author_id,
          ts_rank_cd(to_tsvector('english', a.body), ${tsq}) AS score
        FROM "Answer" a
        JOIN "Question" q ON q.id = a."questionId"
        JOIN "Group" g ON g.id = q."groupId"
        WHERE to_tsvector('english', a.body) @@ ${tsq}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${answerDateFilter}
        ${answerAuthorFilter}
        ${answerOrder}
        LIMIT ${fetchLimit}
      `),
      db.$queryRaw<{ n: number | bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS n
        FROM "Question" q
        JOIN "Group" g ON g.id = q."groupId"
        WHERE to_tsvector('english', q.title || ' ' || q.body) @@ ${tsq}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${questionDateFilter}
        ${questionAuthorFilter}
      `),
      db.$queryRaw<{ n: number | bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS n
        FROM "Answer" a
        JOIN "Question" q ON q.id = a."questionId"
        JOIN "Group" g ON g.id = q."groupId"
        WHERE to_tsvector('english', a.body) @@ ${tsq}
          AND q."deletedAt" IS NULL
          AND g."archivedAt" IS NULL
        ${groupFilter}
        ${statusFilter}
        ${answerDateFilter}
        ${answerAuthorFilter}
      `),
    ]);

  return {
    questionRows,
    answerRows,
    questionTotal: Number(questionTotalRows[0]?.n ?? 0),
    answerTotal: Number(answerTotalRows[0]?.n ?? 0),
    // ts_rank_cd: higher = better. Pass through unchanged.
    toPublicScore: (rank) => rank,
  };
}
