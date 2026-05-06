import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-notif-prefs-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { createGroup } = await import("./groups");
const { applyToGroup, AuthorizationError, NotFoundError } = await import("./memberships");
const {
  categoryFor,
  filterMuted,
  getPreferenceForGroup,
  listPreferencesForUser,
  setPreferenceForGroup,
} = await import("./notification-preferences");

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
async function approve(userId: string, groupId: string) {
  await applyToGroup(groupId, userId);
  await db.membership.update({
    where: { userId_groupId: { userId, groupId } },
    data: { status: "approved" },
  });
}

describe("categoryFor", () => {
  it("maps known prefixes", () => {
    expect(categoryFor("question.created")).toBe("question");
    expect(categoryFor("answer.posted")).toBe("answer");
    expect(categoryFor("membership.approved")).toBe("membership");
  });
  it("returns null for unknown types", () => {
    expect(categoryFor("totally.weird")).toBeNull();
    expect(categoryFor("")).toBeNull();
  });
});

describe("setPreferenceForGroup / getPreferenceForGroup", () => {
  it("upserts preferences and returns the normalized list", async () => {
    const owner = await makeUser("po");
    const g = await createGroup({ name: "P", slug: uniq("p"), autoApprove: true }, owner.id);

    const stored = await setPreferenceForGroup(owner.id, g.id, ["question", "membership"]);
    expect(stored).toEqual(["question", "membership"]);
    expect(await getPreferenceForGroup(owner.id, g.id)).toEqual(["question", "membership"]);

    // Update — replaces
    const updated = await setPreferenceForGroup(owner.id, g.id, ["answer"]);
    expect(updated).toEqual(["answer"]);
    expect(await getPreferenceForGroup(owner.id, g.id)).toEqual(["answer"]);
  });

  it("rejects unknown categories silently and dedupes", async () => {
    const u = await makeUser("pu");
    const g = await createGroup({ name: "P", slug: uniq("p"), autoApprove: true }, u.id);
    const stored = await setPreferenceForGroup(u.id, g.id, [
      "question",
      "question",
      "totally-bogus",
    ]);
    expect(stored).toEqual(["question"]);
  });

  it("throws AuthorizationError when caller is not an approved member", async () => {
    const owner = await makeUser("ao");
    const stranger = await makeUser("st");
    const g = await createGroup({ name: "G", slug: uniq("auth"), autoApprove: false }, owner.id);
    await expect(
      setPreferenceForGroup(stranger.id, g.id, ["question"]),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("throws AuthorizationError for pending applicants", async () => {
    const owner = await makeUser("po2");
    const pending = await makeUser("pp");
    const g = await createGroup({ name: "G", slug: uniq("auth2"), autoApprove: false }, owner.id);
    await applyToGroup(g.id, pending.id);
    await expect(
      setPreferenceForGroup(pending.id, g.id, ["question"]),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("throws NotFoundError for unknown group", async () => {
    const u = await makeUser("nf");
    await expect(
      setPreferenceForGroup(u.id, "does-not-exist", ["question"]),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns [] for users with no row", async () => {
    const u = await makeUser("nopref");
    const owner = await makeUser("nopref-o");
    const g = await createGroup({ name: "G", slug: uniq("nop"), autoApprove: true }, owner.id);
    expect(await getPreferenceForGroup(u.id, g.id)).toEqual([]);
  });
});

describe("listPreferencesForUser", () => {
  it("returns all preferences with group metadata", async () => {
    const u = await makeUser("lu");
    const g1 = await createGroup({ name: "L1", slug: uniq("l1"), autoApprove: true }, u.id);
    const g2 = await createGroup({ name: "L2", slug: uniq("l2"), autoApprove: true }, u.id);
    await setPreferenceForGroup(u.id, g1.id, ["question"]);
    await setPreferenceForGroup(u.id, g2.id, ["answer", "membership"]);

    const list = await listPreferencesForUser(u.id);
    expect(list).toHaveLength(2);
    const byId = new Map(list.map((p) => [p.groupId, p]));
    expect(byId.get(g1.id)?.mutedTypes).toEqual(["question"]);
    expect(byId.get(g2.id)?.mutedTypes).toEqual(["answer", "membership"]);
    expect(byId.get(g1.id)?.groupName).toBe("L1");
  });
});

describe("filterMuted", () => {
  it("excludes users who muted the given category for the given group", async () => {
    const owner = await makeUser("fmo");
    const g = await createGroup({ name: "F", slug: uniq("f"), autoApprove: true }, owner.id);
    const a = await makeUser("fmA");
    const b = await makeUser("fmB");
    const c = await makeUser("fmC");
    await approve(a.id, g.id);
    await approve(b.id, g.id);
    await approve(c.id, g.id);
    await setPreferenceForGroup(a.id, g.id, ["question"]);
    await setPreferenceForGroup(b.id, g.id, ["answer"]); // muted other category, should pass

    const result = await filterMuted([a.id, b.id, c.id], g.id, "question");
    expect(result).toEqual([b.id, c.id]);
  });

  it("returns input unchanged when no users have prefs", async () => {
    const owner = await makeUser("fme");
    const g = await createGroup({ name: "E", slug: uniq("e"), autoApprove: true }, owner.id);
    const a = await makeUser("a2");
    const b = await makeUser("b2");
    await approve(a.id, g.id);
    await approve(b.id, g.id);
    expect(await filterMuted([a.id, b.id], g.id, "question")).toEqual([a.id, b.id]);
  });

  it("returns [] for empty input without DB query", async () => {
    expect(await filterMuted([], "some-group", "question")).toEqual([]);
  });

  it("ignores prefs scoped to a different group", async () => {
    const owner = await makeUser("fxo");
    const g1 = await createGroup({ name: "X1", slug: uniq("x1"), autoApprove: true }, owner.id);
    const g2 = await createGroup({ name: "X2", slug: uniq("x2"), autoApprove: true }, owner.id);
    const a = await makeUser("xa");
    await approve(a.id, g1.id);
    await approve(a.id, g2.id);
    await setPreferenceForGroup(a.id, g2.id, ["question"]); // muted in g2, not g1

    expect(await filterMuted([a.id], g1.id, "question")).toEqual([a.id]);
    expect(await filterMuted([a.id], g2.id, "question")).toEqual([]);
  });
});
