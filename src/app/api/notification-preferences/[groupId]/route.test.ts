import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-api-notif-prefs-test-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.AUTH_SECRET = "0".repeat(32) + "abcdef0123456789abcdef0123456789";

type Cookie = { name: string; value: string };
const cookieStore = new Map<string, Cookie>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, { name, value });
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const auth = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { createGroup } = await import("@/lib/groups");
const { applyToGroup } = await import("@/lib/memberships");
const { GET, PUT } = await import("./route");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../../../../..");
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

beforeEach(() => {
  cookieStore.clear();
});

let counter = 0;
function uniqEmail() {
  counter += 1;
  return `prefs-${Date.now()}-${counter}@example.com`;
}

function ctx(groupId: string) {
  return { params: Promise.resolve({ groupId }) };
}

describe("PUT /api/notification-preferences/[groupId]", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await PUT(
      new Request("http://localhost/api/notification-preferences/x", {
        method: "PUT",
        body: JSON.stringify({ mutedTypes: ["question"] }),
      }),
      ctx("x"),
    );
    expect(res.status).toBe(401);
  });

  it("upserts preferences for an approved member", async () => {
    await auth.signIn(uniqEmail());
    const sess = (await auth.getSession())!;
    const group = await createGroup(
      { name: "G", slug: `g-${Date.now()}-${counter++}`, autoApprove: true },
      sess.user.id,
    );

    const res = await PUT(
      new Request(`http://localhost/api/notification-preferences/${group.id}`, {
        method: "PUT",
        body: JSON.stringify({ mutedTypes: ["question", "answer"] }),
      }),
      ctx(group.id),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.groupId).toBe(group.id);
    expect(json.mutedTypes).toEqual(["question", "answer"]);

    const stored = await db.notificationPreference.findUnique({
      where: { userId_groupId: { userId: sess.user.id, groupId: group.id } },
    });
    expect(stored).not.toBeNull();
  });

  it("returns 403 when caller is not an approved member", async () => {
    // Owner creates group; stranger tries to set prefs.
    await auth.signIn(uniqEmail());
    const ownerSess = (await auth.getSession())!;
    const group = await createGroup(
      { name: "G", slug: `gs-${Date.now()}-${counter++}`, autoApprove: false },
      ownerSess.user.id,
    );

    cookieStore.clear();
    await auth.signIn(uniqEmail());

    const res = await PUT(
      new Request(`http://localhost/api/notification-preferences/${group.id}`, {
        method: "PUT",
        body: JSON.stringify({ mutedTypes: ["question"] }),
      }),
      ctx(group.id),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for pending applicants", async () => {
    await auth.signIn(uniqEmail());
    const ownerSess = (await auth.getSession())!;
    const group = await createGroup(
      { name: "G", slug: `gp-${Date.now()}-${counter++}`, autoApprove: false },
      ownerSess.user.id,
    );

    cookieStore.clear();
    await auth.signIn(uniqEmail());
    const applicant = (await auth.getSession())!;
    await applyToGroup(group.id, applicant.user.id);

    const res = await PUT(
      new Request(`http://localhost/api/notification-preferences/${group.id}`, {
        method: "PUT",
        body: JSON.stringify({ mutedTypes: ["question"] }),
      }),
      ctx(group.id),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    await auth.signIn(uniqEmail());
    const sess = (await auth.getSession())!;
    const group = await createGroup(
      { name: "G", slug: `gv-${Date.now()}-${counter++}`, autoApprove: true },
      sess.user.id,
    );
    const res = await PUT(
      new Request(`http://localhost/api/notification-preferences/${group.id}`, {
        method: "PUT",
        body: JSON.stringify({ mutedTypes: ["bogus"] }),
      }),
      ctx(group.id),
    );
    expect(res.status).toBe(400);
  });

  it("GET returns the current preference for the user", async () => {
    await auth.signIn(uniqEmail());
    const sess = (await auth.getSession())!;
    const group = await createGroup(
      { name: "G", slug: `gg-${Date.now()}-${counter++}`, autoApprove: true },
      sess.user.id,
    );
    await PUT(
      new Request(`http://localhost/api/notification-preferences/${group.id}`, {
        method: "PUT",
        body: JSON.stringify({ mutedTypes: ["membership"] }),
      }),
      ctx(group.id),
    );
    const res = await GET(
      new Request(`http://localhost/api/notification-preferences/${group.id}`),
      ctx(group.id),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mutedTypes).toEqual(["membership"]);
  });
});
