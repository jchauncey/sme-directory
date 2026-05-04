/**
 * Profile service tests. Real-DB pattern (mirrors questions.test.ts).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-profile-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup } = await import("./groups");
const { applyToGroup } = await import("./memberships");
const { createQuestion, acceptAnswer } = await import("./questions");
const {
  listQuestionsByAuthor,
  listAnswersByAuthor,
  listGroupsForUser,
  listFavoritesByUser,
  getPublicUserProfile,
} = await import("./profile");

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
  return db.user.create({
    data: { email: `${uniq(label)}@example.com`, name: label },
  });
}

describe("listQuestionsByAuthor", () => {
  it("returns only this user's questions, newest first, with group + counts + score", async () => {
    const author = await makeUser("qa-author");
    const other = await makeUser("qa-other");
    const group = await createGroup(
      { name: "QA G", slug: uniq("qag"), autoApprove: true },
      author.id,
    );
    await applyToGroup(group.id, other.id);

    const q1 = await createQuestion(
      { title: "First", body: "first body" },
      group.id,
      author.id,
    );
    await new Promise((r) => setTimeout(r, 5));
    const q2 = await createQuestion(
      { title: "Second", body: "second body" },
      group.id,
      author.id,
    );
    // Other user's question must be excluded.
    await createQuestion(
      { title: "Theirs", body: "irrelevant" },
      group.id,
      other.id,
    );

    // q1 gets one answer + a vote.
    await db.answer.create({
      data: { questionId: q1.id, authorId: other.id, body: "answer" },
    });
    await db.vote.create({
      data: { userId: other.id, targetType: "question", targetId: q1.id, value: 1 },
    });

    const page = await listQuestionsByAuthor(author.id, { page: 1, per: 20 });
    expect(page.total).toBe(2);
    expect(page.items.map((q) => q.id)).toEqual([q2.id, q1.id]);
    const first = page.items[0]!;
    expect(first.group.slug).toBe(group.slug);
    expect(first.answerCount).toBe(0);
    expect(first.voteScore).toBe(0);
    const second = page.items[1]!;
    expect(second.answerCount).toBe(1);
    expect(second.voteScore).toBe(1);
  });
});

describe("listAnswersByAuthor", () => {
  it("returns user's answers across groups with question summary and score", async () => {
    const answerer = await makeUser("ans-author");
    const asker = await makeUser("ans-asker");
    const groupA = await createGroup(
      { name: "AA", slug: uniq("aa"), autoApprove: true },
      asker.id,
    );
    const groupB = await createGroup(
      { name: "BB", slug: uniq("bb"), autoApprove: true },
      asker.id,
    );
    await applyToGroup(groupA.id, answerer.id);
    await applyToGroup(groupB.id, answerer.id);

    const qa = await createQuestion(
      { title: "QA", body: "?" },
      groupA.id,
      asker.id,
    );
    const qb = await createQuestion(
      { title: "QB", body: "?" },
      groupB.id,
      asker.id,
    );

    const aA = await db.answer.create({
      data: { questionId: qa.id, authorId: answerer.id, body: "A answer" },
    });
    await new Promise((r) => setTimeout(r, 5));
    const aB = await db.answer.create({
      data: { questionId: qb.id, authorId: answerer.id, body: "B answer" },
    });

    // Vote on aA, accept aB.
    await db.vote.create({
      data: { userId: asker.id, targetType: "answer", targetId: aA.id, value: 1 },
    });
    await acceptAnswer(qb.id, aB.id, asker.id);

    const page = await listAnswersByAuthor(answerer.id, { page: 1, per: 20 });
    expect(page.total).toBe(2);
    // Newest first => aB before aA.
    expect(page.items.map((a) => a.id)).toEqual([aB.id, aA.id]);

    const first = page.items[0]!;
    expect(first.isAccepted).toBe(true);
    expect(first.question.title).toBe("QB");
    expect(first.question.group.slug).toBe(groupB.slug);

    const second = page.items[1]!;
    expect(second.isAccepted).toBe(false);
    expect(second.voteScore).toBe(1);
  });

  it("excludes answers authored by other users", async () => {
    const me = await makeUser("ans-me");
    const them = await makeUser("ans-them");
    const group = await createGroup(
      { name: "X", slug: uniq("ax"), autoApprove: true },
      me.id,
    );
    await applyToGroup(group.id, them.id);
    const q = await createQuestion(
      { title: "T", body: "?" },
      group.id,
      me.id,
    );
    await db.answer.create({
      data: { questionId: q.id, authorId: them.id, body: "theirs" },
    });

    const page = await listAnswersByAuthor(me.id, { page: 1, per: 20 });
    expect(page.total).toBe(0);
  });
});

describe("listGroupsForUser", () => {
  it("excludes pending memberships when includePending is false", async () => {
    const user = await makeUser("g-user");
    const ownerA = await makeUser("g-ownerA");
    const ownerB = await makeUser("g-ownerB");
    const auto = await createGroup(
      { name: "auto", slug: uniq("auto"), autoApprove: true },
      ownerA.id,
    );
    const manual = await createGroup(
      { name: "manual", slug: uniq("manual"), autoApprove: false },
      ownerB.id,
    );
    await applyToGroup(auto.id, user.id); // approved
    await applyToGroup(manual.id, user.id); // pending

    const approved = await listGroupsForUser(user.id, { includePending: false });
    expect(approved.map((g) => g.slug)).toEqual([auto.slug]);

    const all = await listGroupsForUser(user.id, { includePending: true });
    expect(all.map((g) => g.slug).sort()).toEqual([auto.slug, manual.slug].sort());
    const manualEntry = all.find((g) => g.slug === manual.slug)!;
    expect(manualEntry.status).toBe("pending");
  });

  it("returns owned groups with role=owner", async () => {
    const owner = await makeUser("g-owner");
    const group = await createGroup(
      { name: "owned", slug: uniq("owned"), autoApprove: false },
      owner.id,
    );
    const groups = await listGroupsForUser(owner.id, { includePending: false });
    const entry = groups.find((g) => g.slug === group.slug)!;
    expect(entry.role).toBe("owner");
    expect(entry.status).toBe("approved");
  });
});

describe("listFavoritesByUser", () => {
  it("returns interleaved questions + answers in createdAt desc order, dropping orphans", async () => {
    const user = await makeUser("fav-user");
    const author = await makeUser("fav-author");
    const group = await createGroup(
      { name: "fav G", slug: uniq("favg"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "fav Q", body: "body" },
      group.id,
      author.id,
    );
    const a = await db.answer.create({
      data: { questionId: q.id, authorId: author.id, body: "fav A body" },
    });

    // Insert favorites in known order.
    const favQ = await db.favorite.create({
      data: { userId: user.id, targetType: "question", targetId: q.id },
    });
    await new Promise((r) => setTimeout(r, 5));
    const favA = await db.favorite.create({
      data: { userId: user.id, targetType: "answer", targetId: a.id },
    });
    await new Promise((r) => setTimeout(r, 5));
    // Orphan favorite (target id that doesn't exist).
    await db.favorite.create({
      data: { userId: user.id, targetType: "question", targetId: "ghost-id" },
    });

    const items = await listFavoritesByUser(user.id);
    // Newest first; orphan must be silently dropped.
    expect(items.map((f) => f.kind)).toEqual(["answer", "question"]);
    expect(items[0]!.id).toBe(a.id);
    expect(items[1]!.id).toBe(q.id);
    expect((items[1] as { groupSlug: string }).groupSlug).toBe(group.slug);

    // (silence unused-var lint)
    void favQ;
    void favA;
  });

  it("returns [] when user has no favorites", async () => {
    const user = await makeUser("fav-empty");
    const items = await listFavoritesByUser(user.id);
    expect(items).toEqual([]);
  });
});

describe("getPublicUserProfile", () => {
  it("returns id + name and does NOT include email", async () => {
    const user = await makeUser("pub-user");
    const profile = await getPublicUserProfile(user.id);
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(user.id);
    expect(profile!.name).toBe("pub-user");
    expect((profile as Record<string, unknown>).email).toBeUndefined();
  });

  it("returns null for unknown id", async () => {
    const profile = await getPublicUserProfile("does-not-exist");
    expect(profile).toBeNull();
  });
});
