/**
 * Notification service tests.
 *
 * Real-DB pattern (mirrors questions.test.ts).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-notifications-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup } = await import("./groups");
const { applyToGroup, NotFoundError } = await import("./memberships");
const { createQuestion } = await import("./questions");
const {
  notifyQuestionCreated,
  listForUser,
  markRead,
  markAllRead,
  QUESTION_CREATED,
} = await import("./notifications");

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

describe("notifyQuestionCreated", () => {
  it("creates one notification per approved member except the author", async () => {
    const owner = await makeUser("owner");
    const group = await createGroup(
      { name: "G", slug: uniq("fan"), autoApprove: false },
      owner.id,
    );

    const memberA = await makeUser("memA");
    const memberB = await makeUser("memB");
    const pending = await makeUser("pend");
    await applyToGroup(group.id, memberA.id);
    await applyToGroup(group.id, memberB.id);
    await applyToGroup(group.id, pending.id);
    await db.membership.update({
      where: { userId_groupId: { userId: memberA.id, groupId: group.id } },
      data: { status: "approved" },
    });
    await db.membership.update({
      where: { userId_groupId: { userId: memberB.id, groupId: group.id } },
      data: { status: "approved" },
    });
    // pending stays as pending

    const question = await createQuestion(
      { title: "Hello world", body: "body" },
      group.id,
      memberA.id,
    );

    const count = await notifyQuestionCreated(question, group, "Member A");
    // owner (approved) + memberB (approved). memberA is the author. pending excluded.
    expect(count).toBe(2);

    const aRows = await db.notification.findMany({ where: { userId: memberA.id } });
    expect(aRows).toHaveLength(0);

    const ownerRows = await db.notification.findMany({ where: { userId: owner.id } });
    expect(ownerRows).toHaveLength(1);
    expect(ownerRows[0]!.type).toBe(QUESTION_CREATED);
    const payload = JSON.parse(ownerRows[0]!.payload);
    expect(payload.questionId).toBe(question.id);
    expect(payload.questionTitle).toBe("Hello world");
    expect(payload.groupSlug).toBe(group.slug);
    expect(payload.authorName).toBe("Member A");

    const pendingRows = await db.notification.findMany({ where: { userId: pending.id } });
    expect(pendingRows).toHaveLength(0);
  });

  it("returns 0 when there are no other approved members", async () => {
    const solo = await makeUser("solo");
    const group = await createGroup(
      { name: "S", slug: uniq("solo"), autoApprove: true },
      solo.id,
    );
    const question = await createQuestion(
      { title: "Alone", body: "body" },
      group.id,
      solo.id,
    );
    const count = await notifyQuestionCreated(question, group, "Solo");
    expect(count).toBe(0);
  });
});

describe("listForUser", () => {
  it("returns notifications newest-first with unreadCount", async () => {
    const u = await makeUser("listU");
    await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "q1",
          questionTitle: "Old",
          groupSlug: "g",
          groupName: "G",
          authorName: "A",
        }),
        readAt: new Date(),
      },
    });
    await new Promise((r) => setTimeout(r, 5));
    await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "q2",
          questionTitle: "New",
          groupSlug: "g",
          groupName: "G",
          authorName: "A",
        }),
      },
    });

    const result = await listForUser(u.id);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.payload.questionTitle).toBe("New");
    expect(result.items[1]!.payload.questionTitle).toBe("Old");
    expect(result.unreadCount).toBe(1);
  });

  it("respects the limit option", async () => {
    const u = await makeUser("limU");
    for (let i = 0; i < 3; i += 1) {
      await db.notification.create({
        data: {
          userId: u.id,
          type: QUESTION_CREATED,
          payload: JSON.stringify({
            questionId: `q${i}`,
            questionTitle: `T${i}`,
            groupSlug: "g",
            groupName: "G",
            authorName: null,
          }),
        },
      });
    }
    const result = await listForUser(u.id, { limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.unreadCount).toBe(3);
  });
});

describe("markRead", () => {
  it("sets readAt for the user's own notification", async () => {
    const u = await makeUser("markU");
    const n = await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "q",
          questionTitle: "T",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
      },
    });
    expect(n.readAt).toBeNull();
    const updated = await markRead(n.id, u.id);
    expect(updated.readAt).not.toBeNull();
  });

  it("is idempotent on already-read rows", async () => {
    const u = await makeUser("idemU");
    const n = await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "q",
          questionTitle: "T",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
        readAt: new Date(),
      },
    });
    const result = await markRead(n.id, u.id);
    expect(result.readAt?.getTime()).toBe(n.readAt!.getTime());
  });

  it("rejects another user's notification with NotFoundError", async () => {
    const owner = await makeUser("ownN");
    const intruder = await makeUser("intN");
    const n = await db.notification.create({
      data: {
        userId: owner.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "q",
          questionTitle: "T",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
      },
    });
    await expect(markRead(n.id, intruder.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects unknown id with NotFoundError", async () => {
    const u = await makeUser("unkN");
    await expect(markRead("does-not-exist", u.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("markAllRead", () => {
  it("marks every unread notification for the user and leaves others alone", async () => {
    const u = await makeUser("allU");
    const other = await makeUser("otherU");
    for (let i = 0; i < 2; i += 1) {
      await db.notification.create({
        data: {
          userId: u.id,
          type: QUESTION_CREATED,
          payload: JSON.stringify({
            questionId: `q${i}`,
            questionTitle: "T",
            groupSlug: "g",
            groupName: "G",
            authorName: null,
          }),
        },
      });
    }
    await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "qr",
          questionTitle: "T",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
        readAt: new Date(),
      },
    });
    const otherUnread = await db.notification.create({
      data: {
        userId: other.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "qo",
          questionTitle: "T",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
      },
    });

    const updated = await markAllRead(u.id);
    expect(updated).toBe(2);
    expect(await db.notification.count({ where: { userId: u.id, readAt: null } })).toBe(0);
    const otherStill = await db.notification.findUnique({ where: { id: otherUnread.id } });
    expect(otherStill?.readAt).toBeNull();
  });
});
