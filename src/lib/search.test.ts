/**
 * Search service tests — exercises FTS5 triggers, tokenizer, and scope filter.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-search-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup } = await import("./groups");
const { createQuestion } = await import("./questions");
const { searchContent, toFtsMatchExpr } = await import("./search");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  execSync("node_modules/.bin/prisma migrate deploy", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "pipe",
  });
  await db.$connect();
});

afterAll(async () => {
  await db.$disconnect();
  for (const ext of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${testDbPath}${ext}`);
    } catch {
      // ignore
    }
  }
});

let counter = 0;
function uniq(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}`;
}

async function makeUser(label: string) {
  return db.user.create({ data: { email: `${uniq(label)}@example.com`, name: label } });
}

describe("toFtsMatchExpr", () => {
  it("returns null when the query reduces to nothing", () => {
    expect(toFtsMatchExpr("")).toBeNull();
    expect(toFtsMatchExpr("   ")).toBeNull();
    expect(toFtsMatchExpr("***")).toBeNull();
    expect(toFtsMatchExpr('"!@#$"')).toBeNull();
  });

  it("strips FTS syntax characters and prefix-matches the trailing token", () => {
    expect(toFtsMatchExpr("rust")).toBe('"rust"*');
    expect(toFtsMatchExpr("how to rust")).toBe('"how" AND "to" AND "rust"*');
    // Special chars are stripped per token.
    expect(toFtsMatchExpr('rust*())"')).toBe('"rust"*');
    expect(toFtsMatchExpr("foo:bar baz-qux")).toBe('"foobar" AND "bazqux"*');
  });
});

describe("searchContent", () => {
  it("returns empty results when the query has no usable tokens", async () => {
    const page = await searchContent({
      q: "***",
      scope: "all",
      groupIds: [],
      page: 1,
      per: 10,
    });
    expect(page).toEqual({ items: [], total: 0, page: 1, per: 10 });
  });

  it("finds a question by title and includes group + author + snippet", async () => {
    const author = await makeUser("titleAuthor");
    const group = await createGroup(
      { name: "T", slug: uniq("t"), autoApprove: true },
      author.id,
    );
    await createQuestion(
      { title: "How to integrate Stripe webhooks safely", body: "Asking about idempotency." },
      group.id,
      author.id,
    );

    const page = await searchContent({
      q: "stripe",
      scope: "all",
      groupIds: [],
      page: 1,
      per: 10,
    });

    expect(page.total).toBeGreaterThanOrEqual(1);
    const hit = page.items.find((i) => i.title.includes("Stripe"));
    expect(hit).toBeDefined();
    expect(hit?.type).toBe("question");
    expect(hit?.group.id).toBe(group.id);
    expect(hit?.author.id).toBe(author.id);
    expect(hit?.titleSnippet).toMatch(/<mark>Stripe<\/mark>/i);
    expect(hit?.bodyExcerpt).toBeTypeOf("string");
  });

  it("finds a question by body when the title doesn't match", async () => {
    const author = await makeUser("bodyAuthor");
    const group = await createGroup(
      { name: "B", slug: uniq("b"), autoApprove: true },
      author.id,
    );
    await createQuestion(
      { title: "An ordinary question", body: "Has anyone used pgvector with Prisma?" },
      group.id,
      author.id,
    );

    const page = await searchContent({
      q: "pgvector",
      scope: "all",
      groupIds: [],
      page: 1,
      per: 10,
    });

    const hit = page.items.find((i) => i.questionId);
    expect(hit?.type).toBe("question");
    expect(hit?.bodyExcerpt).toMatch(/<mark>pgvector<\/mark>/i);
  });

  it("finds an answer by body and surfaces the parent question's title + group", async () => {
    const author = await makeUser("ansAuthor");
    const group = await createGroup(
      { name: "A", slug: uniq("a"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "Parent question title here", body: "context body" },
      group.id,
      author.id,
    );
    const answer = await db.answer.create({
      data: { questionId: q.id, authorId: author.id, body: "Try the kestrel toolkit." },
    });

    const page = await searchContent({
      q: "kestrel",
      scope: "all",
      groupIds: [],
      page: 1,
      per: 10,
    });

    const hit = page.items.find((i) => i.answerId === answer.id);
    expect(hit).toBeDefined();
    expect(hit?.type).toBe("answer");
    expect(hit?.title).toBe("Parent question title here");
    expect(hit?.group.id).toBe(group.id);
    expect(hit?.titleSnippet).toBeNull();
    expect(hit?.bodyExcerpt).toMatch(/<mark>kestrel<\/mark>/i);
  });

  it("filters by groupIds when scope=selected", async () => {
    const author = await makeUser("scopeA");
    const groupA = await createGroup(
      { name: "GA", slug: uniq("ga"), autoApprove: true },
      author.id,
    );
    const groupB = await createGroup(
      { name: "GB", slug: uniq("gb"), autoApprove: true },
      author.id,
    );
    await createQuestion(
      { title: "Quokka husbandry tips group A", body: "anything" },
      groupA.id,
      author.id,
    );
    await createQuestion(
      { title: "Quokka husbandry tips group B", body: "anything" },
      groupB.id,
      author.id,
    );

    const all = await searchContent({
      q: "quokka",
      scope: "all",
      groupIds: [],
      page: 1,
      per: 10,
    });
    expect(all.items.filter((i) => i.title.includes("Quokka")).length).toBeGreaterThanOrEqual(2);

    const onlyA = await searchContent({
      q: "quokka",
      scope: "selected",
      groupIds: [groupA.id],
      page: 1,
      per: 10,
    });
    const aHits = onlyA.items.filter((i) => i.title.includes("Quokka"));
    expect(aHits.every((h) => h.group.id === groupA.id)).toBe(true);
    expect(aHits.length).toBeGreaterThanOrEqual(1);
  });

  it("paginates with page + per", async () => {
    const author = await makeUser("pager");
    const group = await createGroup(
      { name: "P", slug: uniq("p"), autoApprove: true },
      author.id,
    );
    await createQuestion(
      { title: "Macropod fact one", body: "facts about macropod" },
      group.id,
      author.id,
    );
    await new Promise((r) => setTimeout(r, 5));
    await createQuestion(
      { title: "Macropod fact two", body: "more macropod" },
      group.id,
      author.id,
    );

    const p1 = await searchContent({
      q: "macropod",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 1,
    });
    expect(p1.total).toBeGreaterThanOrEqual(2);
    expect(p1.items).toHaveLength(1);

    const p2 = await searchContent({
      q: "macropod",
      scope: "selected",
      groupIds: [group.id],
      page: 2,
      per: 1,
    });
    expect(p2.items).toHaveLength(1);
    expect(p2.items[0]!.questionId).not.toBe(p1.items[0]!.questionId);
  });

  it("reflects question updates via the FTS update trigger", async () => {
    const author = await makeUser("upd");
    const group = await createGroup(
      { name: "U", slug: uniq("u"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "Initially about bandicoots", body: "marsupial body" },
      group.id,
      author.id,
    );

    const before = await searchContent({
      q: "bandicoots",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(before.items.some((i) => i.questionId === q.id)).toBe(true);

    await db.question.update({
      where: { id: q.id },
      data: { title: "Renamed to wombats now" },
    });

    const afterRename = await searchContent({
      q: "bandicoots",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(afterRename.items.some((i) => i.questionId === q.id)).toBe(false);

    const wombats = await searchContent({
      q: "wombats",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(wombats.items.some((i) => i.questionId === q.id)).toBe(true);
  });

  it("removes a question from results after deletion via the FTS delete trigger", async () => {
    const author = await makeUser("del");
    const group = await createGroup(
      { name: "D", slug: uniq("d"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "Numbat sighting today", body: "extra body" },
      group.id,
      author.id,
    );

    const before = await searchContent({
      q: "numbat",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(before.items.some((i) => i.questionId === q.id)).toBe(true);

    await db.question.delete({ where: { id: q.id } });

    const after = await searchContent({
      q: "numbat",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(after.items.some((i) => i.questionId === q.id)).toBe(false);
  });
});
