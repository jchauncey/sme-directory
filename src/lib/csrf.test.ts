/**
 * Pure-helpers test for the CSRF library.
 *
 * Exercises:
 *   - generateCsrfToken: shape (lowercase hex, 64 chars)
 *   - isValidTokenShape: rejects junk
 *   - verifyCsrfToken: constant-time compare semantics
 *   - csrfRequiresCheck: gates POST/PATCH/PUT/DELETE under /api/* only
 */
import { describe, expect, it } from "vitest";
import { csrfRequiresCheck, generateCsrfToken, isValidTokenShape, verifyCsrfToken } from "./csrf";

describe("generateCsrfToken", () => {
  it("returns a 64-char lowercase hex string", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns distinct values across calls", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

describe("isValidTokenShape", () => {
  it.each([
    [null, false],
    [undefined, false],
    ["", false],
    ["not-hex-but-long-enough-to-fool-a-naive-length-check-aaaaaaaaaaaaa", false],
    ["A".repeat(64), false], // uppercase hex is rejected
    ["0".repeat(63), false],
    ["0".repeat(65), false],
    ["0".repeat(64), true],
    ["abcdef" + "0".repeat(58), true],
  ])("isValidTokenShape(%p) === %p", (input, expected) => {
    expect(isValidTokenShape(input)).toBe(expected);
  });
});

describe("verifyCsrfToken", () => {
  const valid = "a".repeat(64);

  it("returns false when either token is missing", () => {
    expect(verifyCsrfToken(null, valid)).toBe(false);
    expect(verifyCsrfToken(valid, null)).toBe(false);
    expect(verifyCsrfToken(null, null)).toBe(false);
  });

  it("returns false when shapes are invalid", () => {
    expect(verifyCsrfToken("short", "short")).toBe(false);
    expect(verifyCsrfToken(valid, "X".repeat(64))).toBe(false);
  });

  it("returns false when tokens differ", () => {
    expect(verifyCsrfToken(valid, "b".repeat(64))).toBe(false);
  });

  it("returns true when tokens match exactly", () => {
    expect(verifyCsrfToken(valid, valid)).toBe(true);
  });
});

describe("csrfRequiresCheck", () => {
  it.each([
    ["GET", "/api/foo", false],
    ["HEAD", "/api/foo", false],
    ["OPTIONS", "/api/foo", false],
    ["POST", "/", false],
    ["POST", "/me", false],
    ["POST", "/api", true],
    ["POST", "/api/foo", true],
    ["PATCH", "/api/foo/bar", true],
    ["PUT", "/api/notification-preferences/abc", true],
    ["DELETE", "/api/groups/x/membership/y", true],
    ["post", "/api/foo", true], // case-insensitive method
  ])("csrfRequiresCheck(%p, %p) === %p", (method, path, expected) => {
    expect(csrfRequiresCheck(method, path)).toBe(expected);
  });
});
