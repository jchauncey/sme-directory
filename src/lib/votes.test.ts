/**
 * Vote service tests.
 *
 * Real-DB pattern: a throw-away SQLite file initialised by `prisma migrate deploy`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-votes-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup } = await import("./groups");
const { applyToGroup, AuthorizationError, NotFoundError } = await import(
  "./memberships"
);
const { castVote, viewerVotesFor, voteScoresFor } = await import("./votes");

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

async function setupGroupWithQuestion(autoApprove = true) {
  const author = await makeUser("author");
  const group = await createGroup(
    { name: "G", slug: uniq("g"), autoApprove },
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

describe("castVote on questions", () => {
  it("creates a vote and returns voted=true with incremented score", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const voter = await makeUser("voter");
    await applyToGroup(group.id, voter.id);

    const result = await castVote(
      { targetType: "question", targetId: question.id },
      voter.id,
    );

    expect(result.voted).toBe(true);
    expect(result.voteScore).toBe(1);
    expect(result.targetType).toBe("question");
    expect(result.targetId).toBe(question.id);

    const stored = await db.vote.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: voter.id,
          targetType: "question",
          targetId: question.id,
        },
      },
    });
    expect(stored).not.toBeNull();
    expect(stored!.value).toBe(1);
  });

  it("toggles off on second call and returns voted=false", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const voter = await makeUser("toggler");
    await applyToGroup(group.id, voter.id);

    await castVote({ targetType: "question", targetId: question.id }, voter.id);
    const second = await castVote(
      { targetType: "question", targetId: question.id },
      voter.id,
    );

    expect(second.voted).toBe(false);
    expect(second.voteScore).toBe(0);

    const stored = await db.vote.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: voter.id,
          targetType: "question",
          targetId: question.id,
        },
      },
    });
    expect(stored).toBeNull();
  });

  it("rejects self-vote on own question", async () => {
    const { author, question } = await setupGroupWithQuestion();
    await expect(
      castVote({ targetType: "question", targetId: question.id }, author.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects votes from non-members", async () => {
    const { question } = await setupGroupWithQuestion();
    const stranger = await makeUser("stranger");
    await expect(
      castVote({ targetType: "question", targetId: question.id }, stranger.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects votes from pending applicants", async () => {
    const { group, question } = await setupGroupWithQuestion(false);
    const pending = await makeUser("pending");
    await applyToGroup(group.id, pending.id);
    await expect(
      castVote({ targetType: "question", targetId: question.id }, pending.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("throws NotFoundError for unknown question id", async () => {
    const voter = await makeUser("v404");
    await expect(
      castVote(
        { targetType: "question", targetId: "does-not-exist" },
        voter.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("castVote on answers", () => {
  it("resolves the answer's group via question and records the vote", async () => {
    const { author, group, question } = await setupGroupWithQuestion();
    const answerer = await makeUser("answerer");
    await applyToGroup(group.id, answerer.id);
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: answerer.id, body: "ans" },
    });

    // Author of the question (not the answer) votes on the answer.
    const result = await castVote(
      { targetType: "answer", targetId: answer.id },
      author.id,
    );

    expect(result.voted).toBe(true);
    expect(result.voteScore).toBe(1);
  });

  it("rejects self-vote on own answer", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const answerer = await makeUser("self-ans");
    await applyToGroup(group.id, answerer.id);
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: answerer.id, body: "mine" },
    });
    await expect(
      castVote({ targetType: "answer", targetId: answer.id }, answerer.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("throws NotFoundError for unknown answer id", async () => {
    const voter = await makeUser("va404");
    await expect(
      castVote(
        { targetType: "answer", targetId: "does-not-exist" },
        voter.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("voteScoresFor", () => {
  it("returns an empty map when no ids are supplied", async () => {
    const map = await voteScoresFor("question", []);
    expect(map.size).toBe(0);
  });

  it("sums values per target", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const v1 = await makeUser("vs1");
    const v2 = await makeUser("vs2");
    await applyToGroup(group.id, v1.id);
    await applyToGroup(group.id, v2.id);
    await castVote({ targetType: "question", targetId: question.id }, v1.id);
    await castVote({ targetType: "question", targetId: question.id }, v2.id);

    const map = await voteScoresFor("question", [question.id]);
    expect(map.get(question.id)).toBe(2);
  });
});

describe("viewerVotesFor", () => {
  it("returns only the supplied user's votes", async () => {
    const { group, question } = await setupGroupWithQuestion();
    const me = await makeUser("me");
    const other = await makeUser("other");
    await applyToGroup(group.id, me.id);
    await applyToGroup(group.id, other.id);
    await castVote({ targetType: "question", targetId: question.id }, other.id);

    const beforeMe = await viewerVotesFor("question", [question.id], me.id);
    expect(beforeMe.size).toBe(0);

    await castVote({ targetType: "question", targetId: question.id }, me.id);
    const afterMe = await viewerVotesFor("question", [question.id], me.id);
    expect(afterMe.get(question.id)).toBe(1);

    const otherMap = await viewerVotesFor("question", [question.id], other.id);
    expect(otherMap.get(question.id)).toBe(1);
  });
});
