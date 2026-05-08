/**
 * POST /api/groups route handler tests.
 *
 * Mocks next/headers cookies (auth) and runs the handler against a real
 * throw-away SQLite DB. Mirrors the auth.test.ts pattern.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "@test/db";
import { clearSession } from "@test/auth-mock";

vi.mock("next/headers", async () => (await import("@test/auth-mock")).nextHeadersMock());
vi.mock("next/navigation", async () => (await import("@test/auth-mock")).nextNavigationMock());

setupTestDb("api-groups");

const auth = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { POST } = await import("./route");

beforeEach(() => {
  clearSession();
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/groups", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(makeRequest({ name: "X", slug: "xx" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid body (missing name)", async () => {
    await auth.signIn(`u-${Date.now()}@example.com`);
    const res = await POST(makeRequest({ slug: "valid-slug" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("ValidationError");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("returns 400 on invalid slug format", async () => {
    await auth.signIn(`u2-${Date.now()}@example.com`);
    const res = await POST(makeRequest({ name: "OK Name", slug: "Bad Slug!" }));
    expect(res.status).toBe(400);
  });

  it("returns 201 with the created group on success", async () => {
    const email = `creator-${Date.now()}@example.com`;
    await auth.signIn(email);
    const slug = `created-${Date.now()}`;
    const res = await POST(makeRequest({ name: "Created", slug, autoApprove: true }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.group.slug).toBe(slug);
    expect(json.group.autoApprove).toBe(true);
    const owner = await db.user.findUnique({ where: { email } });
    expect(json.group.createdById).toBe(owner!.id);
    const m = await db.membership.findUnique({
      where: { userId_groupId: { userId: owner!.id, groupId: json.group.id } },
    });
    expect(m!.role).toBe("owner");
    expect(m!.status).toBe("approved");
  });

  it("returns 409 SlugConflict when slug is taken", async () => {
    await auth.signIn(`uA-${Date.now()}@example.com`);
    const slug = `dup-${Date.now()}`;
    const first = await POST(makeRequest({ name: "First", slug }));
    expect(first.status).toBe(201);
    const second = await POST(makeRequest({ name: "Second", slug }));
    expect(second.status).toBe(409);
    const json = await second.json();
    expect(json.error).toBe("SlugConflict");
    expect(json.field).toBe("slug");
  });

  it("returns 400 InvalidJson when body is not JSON", async () => {
    await auth.signIn(`uJ-${Date.now()}@example.com`);
    const req = new Request("http://localhost/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("InvalidJson");
  });
});
