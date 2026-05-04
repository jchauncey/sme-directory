/**
 * GET /api/search route handler tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-search-test-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.AUTH_SECRET = "0".repeat(32) + "abcdef0123456789abcdef0123456789";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { db } = await import("@/lib/db");
const { createGroup } = await import("@/lib/groups");
const { createQuestion } = await import("@/lib/questions");
const { GET } = await import("./route");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../../../..");
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

function getReq(qs: string): Request {
  return new Request(`http://x/api/search${qs}`, { method: "GET" });
}

describe("GET /api/search", () => {
  it("returns 400 when q is missing", async () => {
    const res = await GET(getReq("?scope=all"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when q is empty", async () => {
    const res = await GET(getReq("?q="));
    expect(res.status).toBe(400);
  });

  it("returns 400 when scope=current without groupIds", async () => {
    const res = await GET(getReq("?q=foo&scope=current"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when scope=current has multiple groupIds", async () => {
    const res = await GET(getReq("?q=foo&scope=current&groupIds=a,b"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when per is out of range", async () => {
    const res = await GET(getReq("?q=foo&per=999"));
    expect(res.status).toBe(400);
  });

  it("returns 200 with empty items + zero total when there are no matches", async () => {
    const res = await GET(getReq("?q=zzzunlikelytokenzzz"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
    expect(json.total).toBe(0);
    expect(json.page).toBe(1);
    expect(json.per).toBe(20);
  });

  it("returns 200 with question + answer hits matching the query", async () => {
    const author = await makeUser("rh");
    const group = await createGroup(
      { name: "RH", slug: uniq("rh"), autoApprove: true },
      author.id,
    );
    const q = await createQuestion(
      { title: "Best ergonomic keyboard tray for posture", body: "discussion of trays" },
      group.id,
      author.id,
    );
    await db.answer.create({
      data: {
        questionId: q.id,
        authorId: author.id,
        body: "I use the GreatCo ergonomic keyboard daily.",
      },
    });

    const res = await GET(getReq("?q=ergonomic&scope=all&per=10"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBeGreaterThanOrEqual(2);
    const types = new Set(json.items.map((i: { type: string }) => i.type));
    expect(types.has("question")).toBe(true);
    expect(types.has("answer")).toBe(true);
    for (const item of json.items) {
      expect(item.group).toMatchObject({ id: expect.any(String), slug: expect.any(String) });
      expect(item.author).toMatchObject({ id: expect.any(String) });
    }
  });

  it("filters by group when scope=selected", async () => {
    const author = await makeUser("scope");
    const groupA = await createGroup(
      { name: "SA", slug: uniq("sa"), autoApprove: true },
      author.id,
    );
    const groupB = await createGroup(
      { name: "SB", slug: uniq("sb"), autoApprove: true },
      author.id,
    );
    await createQuestion(
      { title: "Echidna habitat in group A", body: "x" },
      groupA.id,
      author.id,
    );
    await createQuestion(
      { title: "Echidna habitat in group B", body: "y" },
      groupB.id,
      author.id,
    );

    const res = await GET(
      getReq(`?q=echidna&scope=selected&groupIds=${encodeURIComponent(groupA.id)}`),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items.length).toBeGreaterThanOrEqual(1);
    for (const item of json.items) {
      expect(item.group.id).toBe(groupA.id);
    }
  });

  it("respects page and per for pagination", async () => {
    const author = await makeUser("pg");
    const group = await createGroup(
      { name: "PG", slug: uniq("pg"), autoApprove: true },
      author.id,
    );
    await createQuestion(
      { title: "Platypus fact one", body: "monotreme" },
      group.id,
      author.id,
    );
    await new Promise((r) => setTimeout(r, 5));
    await createQuestion(
      { title: "Platypus fact two", body: "monotreme" },
      group.id,
      author.id,
    );

    const res1 = await GET(
      getReq(
        `?q=platypus&scope=selected&groupIds=${encodeURIComponent(group.id)}&page=1&per=1`,
      ),
    );
    const json1 = await res1.json();
    expect(json1.items).toHaveLength(1);
    expect(json1.total).toBeGreaterThanOrEqual(2);

    const res2 = await GET(
      getReq(
        `?q=platypus&scope=selected&groupIds=${encodeURIComponent(group.id)}&page=2&per=1`,
      ),
    );
    const json2 = await res2.json();
    expect(json2.items).toHaveLength(1);
    expect(json2.items[0].questionId).not.toBe(json1.items[0].questionId);
  });
});
