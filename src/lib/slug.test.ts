import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, SLUG_MAX_LENGTH } from "./slug";

describe("slugify", () => {
  it("passes through simple ASCII", () => {
    expect(slugify("kubernetes")).toBe("kubernetes");
  });

  it("lowercases", () => {
    expect(slugify("Kubernetes")).toBe("kubernetes");
  });

  it("replaces spaces with dashes", () => {
    expect(slugify("My Test Group")).toBe("my-test-group");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Münchner")).toBe("cafe-munchner");
  });

  it("replaces punctuation with dashes", () => {
    expect(slugify("foo.bar/baz!qux")).toBe("foo-bar-baz-qux");
  });

  it("collapses runs of dashes into one", () => {
    expect(slugify("foo   ---   bar")).toBe("foo-bar");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("returns empty string when nothing slug-worthy remains", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("truncates to max length and trims trailing dash if truncation lands on one", () => {
    const long = "a".repeat(80);
    expect(slugify(long).length).toBe(SLUG_MAX_LENGTH);
    const tail = `${"abc".repeat(20)}-tail`;
    const out = slugify(tail);
    expect(out.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(out.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("accepts well-formed slugs", () => {
    expect(isValidSlug("k8s")).toBe(true);
    expect(isValidSlug("my-test-group")).toBe(true);
    expect(isValidSlug("a1")).toBe(true);
  });

  it("rejects too-short slugs", () => {
    expect(isValidSlug("a")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });

  it("rejects uppercase, spaces, and disallowed characters", () => {
    expect(isValidSlug("Hello")).toBe(false);
    expect(isValidSlug("hello world")).toBe(false);
    expect(isValidSlug("foo_bar")).toBe(false);
    expect(isValidSlug("foo!")).toBe(false);
  });

  it("rejects leading/trailing/consecutive dashes", () => {
    expect(isValidSlug("-foo")).toBe(false);
    expect(isValidSlug("foo-")).toBe(false);
    expect(isValidSlug("foo--bar")).toBe(false);
  });

  it("rejects too-long slugs", () => {
    expect(isValidSlug("a".repeat(SLUG_MAX_LENGTH + 1))).toBe(false);
  });
});
