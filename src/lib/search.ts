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

export type SearchOptions = {
  q: string;
  scope: "current" | "selected" | "all";
  groupIds: string[];
  page: number;
  per: number;
};

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

export async function searchContent(opts: SearchOptions): Promise<SearchResultsPage> {
  const { q, scope, groupIds, page, per } = opts;
  const expr = toFtsMatchExpr(q);

  if (expr === null) {
    return { items: [], total: 0, page, per };
  }

  const useGroupFilter =
    (scope === "current" || scope === "selected") && groupIds.length > 0;

  const groupFilterQuestion = useGroupFilter
    ? Prisma.sql`AND q."groupId" IN (${Prisma.join(groupIds)})`
    : Prisma.empty;

  // Fetch enough rows from each side to cover the requested page after merge.
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
        ${groupFilterQuestion}
        ORDER BY score ASC, created_at DESC
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
        ${groupFilterQuestion}
        ORDER BY score ASC, created_at DESC
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
        ${groupFilterQuestion}
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
        ${groupFilterQuestion}
      `),
    ]);

  const total =
    Number(questionTotalRows[0]?.n ?? 0) + Number(answerTotalRows[0]?.n ?? 0);

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

  // Convert FTS5 BM25 (lower = better, often negative) to a positive
  // "higher is better" score by negating. Callers can compare scores within a
  // single response, but the absolute magnitude is opaque.
  const toPublicScore = (bm25: number) => -bm25;

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
    if (b.score !== a.score) return b.score - a.score;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const start = (page - 1) * per;
  const items = merged.slice(start, start + per);

  return { items, total, page, per };
}
