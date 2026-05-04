import { describe, expect, it } from "vitest";

import { applyGroupSlugDefault } from "./normalize";

describe("applyGroupSlugDefault", () => {
  it("defaults scope to 'current' when entering with a resolved groupSlug and no scope/groupIds", () => {
    const out = applyGroupSlugDefault(undefined, undefined, "g_123", "engineering");
    expect(out).toEqual({
      scope: "current",
      groupIds: ["g_123"],
      groupSlugForUrl: "engineering",
    });
  });

  it("ignores groupSlug default when scope is set explicitly", () => {
    const out = applyGroupSlugDefault("all", undefined, "g_123", "engineering");
    expect(out.scope).toBe("all");
    expect(out.groupIds).toEqual([]);
    expect(out.groupSlugForUrl).toBeNull();
  });

  it("ignores groupSlug default when groupIds is set explicitly", () => {
    const out = applyGroupSlugDefault(undefined, "g_other", "g_123", "engineering");
    expect(out.scope).toBe("all");
    expect(out.groupIds).toEqual(["g_other"]);
    expect(out.groupSlugForUrl).toBeNull();
  });

  it("falls back to 'all' when no slug context and no scope provided", () => {
    const out = applyGroupSlugDefault(undefined, undefined, null, undefined);
    expect(out).toEqual({ scope: "all", groupIds: [], groupSlugForUrl: null });
  });

  it("does not apply slug default when slug provided but unresolved (non-existent group)", () => {
    const out = applyGroupSlugDefault(undefined, undefined, null, "ghost-slug");
    expect(out.scope).toBe("all");
    expect(out.groupIds).toEqual([]);
    expect(out.groupSlugForUrl).toBeNull();
  });

  it("parses csv groupIds when scope=selected", () => {
    const out = applyGroupSlugDefault("selected", "a,b,c", null, undefined);
    expect(out.scope).toBe("selected");
    expect(out.groupIds).toEqual(["a", "b", "c"]);
  });

  it("treats unknown scope strings as 'all'", () => {
    const out = applyGroupSlugDefault("bogus", undefined, null, undefined);
    expect(out.scope).toBe("all");
  });

  it("trims whitespace and drops empty entries from csv groupIds", () => {
    const out = applyGroupSlugDefault("selected", " a , ,b ", null, undefined);
    expect(out.groupIds).toEqual(["a", "b"]);
  });
});
