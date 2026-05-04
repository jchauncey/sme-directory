/**
 * Favorite service tests.
 *
 * Real-DB pattern: a throw-away SQLite file initialised by `prisma migrate deploy`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-favorites-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup } = await import("./groups");
const { NotFoundError } = await import("./memberships");
const {
  toggleFavorite,
  viewerFavoritesFor,
  listFavoritesForUser,
} = await import("./favorites");

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

async function setupGroupWithQuestion() {
  const author = await makeUser("author");
  const group = await createGroup(
    { name: "G", slug: uniq("g"), autoApprove: true },
    author.id,
  );
  const question = await db.question.create({
    data: {
      groupId: group.id,
      authorId: author.id,
      title: "Seed question for tests",
      body: "Seed body",
    },
  });
  return { author, group, question };
}

describe("toggleFavorite on questions", () => {
  it("creates a favorite and returns favorited=true", async () => {
    const { question } = await setupGroupWithQuestion();
    const user = await makeUser("fav");

    const result = await toggleFavorite(
      { targetType: "question", targetId: question.id },
      user.id,
    );

    expect(result.favorited).toBe(true);
    expect(result.targetType).toBe("question");
    expect(result.targetId).toBe(question.id);

    const stored = await db.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: user.id,
          targetType: "question",
          targetId: question.id,
        },
      },
    });
    expect(stored).not.toBeNull();
  });

  it("toggles off on second call and returns favorited=false", async () => {
    const { question } = await setupGroupWithQuestion();
    const user = await makeUser("fav-off");

    await toggleFavorite({ targetType: "question", targetId: question.id }, user.id);
    const second = await toggleFavorite(
      { targetType: "question", targetId: question.id },
      user.id,
    );

    expect(second.favorited).toBe(false);

    const stored = await db.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: user.id,
          targetType: "question",
          targetId: question.id,
        },
      },
    });
    expect(stored).toBeNull();
  });

  it("allows favoriting your own question", async () => {
    const { author, question } = await setupGroupWithQuestion();
    const result = await toggleFavorite(
      { targetType: "question", targetId: question.id },
      author.id,
    );
    expect(result.favorited).toBe(true);
  });

  it("allows favoriting from a non-member of the group", async () => {
    const { question } = await setupGroupWithQuestion();
    const stranger = await makeUser("stranger");
    const result = await toggleFavorite(
      { targetType: "question", targetId: question.id },
      stranger.id,
    );
    expect(result.favorited).toBe(true);
  });

  it("throws NotFoundError for unknown question id", async () => {
    const user = await makeUser("nf");
    await expect(
      toggleFavorite(
        { targetType: "question", targetId: "does-not-exist" },
        user.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("toggleFavorite on answers", () => {
  it("creates a favorite on an answer", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const answerer = await makeUser("answerer");
    await db.membership.create({
      data: { groupId: group.id, userId: answerer.id, status: "approved" },
    });
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: answerer.id, body: "ans" },
    });

    const user = await makeUser("a-fav");
    const result = await toggleFavorite(
      { targetType: "answer", targetId: answer.id },
      user.id,
    );

    expect(result.favorited).toBe(true);
    expect(result.targetType).toBe("answer");
  });

  it("allows favoriting your own answer", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const answerer = await makeUser("self-ans");
    await db.membership.create({
      data: { groupId: group.id, userId: answerer.id, status: "approved" },
    });
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: answerer.id, body: "mine" },
    });

    const result = await toggleFavorite(
      { targetType: "answer", targetId: answer.id },
      answerer.id,
    );
    expect(result.favorited).toBe(true);
  });

  it("throws NotFoundError for unknown answer id", async () => {
    const user = await makeUser("a-nf");
    await expect(
      toggleFavorite(
        { targetType: "answer", targetId: "does-not-exist" },
        user.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("viewerFavoritesFor", () => {
  it("returns an empty set when no ids are supplied", async () => {
    const user = await makeUser("vf-empty");
    const set = await viewerFavoritesFor("question", [], user.id);
    expect(set.size).toBe(0);
  });

  it("returns only the supplied user's favorited target ids", async () => {
    const { question } = await setupGroupWithQuestion();
    const me = await makeUser("me");
    const other = await makeUser("other");
    await toggleFavorite({ targetType: "question", targetId: question.id }, other.id);

    const before = await viewerFavoritesFor("question", [question.id], me.id);
    expect(before.has(question.id)).toBe(false);

    await toggleFavorite({ targetType: "question", targetId: question.id }, me.id);
    const after = await viewerFavoritesFor("question", [question.id], me.id);
    expect(after.has(question.id)).toBe(true);
  });
});

describe("listFavoritesForUser", () => {
  it("returns favorited questions and answers in newest-first order", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const answerer = await makeUser("la-ans");
    await db.membership.create({
      data: { groupId: group.id, userId: answerer.id, status: "approved" },
    });
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: answerer.id, body: "an answer" },
    });

    const user = await makeUser("lister");

    await toggleFavorite({ targetType: "question", targetId: question.id }, user.id);
    // small delay to ensure distinct createdAt ordering
    await new Promise((r) => setTimeout(r, 5));
    await toggleFavorite({ targetType: "answer", targetId: answer.id }, user.id);

    const result = await listFavoritesForUser(user.id);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe(question.id);
    expect(result.questions[0].title).toBe("Seed question for tests");
    expect(result.questions[0].group.id).toBe(group.id);
    expect(result.answers).toHaveLength(1);
    expect(result.answers[0].id).toBe(answer.id);
    expect(result.answers[0].question.id).toBe(question.id);
  });

  it("omits favorites whose target was deleted", async () => {
    const { question } = await setupGroupWithQuestion();
    const user = await makeUser("ghost");
    await toggleFavorite({ targetType: "question", targetId: question.id }, user.id);

    // Manually drop the question without the cascade (simulate orphan).
    await db.favorite.update({
      where: {
        userId_targetType_targetId: {
          userId: user.id,
          targetType: "question",
          targetId: question.id,
        },
      },
      data: { targetId: "no-such-question" },
    });

    const result = await listFavoritesForUser(user.id);
    expect(result.questions).toHaveLength(0);
  });

  it("returns empty arrays when user has no favorites", async () => {
    const user = await makeUser("none");
    const result = await listFavoritesForUser(user.id);
    expect(result.questions).toHaveLength(0);
    expect(result.answers).toHaveLength(0);
  });
});
