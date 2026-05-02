/**
 * Question service tests.
 *
 * Real-DB pattern (mirrors db.test.ts): a throw-away SQLite file
 * initialised by `prisma migrate deploy` in beforeAll.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-questions-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup } = await import("./groups");
const { NotFoundError } = await import("./memberships");
const { createQuestion, getQuestionById, listQuestionsForGroup } = await import("./questions");

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
  return db.user.create({ data: { email: `${uniq(label)}@example.com` } });
}

describe("createQuestion", () => {
  it("creates a question owned by the author in the group", async () => {
    const author = await makeUser("author");
    const group = await createGroup(
      { name: "G", slug: uniq("g"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "How do I do X?", body: "I tried Y but Z happens." },
      group.id,
      author.id,
    );
    expect(q.groupId).toBe(group.id);
    expect(q.authorId).toBe(author.id);
    expect(q.title).toBe("How do I do X?");
    expect(q.status).toBe("open");
  });
});

describe("listQuestionsForGroup", () => {
  it("returns newest first with author, answer count, and vote score", async () => {
    const owner = await makeUser("ownerL");
    const group = await createGroup(
      { name: "L", slug: uniq("l"), autoApprove: true },
      owner.id,
    );
    const q1 = await createQuestion({ title: "First post", body: "first" }, group.id, owner.id);
    await new Promise((r) => setTimeout(r, 5));
    const q2 = await createQuestion({ title: "Second post", body: "second" }, group.id, owner.id);

    // q1 gets one answer + a +1 vote; q2 stays bare.
    await db.answer.create({
      data: { questionId: q1.id, authorId: owner.id, body: "answer body" },
    });
    const voter = await makeUser("voter");
    await db.vote.create({
      data: { userId: voter.id, targetType: "question", targetId: q1.id, value: 1 },
    });

    const page = await listQuestionsForGroup(group.id, { page: 1, per: 20 });
    expect(page.total).toBe(2);
    expect(page.items[0]!.id).toBe(q2.id); // newest first
    expect(page.items[1]!.id).toBe(q1.id);
    expect(page.items[1]!.answerCount).toBe(1);
    expect(page.items[1]!.voteScore).toBe(1);
    expect(page.items[0]!.answerCount).toBe(0);
    expect(page.items[0]!.voteScore).toBe(0);
    expect(page.items[0]!.author.id).toBe(owner.id);
  });

  it("paginates with skip/take", async () => {
    const owner = await makeUser("ownerP");
    const group = await createGroup(
      { name: "P", slug: uniq("p"), autoApprove: true },
      owner.id,
    );
    for (let i = 0; i < 3; i += 1) {
      await createQuestion({ title: `Q${i}`, body: "b" }, group.id, owner.id);
      await new Promise((r) => setTimeout(r, 2));
    }
    const first = await listQuestionsForGroup(group.id, { page: 1, per: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(3);
    const second = await listQuestionsForGroup(group.id, { page: 2, per: 2 });
    expect(second.items).toHaveLength(1);
  });

  it("scopes by group", async () => {
    const owner = await makeUser("ownerS");
    const groupA = await createGroup(
      { name: "A", slug: uniq("ga"), autoApprove: true },
      owner.id,
    );
    const groupB = await createGroup(
      { name: "B", slug: uniq("gb"), autoApprove: true },
      owner.id,
    );
    await createQuestion({ title: "in A", body: "x" }, groupA.id, owner.id);
    await createQuestion({ title: "in B", body: "y" }, groupB.id, owner.id);

    const aPage = await listQuestionsForGroup(groupA.id, { page: 1, per: 20 });
    expect(aPage.items.map((q) => q.title)).toEqual(["in A"]);
  });
});

describe("getQuestionById", () => {
  it("returns the question with author, group, and answers including vote scores", async () => {
    const author = await makeUser("authD");
    const group = await createGroup(
      { name: "D", slug: uniq("d"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "Title", body: "Body" },
      group.id,
      author.id,
    );
    const answerer = await makeUser("ans");
    const a = await db.answer.create({
      data: { questionId: q.id, authorId: answerer.id, body: "an answer" },
    });
    const voter = await makeUser("voterD");
    await db.vote.create({
      data: { userId: voter.id, targetType: "question", targetId: q.id, value: 1 },
    });
    await db.vote.create({
      data: { userId: voter.id, targetType: "answer", targetId: a.id, value: 1 },
    });

    const detail = await getQuestionById(q.id);
    expect(detail.id).toBe(q.id);
    expect(detail.author.id).toBe(author.id);
    expect(detail.group.slug).toBe(group.slug);
    expect(detail.voteScore).toBe(1);
    expect(detail.answers).toHaveLength(1);
    expect(detail.answers[0]!.author.id).toBe(answerer.id);
    expect(detail.answers[0]!.voteScore).toBe(1);
  });

  it("throws NotFoundError for unknown id", async () => {
    await expect(getQuestionById("does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });
});
