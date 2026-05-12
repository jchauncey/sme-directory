import { beforeEach, describe, expect, it } from "vitest";
import { RateLimitError, __resetStoreForTests, assertRateLimit, consume } from "./index";
import { LIMITS, groupForApiPath } from "./config";

beforeEach(async () => {
  await __resetStoreForTests();
});

describe("assertRateLimit", () => {
  it("allows N calls up to capacity, then throws RateLimitError with retryAfterMs >= 1", async () => {
    const capacity = LIMITS.signIn.capacity;
    for (let i = 0; i < capacity; i += 1) {
      await expect(assertRateLimit({ group: "signIn", ip: "1.2.3.4" })).resolves.toBeUndefined();
    }

    let caught: unknown;
    try {
      await assertRateLimit({ group: "signIn", ip: "1.2.3.4" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).retryAfterMs).toBeGreaterThanOrEqual(1);
  });

  it("isolates ip-scoped buckets per ip", async () => {
    for (let i = 0; i < LIMITS.signIn.capacity; i += 1) {
      await assertRateLimit({ group: "signIn", ip: "1.1.1.1" });
    }
    await expect(assertRateLimit({ group: "signIn", ip: "1.1.1.1" })).rejects.toBeInstanceOf(
      RateLimitError,
    );

    // Different IP — fresh bucket.
    await expect(assertRateLimit({ group: "signIn", ip: "2.2.2.2" })).resolves.toBeUndefined();
  });

  it("isolates user-scoped buckets per userId", async () => {
    for (let i = 0; i < LIMITS.votes.capacity; i += 1) {
      await assertRateLimit({ group: "votes", userId: "u1", ip: "1.1.1.1" });
    }
    await expect(
      assertRateLimit({ group: "votes", userId: "u1", ip: "1.1.1.1" }),
    ).rejects.toBeInstanceOf(RateLimitError);

    await expect(
      assertRateLimit({ group: "votes", userId: "u2", ip: "1.1.1.1" }),
    ).resolves.toBeUndefined();
  });

  it("falls back to ip when user-scope group has no userId", async () => {
    for (let i = 0; i < LIMITS.votes.capacity; i += 1) {
      await assertRateLimit({ group: "votes", userId: null, ip: "9.9.9.9" });
    }
    await expect(
      assertRateLimit({ group: "votes", userId: null, ip: "9.9.9.9" }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe("consume", () => {
  it("returns allowed=false with positive retryAfterMs once over the limit", async () => {
    const capacity = LIMITS.questions.capacity;
    for (let i = 0; i < capacity; i += 1) {
      const r = await consume("k", "questions");
      expect(r.allowed).toBe(true);
    }
    const blocked = await consume("k", "questions");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(1);
  });
});

describe("groupForApiPath — default coverage", () => {
  it("returns null for non-/api/ paths", () => {
    expect(groupForApiPath("/")).toBeNull();
    expect(groupForApiPath("/groups/foo")).toBeNull();
  });

  it("returns a specific group for known /api/ paths", () => {
    expect(groupForApiPath("/api/votes")).toBe("votes");
    expect(groupForApiPath("/api/favorites")).toBe("favorites");
    expect(groupForApiPath("/api/questions/123")).toBe("questions");
  });

  it("returns 'default' for previously-unmatched mutating /api/* paths", () => {
    // These are the routes identified in the security review as having no group.
    expect(groupForApiPath("/api/groups")).toBe("default");
    expect(groupForApiPath("/api/groups/my-group")).toBe("default");
    expect(groupForApiPath("/api/groups/my-group/unarchive")).toBe("default");
    expect(groupForApiPath("/api/groups/my-group/avatar")).toBe("default");
    expect(groupForApiPath("/api/me")).toBe("default");
    expect(groupForApiPath("/api/notification-preferences/group-1")).toBe("default");
    expect(groupForApiPath("/api/notifications/42/read")).toBe("default");
    expect(groupForApiPath("/api/notifications/read-all")).toBe("default");
    expect(groupForApiPath("/api/users/me/avatar")).toBe("default");
  });

  it("'default' group is present in LIMITS with a user-scoped config", () => {
    const limit = LIMITS["default"];
    expect(limit).toBeDefined();
    expect(limit.scope).toBe("user");
    expect(limit.capacity).toBeGreaterThan(0);
  });
});
