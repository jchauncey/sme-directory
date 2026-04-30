/**
 * Prisma smoke tests
 *
 * These tests run against a dedicated SQLite file rather than the developer's
 * prisma/dev.db so that CI and local runs never corrupt development data.
 * DATABASE_URL is set before the `db` singleton is imported — this is safe
 * because Vitest executes each test module in its own worker context.
 *
 * The temp database is initialised with `prisma migrate deploy` in beforeAll
 * and the file is removed in afterAll.
 *
 * Cleanup note: Question.authorId and Answer.authorId carry onDelete:Restrict
 * (Prisma's default — no explicit onDelete in the schema).  Deleting a User
 * therefore requires first deleting their Answers, then their Questions, then
 * their Groups, before the User row can be removed.  Models with
 * onDelete:Cascade (Membership, Vote, Favorite, Notification) are verified
 * to cascade-delete when their User is deleted.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---- point at a fresh, throw-away SQLite file ----
const testDbPath = path.join(os.tmpdir(), `sme-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

// Import db AFTER env is set so the singleton picks up our test URL
const { db } = await import("./db");

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // import.meta.dirname is src/lib  →  ../..  resolves to the project root
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
  // Clean up the throw-away DB file and any WAL/SHM sidecars
  for (const ext of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${testDbPath}${ext}`);
    } catch {
      // file may not exist — ignore
    }
  }
});

// ---------------------------------------------------------------------------
// Helper: delete a user and all rows that reference it, respecting the
// onDelete:Restrict constraints on Question.authorId / Answer.authorId.
// ---------------------------------------------------------------------------
async function cleanupUser(userId: string): Promise<void> {
  // 1. Clear accepted-answer pointers to unblock answer deletion
  await db.question.updateMany({
    where: { authorId: userId },
    data: { acceptedAnswerId: null },
  });
  // 2. Delete answers authored by this user
  await db.answer.deleteMany({ where: { authorId: userId } });
  // 3. Delete questions authored by this user (cascade removes answers by others)
  await db.question.deleteMany({ where: { authorId: userId } });
  // 4. Delete groups created by this user
  await db.group.deleteMany({ where: { createdById: userId } });
  // 5. Delete the user (Membership/Vote/Favorite/Notification cascade automatically)
  await db.user.delete({ where: { id: userId } });
}

// ---------------------------------------------------------------------------
// 1. Singleton shape
// ---------------------------------------------------------------------------
describe("db singleton", () => {
  it("is defined and exposes $connect / $disconnect", () => {
    expect(db).toBeDefined();
    expect(typeof db.$connect).toBe("function");
    expect(typeof db.$disconnect).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 2. User round-trip
// ---------------------------------------------------------------------------
describe("User model", () => {
  it("creates a user, finds it by email, and deletes it", async () => {
    const email = `roundtrip-${Date.now()}@test.example`;

    const created = await db.user.create({ data: { email } });
    expect(created.id).toBeTruthy();
    expect(created.email).toBe(email);

    const found = await db.user.findUnique({ where: { email } });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);

    await db.user.delete({ where: { id: created.id } });

    const gone = await db.user.findUnique({ where: { email } });
    expect(gone).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Full model graph round-trip
//    Group → Membership → Question → Answer → Vote → Favorite → Notification
// ---------------------------------------------------------------------------
describe("full model graph", () => {
  it("creates one row per remaining model and verifies FK relations", async () => {
    const suffix = Date.now();
    const email = `graph-${suffix}@test.example`;

    // User
    const user = await db.user.create({ data: { email, name: "Test User" } });

    // Group
    const group = await db.group.create({
      data: { slug: `test-group-${suffix}`, name: "Test Group", createdById: user.id },
    });
    expect(group.createdById).toBe(user.id);

    // Membership
    const membership = await db.membership.create({
      data: { userId: user.id, groupId: group.id, role: "owner", status: "approved" },
    });
    expect(membership.userId).toBe(user.id);
    expect(membership.groupId).toBe(group.id);

    // Question
    const question = await db.question.create({
      data: {
        groupId: group.id,
        authorId: user.id,
        title: "What is the meaning of life?",
        body: "Please explain.",
      },
    });
    expect(question.groupId).toBe(group.id);
    expect(question.authorId).toBe(user.id);
    expect(question.status).toBe("open");

    // Answer
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: user.id, body: "42" },
    });
    expect(answer.questionId).toBe(question.id);

    // Vote
    const vote = await db.vote.create({
      data: { userId: user.id, targetType: "answer", targetId: answer.id, value: 1 },
    });
    expect(vote.userId).toBe(user.id);

    // Favorite
    const favorite = await db.favorite.create({
      data: { userId: user.id, targetType: "question", targetId: question.id },
    });
    expect(favorite.userId).toBe(user.id);

    // Notification
    const notification = await db.notification.create({
      data: {
        userId: user.id,
        type: "new_answer",
        payload: JSON.stringify({ answerId: answer.id }),
      },
    });
    expect(notification.userId).toBe(user.id);
    expect(JSON.parse(notification.payload)).toMatchObject({ answerId: answer.id });

    // Cleanup via ordered deletes (see cleanupUser for rationale)
    await cleanupUser(user.id);

    // Models with onDelete:Cascade should no longer exist after user deletion
    expect(await db.membership.findUnique({ where: { id: membership.id } })).toBeNull();
    expect(await db.vote.findUnique({ where: { id: vote.id } })).toBeNull();
    expect(await db.favorite.findUnique({ where: { id: favorite.id } })).toBeNull();
    expect(await db.notification.findUnique({ where: { id: notification.id } })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. acceptedAnswer named-relation disambiguation
// ---------------------------------------------------------------------------
describe("Question.acceptedAnswer relation", () => {
  it("resolves the named AcceptedAnswer relation after setting acceptedAnswerId", async () => {
    const suffix = Date.now();

    const user = await db.user.create({ data: { email: `accepted-${suffix}@test.example` } });
    const group = await db.group.create({
      data: { slug: `accepted-group-${suffix}`, name: "Accepted Group", createdById: user.id },
    });
    const question = await db.question.create({
      data: { groupId: group.id, authorId: user.id, title: "How?", body: "Explain how." },
    });
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: user.id, body: "Like this." },
    });

    // Set the acceptedAnswer
    await db.question.update({
      where: { id: question.id },
      data: { acceptedAnswerId: answer.id, status: "answered" },
    });

    // Fetch back with the named relation included
    const fetched = await db.question.findUnique({
      where: { id: question.id },
      include: { acceptedAnswer: true },
    });

    expect(fetched).not.toBeNull();
    expect(fetched!.acceptedAnswerId).toBe(answer.id);
    expect(fetched!.acceptedAnswer).not.toBeNull();
    expect(fetched!.acceptedAnswer!.id).toBe(answer.id);
    expect(fetched!.acceptedAnswer!.body).toBe("Like this.");
    expect(fetched!.status).toBe("answered");

    await cleanupUser(user.id);
  });
});

// ---------------------------------------------------------------------------
// 5. Vote unique-constraint violation (P2002)
// ---------------------------------------------------------------------------
describe("Vote unique constraint", () => {
  it("throws a P2002 error when a duplicate (userId, targetType, targetId) vote is inserted", async () => {
    const suffix = Date.now();

    const user = await db.user.create({ data: { email: `vote-unique-${suffix}@test.example` } });
    const group = await db.group.create({
      data: { slug: `vote-group-${suffix}`, name: "Vote Group", createdById: user.id },
    });
    const question = await db.question.create({
      data: { groupId: group.id, authorId: user.id, title: "Q", body: "B" },
    });
    const answer = await db.answer.create({
      data: { questionId: question.id, authorId: user.id, body: "A" },
    });

    // First vote — must succeed
    await db.vote.create({
      data: { userId: user.id, targetType: "answer", targetId: answer.id, value: 1 },
    });

    // Second vote with same (userId, targetType, targetId) — must throw P2002
    await expect(
      db.vote.create({
        data: { userId: user.id, targetType: "answer", targetId: answer.id, value: -1 },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await cleanupUser(user.id);
  });
});
