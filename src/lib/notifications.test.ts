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
const { createAnswer } = await import("./answers");
const { setPreferenceForGroup } = await import("./notification-preferences");
const {
  notifyQuestionCreated,
  notifyAnswerPosted,
  notifyAnswerAccepted,
  notifyMembershipDecision,
  listForUser,
  markRead,
  markAllRead,
  QUESTION_CREATED,
  ANSWER_POSTED,
  ANSWER_ACCEPTED,
  MEMBERSHIP_APPROVED,
  MEMBERSHIP_REJECTED,
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

  it("skips users who muted the question category for this group", async () => {
    const owner = await makeUser("muteOwner");
    const group = await createGroup(
      { name: "M", slug: uniq("mute"), autoApprove: true },
      owner.id,
    );
    const muted = await makeUser("muted");
    const noisy = await makeUser("noisy");
    const otherMute = await makeUser("otherMute");
    await applyToGroup(group.id, muted.id);
    await applyToGroup(group.id, noisy.id);
    await applyToGroup(group.id, otherMute.id);
    await db.membership.update({
      where: { userId_groupId: { userId: muted.id, groupId: group.id } },
      data: { status: "approved" },
    });
    await db.membership.update({
      where: { userId_groupId: { userId: noisy.id, groupId: group.id } },
      data: { status: "approved" },
    });
    await db.membership.update({
      where: { userId_groupId: { userId: otherMute.id, groupId: group.id } },
      data: { status: "approved" },
    });

    await setPreferenceForGroup(muted.id, group.id, ["question"]);
    await setPreferenceForGroup(otherMute.id, group.id, ["answer"]); // muted other category

    const question = await createQuestion(
      { title: "Hi", body: "body" },
      group.id,
      owner.id,
    );
    const count = await notifyQuestionCreated(question, group, "Owner");

    // Recipients are: noisy + otherMute (muted excluded; owner is the author).
    expect(count).toBe(2);
    expect(await db.notification.count({ where: { userId: muted.id } })).toBe(0);
    expect(await db.notification.count({ where: { userId: noisy.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: otherMute.id } })).toBe(1);
  });

  it("ignores mutes scoped to a different group", async () => {
    const owner = await makeUser("crossOwner");
    const g1 = await createGroup(
      { name: "X1", slug: uniq("cx1"), autoApprove: true },
      owner.id,
    );
    const g2 = await createGroup(
      { name: "X2", slug: uniq("cx2"), autoApprove: true },
      owner.id,
    );
    const member = await makeUser("crossMember");
    await applyToGroup(g1.id, member.id);
    await applyToGroup(g2.id, member.id);

    // Muted in g2 only — should still receive g1 notifications.
    await setPreferenceForGroup(member.id, g2.id, ["question"]);

    const question = await createQuestion(
      { title: "X", body: "body" },
      g1.id,
      owner.id,
    );
    const count = await notifyQuestionCreated(question, g1, "Owner");
    expect(count).toBe(1);
    expect(await db.notification.count({ where: { userId: member.id } })).toBe(1);
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
    const titles = result.items.map((i) =>
      i.type === QUESTION_CREATED ? i.payload.questionTitle : null,
    );
    expect(titles).toEqual(["New", "Old"]);
    expect(result.unreadCount).toBe(1);
  });

  it("excludes notifications whose referenced question is soft-deleted", async () => {
    const u = await makeUser("delU");
    const owner = await makeUser("delOwner");
    const group = await createGroup(
      { name: "DN", slug: uniq("dn"), autoApprove: true },
      owner.id,
    );
    const visible = await createQuestion(
      { title: "Visible Q", body: "b" },
      group.id,
      owner.id,
    );
    const hidden = await createQuestion(
      { title: "Hidden Q", body: "b" },
      group.id,
      owner.id,
    );
    await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: visible.id,
          questionTitle: "Visible Q",
          groupSlug: group.slug,
          groupName: group.name,
          authorName: "x",
        }),
      },
    });
    await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: hidden.id,
          questionTitle: "Hidden Q",
          groupSlug: group.slug,
          groupName: group.name,
          authorName: "x",
        }),
      },
    });
    await db.question.update({
      where: { id: hidden.id },
      data: { deletedAt: new Date() },
    });

    const result = await listForUser(u.id);
    const ids = result.items.map((i) =>
      i.type === QUESTION_CREATED ? i.payload.questionId : null,
    );
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(hidden.id);
  });

  it("paginates with page/per and reports total", async () => {
    const u = await makeUser("pagU");
    for (let i = 0; i < 5; i += 1) {
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
      await new Promise((r) => setTimeout(r, 1));
    }
    const p1 = await listForUser(u.id, { page: 1, per: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.total).toBe(5);
    expect(p1.page).toBe(1);
    expect(p1.per).toBe(2);
    const p3 = await listForUser(u.id, { page: 3, per: 2 });
    expect(p3.items).toHaveLength(1);
    expect(p3.total).toBe(5);
  });

  it("filters by type prefix", async () => {
    const u = await makeUser("typU");
    await db.notification.create({
      data: {
        userId: u.id,
        type: "question.created",
        payload: JSON.stringify({
          questionId: "qa",
          questionTitle: "A",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
      },
    });
    await db.notification.create({
      data: {
        userId: u.id,
        type: "answer.posted",
        payload: JSON.stringify({
          questionId: "qb",
          questionTitle: "B",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
      },
    });

    const onlyQuestions = await listForUser(u.id, { types: ["question"] });
    expect(onlyQuestions.items).toHaveLength(1);
    expect(onlyQuestions.items[0]!.type).toBe("question.created");

    const onlyAnswers = await listForUser(u.id, { types: ["answer"] });
    expect(onlyAnswers.items).toHaveLength(1);
    expect(onlyAnswers.items[0]!.type).toBe("answer.posted");

    const both = await listForUser(u.id, { types: ["question", "answer"] });
    expect(both.items).toHaveLength(2);

    const none = await listForUser(u.id, { types: [] });
    expect(none.items).toHaveLength(2); // empty types means no filter
  });

  it("filters to unread when unreadOnly is set", async () => {
    const u = await makeUser("unrU");
    await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "qx",
          questionTitle: "X",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
        readAt: new Date(),
      },
    });
    await db.notification.create({
      data: {
        userId: u.id,
        type: QUESTION_CREATED,
        payload: JSON.stringify({
          questionId: "qy",
          questionTitle: "Y",
          groupSlug: "g",
          groupName: "G",
          authorName: null,
        }),
      },
    });
    const all = await listForUser(u.id);
    expect(all.items).toHaveLength(2);
    const unread = await listForUser(u.id, { unreadOnly: true });
    expect(unread.items).toHaveLength(1);
    const unreadItem = unread.items[0]!;
    if (unreadItem.type !== QUESTION_CREATED) throw new Error("expected question.created");
    expect(unreadItem.payload.questionId).toBe("qy");
    expect(unread.total).toBe(1);
    expect(unread.unreadCount).toBe(1);
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

describe("notifyAnswerPosted", () => {
  it("notifies the question author with deep-link payload", async () => {
    const author = await makeUser("qAuthor");
    const answerer = await makeUser("answerer");
    const group = await createGroup(
      { name: "AP", slug: uniq("ap"), autoApprove: true },
      author.id,
    );
    await applyToGroup(group.id, answerer.id);
    const question = await createQuestion(
      { title: "Help?", body: "body" },
      group.id,
      author.id,
    );
    const answer = await createAnswer(
      { body: "answer body" },
      question.id,
      answerer.id,
    );

    const count = await notifyAnswerPosted(
      { id: answer.id, authorId: answer.authorId },
      { id: question.id, title: question.title, authorId: question.authorId },
      { slug: group.slug, name: group.name },
      "Answerer Name",
    );
    expect(count).toBe(1);

    const rows = await db.notification.findMany({ where: { userId: author.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe(ANSWER_POSTED);
    const payload = JSON.parse(rows[0]!.payload);
    expect(payload.questionId).toBe(question.id);
    expect(payload.questionTitle).toBe("Help?");
    expect(payload.groupSlug).toBe(group.slug);
    expect(payload.groupName).toBe(group.name);
    expect(payload.answerId).toBe(answer.id);
    expect(payload.answererName).toBe("Answerer Name");
  });

  it("returns 0 when the answerer is the question author", async () => {
    const author = await makeUser("selfAns");
    const group = await createGroup(
      { name: "SA", slug: uniq("sa"), autoApprove: true },
      author.id,
    );
    const question = await createQuestion(
      { title: "Self", body: "body" },
      group.id,
      author.id,
    );
    const answer = await createAnswer(
      { body: "self answer" },
      question.id,
      author.id,
    );

    const count = await notifyAnswerPosted(
      { id: answer.id, authorId: answer.authorId },
      { id: question.id, title: question.title, authorId: question.authorId },
      { slug: group.slug, name: group.name },
      "Author",
    );
    expect(count).toBe(0);
    const rows = await db.notification.findMany({ where: { userId: author.id } });
    expect(rows).toHaveLength(0);
  });
});

describe("notifyAnswerAccepted", () => {
  it("notifies the answer author with deep-link payload", async () => {
    const author = await makeUser("aaAuthor");
    const answerer = await makeUser("aaAnswerer");
    const group = await createGroup(
      { name: "AA", slug: uniq("aa"), autoApprove: true },
      author.id,
    );
    await applyToGroup(group.id, answerer.id);
    const question = await createQuestion(
      { title: "Q", body: "body" },
      group.id,
      author.id,
    );
    const answer = await createAnswer(
      { body: "ans" },
      question.id,
      answerer.id,
    );

    const count = await notifyAnswerAccepted(
      { id: answer.id, authorId: answer.authorId },
      { id: question.id, title: question.title },
      { slug: group.slug, name: group.name },
      { id: author.id, name: "Question Author" },
    );
    expect(count).toBe(1);

    const rows = await db.notification.findMany({ where: { userId: answerer.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe(ANSWER_ACCEPTED);
    const payload = JSON.parse(rows[0]!.payload);
    expect(payload.questionId).toBe(question.id);
    expect(payload.questionTitle).toBe("Q");
    expect(payload.groupSlug).toBe(group.slug);
    expect(payload.groupName).toBe(group.name);
    expect(payload.answerId).toBe(answer.id);
    expect(payload.actorName).toBe("Question Author");
  });

  it("returns 0 when the actor is the answer author (accepting own answer)", async () => {
    const author = await makeUser("selfAccept");
    const group = await createGroup(
      { name: "SC", slug: uniq("sc"), autoApprove: true },
      author.id,
    );
    const question = await createQuestion(
      { title: "Q", body: "body" },
      group.id,
      author.id,
    );
    const answer = await createAnswer(
      { body: "ans" },
      question.id,
      author.id,
    );

    const count = await notifyAnswerAccepted(
      { id: answer.id, authorId: answer.authorId },
      { id: question.id, title: question.title },
      { slug: group.slug, name: group.name },
      { id: author.id, name: "Author" },
    );
    expect(count).toBe(0);
    const rows = await db.notification.findMany({ where: { userId: author.id } });
    expect(rows).toHaveLength(0);
  });
});

describe("notifyMembershipDecision", () => {
  it("notifies the target user on approval", async () => {
    const owner = await makeUser("mdOwner");
    const applicant = await makeUser("mdApplicant");
    const group = await createGroup(
      { name: "MD", slug: uniq("md"), autoApprove: false },
      owner.id,
    );

    const count = await notifyMembershipDecision(
      "approved",
      applicant.id,
      { slug: group.slug, name: group.name },
      { id: owner.id, name: "Owner Name" },
    );
    expect(count).toBe(1);

    const rows = await db.notification.findMany({ where: { userId: applicant.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe(MEMBERSHIP_APPROVED);
    const payload = JSON.parse(rows[0]!.payload);
    expect(payload.groupSlug).toBe(group.slug);
    expect(payload.groupName).toBe(group.name);
    expect(payload.actorName).toBe("Owner Name");
  });

  it("notifies the target user on rejection", async () => {
    const owner = await makeUser("mdrOwner");
    const applicant = await makeUser("mdrApplicant");
    const group = await createGroup(
      { name: "MDR", slug: uniq("mdr"), autoApprove: false },
      owner.id,
    );

    const count = await notifyMembershipDecision(
      "rejected",
      applicant.id,
      { slug: group.slug, name: group.name },
      { id: owner.id, name: null },
    );
    expect(count).toBe(1);

    const rows = await db.notification.findMany({ where: { userId: applicant.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe(MEMBERSHIP_REJECTED);
    const payload = JSON.parse(rows[0]!.payload);
    expect(payload.actorName).toBeNull();
  });

  it("returns 0 when the actor is the target", async () => {
    const u = await makeUser("mdSelf");
    const count = await notifyMembershipDecision(
      "approved",
      u.id,
      { slug: "g", name: "G" },
      { id: u.id, name: "Self" },
    );
    expect(count).toBe(0);
    const rows = await db.notification.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(0);
  });
});

describe("listForUser membership pass-through", () => {
  it("returns membership notifications even though their payload has no questionId", async () => {
    const u = await makeUser("memPass");
    await db.notification.create({
      data: {
        userId: u.id,
        type: MEMBERSHIP_APPROVED,
        payload: JSON.stringify({
          groupSlug: "g",
          groupName: "G",
          actorName: "Mod",
        }),
      },
    });
    await db.notification.create({
      data: {
        userId: u.id,
        type: MEMBERSHIP_REJECTED,
        payload: JSON.stringify({
          groupSlug: "g2",
          groupName: "G2",
          actorName: null,
        }),
      },
    });

    const result = await listForUser(u.id);
    expect(result.items).toHaveLength(2);
    const types = result.items.map((i) => i.type).sort();
    expect(types).toEqual([MEMBERSHIP_APPROVED, MEMBERSHIP_REJECTED].sort());
  });
});
