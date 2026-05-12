import type { User } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "@test/db";
import { clearSession, cookieStore, setSessionUser } from "@test/auth-mock";
import { makeGroup, makeUser } from "@test/factories";

async function signInAs(u: User): Promise<void> {
  // Factory-created users always have an email; assert for the type system.
  await setSessionUser({ id: u.id, email: u.email!, name: u.name });
}

vi.mock("next/headers", async () => (await import("@test/auth-mock")).nextHeadersMock());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

setupTestDb("settings-actions");

const { db } = await import("@/lib/db");
const { CSRF_COOKIE, CSRF_FIELD } = await import("@/lib/csrf");
const { updateGroupDetailsAction } = await import("./actions");

const VALID_TOKEN = "a".repeat(64);

function makeFormData(fields: Record<string, string>, withCsrf = true): FormData {
  const fd = new FormData();
  if (withCsrf) fd.set(CSRF_FIELD, VALID_TOKEN);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function setCsrfCookie(value = VALID_TOKEN): void {
  cookieStore.set(CSRF_COOKIE, { name: CSRF_COOKIE, value });
}

beforeEach(() => {
  clearSession();
});

describe("updateGroupDetailsAction", () => {
  it("returns CSRF error when token is missing", async () => {
    const { owner, group } = await makeGroup(db);
    await signInAs(owner);
    // No CSRF cookie set, no field either.
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({ slug: group.slug, name: "New name", description: "" }, false),
    );
    expect(result.error).toMatch(/csrf/i);
  });

  it("returns sign-in error when unauthenticated", async () => {
    const { group } = await makeGroup(db);
    setCsrfCookie();
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({ slug: group.slug, name: "New name", description: "" }),
    );
    expect(result.error).toMatch(/signed in/i);
  });

  it("returns field errors when name is too short", async () => {
    const { owner, group } = await makeGroup(db);
    await signInAs(owner);
    setCsrfCookie();
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({ slug: group.slug, name: "x", description: "" }),
    );
    expect(result.fieldErrors?.[0]?.path).toBe("name");
    expect(result.values?.name).toBe("x");
  });

  it("rejects a whitespace-only name (trimmed to empty)", async () => {
    const { owner, group } = await makeGroup(db);
    await signInAs(owner);
    setCsrfCookie();
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({ slug: group.slug, name: "   ", description: "" }),
    );
    expect(result.fieldErrors?.[0]?.path).toBe("name");
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.name).toBe(group.name);
  });

  it("forbids non-owner moderator from editing details", async () => {
    const { group } = await makeGroup(db);
    const mod = await makeUser(db);
    await db.membership.create({
      data: { groupId: group.id, userId: mod.id, role: "moderator", status: "approved" },
    });
    await signInAs(mod);
    setCsrfCookie();
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({ slug: group.slug, name: "Hijack", description: "" }),
    );
    expect(result.error).toMatch(/owner/i);
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.name).toBe(group.name);
  });

  it("returns conflict when group is archived", async () => {
    const { owner, group } = await makeGroup(db);
    await db.group.update({
      where: { id: group.id },
      data: { archivedAt: new Date() },
    });
    await signInAs(owner);
    setCsrfCookie();
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({ slug: group.slug, name: "Renamed", description: "" }),
    );
    expect(result.error).toMatch(/archived/i);
  });

  it("updates name and description on the happy path", async () => {
    const { owner, group } = await makeGroup(db, { name: "Old name" });
    await signInAs(owner);
    setCsrfCookie();
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({
        slug: group.slug,
        name: "New name",
        description: "Now with a description.",
      }),
    );
    expect(result.ok).toBe(true);
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.name).toBe("New name");
    expect(fresh?.description).toBe("Now with a description.");
  });

  it("clears description when submitted empty", async () => {
    const { owner, group } = await makeGroup(db);
    await db.group.update({
      where: { id: group.id },
      data: { description: "Existing." },
    });
    await signInAs(owner);
    setCsrfCookie();
    const result = await updateGroupDetailsAction(
      {},
      makeFormData({ slug: group.slug, name: group.name, description: "" }),
    );
    expect(result.ok).toBe(true);
    const fresh = await db.group.findUnique({ where: { id: group.id } });
    expect(fresh?.description).toBeNull();
  });
});
