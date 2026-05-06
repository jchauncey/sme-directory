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

  it("excludes soft-deleted questions and their answers", async () => {
    const author = await makeUser("softdel");
    const group = await createGroup(
      { name: "SD", slug: uniq("sd"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "Quokka habitat survey", body: "hidden after delete" },
      group.id,
      author.id,
    );
    const answer = await db.answer.create({
      data: {
        questionId: q.id,
        authorId: author.id,
        body: "Quokka colonies are stable.",
      },
    });

    const before = await searchContent({
      q: "quokka",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(before.items.some((i) => i.questionId === q.id)).toBe(true);
    expect(
      before.items.some((i) => i.type === "answer" && i.answerId === answer.id),
    ).toBe(true);
    const beforeTotal = before.total;

    await db.question.update({
      where: { id: q.id },
      data: { deletedAt: new Date() },
    });

    const after = await searchContent({
      q: "quokka",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(after.items.some((i) => i.questionId === q.id)).toBe(false);
    expect(after.total).toBeLessThan(beforeTotal);
  });

  it("filters by question status (answered)", async () => {
    const author = await makeUser("statusAns");
    const group = await createGroup(
      { name: "SAns", slug: uniq("sans"), autoApprove: true },
      author.id,
    );
    const open = await createQuestion(
      { title: "Wallaby tracking open", body: "open question body" },
      group.id,
      author.id,
    );
    const answered = await createQuestion(
      { title: "Wallaby tracking answered", body: "answered question body" },
      group.id,
      author.id,
    );
    const ans = await db.answer.create({
      data: { questionId: answered.id, authorId: author.id, body: "Use radio collars wallaby." },
    });
    await db.question.update({
      where: { id: answered.id },
      data: { status: "answered", acceptedAnswerId: ans.id },
    });

    const onlyAnswered = await searchContent({
      q: "wallaby",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 10,
      status: "answered",
    });
    const ansIds = new Set(onlyAnswered.items.map((i) => i.questionId));
    expect(ansIds.has(answered.id)).toBe(true);
    expect(ansIds.has(open.id)).toBe(false);

    const onlyUnanswered = await searchContent({
      q: "wallaby",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 10,
      status: "unanswered",
    });
    const unIds = new Set(onlyUnanswered.items.map((i) => i.questionId));
    expect(unIds.has(open.id)).toBe(true);
    expect(unIds.has(answered.id)).toBe(false);
  });

  it("status filter applies to answer hits via parent question status", async () => {
    const author = await makeUser("statusAnsHits");
    const group = await createGroup(
      { name: "SAH", slug: uniq("sah"), autoApprove: true },
      author.id,
    );
    const open = await createQuestion(
      { title: "Tasmanian devil open Q", body: "topic body" },
      group.id,
      author.id,
    );
    const answered = await createQuestion(
      { title: "Tasmanian devil answered Q", body: "topic body" },
      group.id,
      author.id,
    );
    const ansOpen = await db.answer.create({
      data: { questionId: open.id, authorId: author.id, body: "tasdevil note open" },
    });
    const ansAnswered = await db.answer.create({
      data: { questionId: answered.id, authorId: author.id, body: "tasdevil note answered" },
    });
    await db.question.update({
      where: { id: answered.id },
      data: { status: "answered", acceptedAnswerId: ansAnswered.id },
    });

    const res = await searchContent({
      q: "tasdevil",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 10,
      status: "answered",
    });
    const answerHits = res.items.filter((i) => i.type === "answer");
    expect(answerHits.some((h) => h.answerId === ansAnswered.id)).toBe(true);
    expect(answerHits.some((h) => h.answerId === ansOpen.id)).toBe(false);
  });

  it("filters by date range using each hit's createdAt", async () => {
    const author = await makeUser("dateR");
    const group = await createGroup(
      { name: "DR", slug: uniq("dr"), autoApprove: true },
      author.id,
    );
    const now = Date.now();
    const ages = [
      { label: "1d", offset: 1 * 24 * 60 * 60 * 1000 },
      { label: "10d", offset: 10 * 24 * 60 * 60 * 1000 },
      { label: "100d", offset: 100 * 24 * 60 * 60 * 1000 },
      { label: "400d", offset: 400 * 24 * 60 * 60 * 1000 },
    ];
    const ids: Record<string, string> = {};
    for (const a of ages) {
      const q = await createQuestion(
        { title: `Bilby age ${a.label}`, body: "marsupial body" },
        group.id,
        author.id,
      );
      await db.question.update({
        where: { id: q.id },
        data: { createdAt: new Date(now - a.offset) },
      });
      ids[a.label] = q.id;
    }

    const week = await searchContent({
      q: "bilby",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 50,
      range: "week",
    });
    const weekIds = new Set(week.items.map((i) => i.questionId));
    expect(weekIds.has(ids["1d"]!)).toBe(true);
    expect(weekIds.has(ids["10d"]!)).toBe(false);

    const month = await searchContent({
      q: "bilby",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 50,
      range: "month",
    });
    const monthIds = new Set(month.items.map((i) => i.questionId));
    expect(monthIds.has(ids["1d"]!)).toBe(true);
    expect(monthIds.has(ids["10d"]!)).toBe(true);
    expect(monthIds.has(ids["100d"]!)).toBe(false);

    const year = await searchContent({
      q: "bilby",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 50,
      range: "year",
    });
    const yearIds = new Set(year.items.map((i) => i.questionId));
    expect(yearIds.has(ids["100d"]!)).toBe(true);
    expect(yearIds.has(ids["400d"]!)).toBe(false);

    const all = await searchContent({
      q: "bilby",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 50,
      range: "all",
    });
    const allIds = new Set(all.items.map((i) => i.questionId));
    for (const v of Object.values(ids)) expect(allIds.has(v)).toBe(true);
  });

  it("filters by authorId across questions and answers", async () => {
    const a1 = await makeUser("authA");
    const a2 = await makeUser("authB");
    const group = await createGroup(
      { name: "AU", slug: uniq("au"), autoApprove: true },
      a1.id,
    );
    // a2 needs membership to post — ensure via createGroup auto-add for a1.
    // For a2 to post answers, the schema doesn't require membership here.
    const qA = await createQuestion(
      { title: "Possum count A", body: "discuss possum" },
      group.id,
      a1.id,
    );
    const qB = await createQuestion(
      { title: "Possum count B", body: "discuss possum" },
      group.id,
      a1.id,
    );
    const ansA1 = await db.answer.create({
      data: { questionId: qA.id, authorId: a1.id, body: "possum sighting note A1" },
    });
    const ansB2 = await db.answer.create({
      data: { questionId: qB.id, authorId: a2.id, body: "possum sighting note B2" },
    });

    const onlyA1 = await searchContent({
      q: "possum",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 50,
      authorId: a1.id,
    });
    expect(onlyA1.items.some((i) => i.questionId === qA.id && i.type === "question")).toBe(true);
    expect(onlyA1.items.some((i) => i.answerId === ansA1.id)).toBe(true);
    expect(onlyA1.items.some((i) => i.answerId === ansB2.id)).toBe(false);
    for (const item of onlyA1.items) {
      expect(item.author.id).toBe(a1.id);
    }
  });

  it("sorts by newest when sort=newest", async () => {
    const author = await makeUser("sortN");
    const group = await createGroup(
      { name: "SN", slug: uniq("sn"), autoApprove: true },
      author.id,
    );
    const q1 = await createQuestion(
      { title: "Koala first", body: "koala" },
      group.id,
      author.id,
    );
    await new Promise((r) => setTimeout(r, 10));
    const q2 = await createQuestion(
      { title: "Koala second", body: "koala" },
      group.id,
      author.id,
    );
    await new Promise((r) => setTimeout(r, 10));
    const q3 = await createQuestion(
      { title: "Koala third", body: "koala" },
      group.id,
      author.id,
    );

    const res = await searchContent({
      q: "koala",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 50,
      sort: "newest",
    });
    const order = res.items
      .filter((i) => i.type === "question")
      .map((i) => i.questionId);
    const idx1 = order.indexOf(q1.id);
    const idx2 = order.indexOf(q2.id);
    const idx3 = order.indexOf(q3.id);
    expect(idx3).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx1);
  });

  it("supports combined filters: status + range + author + newest sort", async () => {
    const author = await makeUser("combo");
    const other = await makeUser("comboOther");
    const group = await createGroup(
      { name: "CO", slug: uniq("co"), autoApprove: true },
      author.id,
    );
    const recent = await createQuestion(
      { title: "Echidna sighting recent", body: "echidna match" },
      group.id,
      author.id,
    );
    const old = await createQuestion(
      { title: "Echidna sighting old", body: "echidna match" },
      group.id,
      author.id,
    );
    const otherQ = await createQuestion(
      { title: "Echidna sighting from other", body: "echidna match" },
      group.id,
      other.id,
    );
    // mark all answered
    for (const q of [recent, old, otherQ]) {
      const ans = await db.answer.create({
        data: { questionId: q.id, authorId: author.id, body: "answer" },
      });
      await db.question.update({
        where: { id: q.id },
        data: { status: "answered", acceptedAnswerId: ans.id },
      });
    }
    // backdate "old"
    await db.question.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    });

    const res = await searchContent({
      q: "echidna",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 50,
      status: "answered",
      range: "week",
      authorId: author.id,
      sort: "newest",
    });
    const ids = new Set(res.items.map((i) => i.questionId));
    expect(ids.has(recent.id)).toBe(true);
    expect(ids.has(old.id)).toBe(false);
    expect(ids.has(otherQ.id)).toBe(false);
  });

  it("excludes content from archived groups", async () => {
    const author = await makeUser("archSearch");
    const group = await createGroup(
      { name: "Arch", slug: uniq("arch"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "Numbat sightings on the trail", body: "Spotted a numbat at dawn." },
      group.id,
      author.id,
    );
    const answer = await db.answer.create({
      data: { questionId: q.id, authorId: author.id, body: "Numbat populations vary widely." },
    });

    const before = await searchContent({
      q: "numbat",
      scope: "selected",
      groupIds: [group.id],
      page: 1,
      per: 5,
    });
    expect(before.items.some((i) => i.questionId === q.id)).toBe(true);
    expect(
      before.items.some((i) => i.type === "answer" && i.answerId === answer.id),
    ).toBe(true);

    await db.group.update({
      where: { id: group.id },
      data: { archivedAt: new Date() },
    });

    const after = await searchContent({
      q: "numbat",
      scope: "all",
      groupIds: [],
      page: 1,
      per: 5,
    });
    expect(after.items.some((i) => i.questionId === q.id)).toBe(false);
    expect(after.items.some((i) => i.answerId === answer.id)).toBe(false);
  });
});
