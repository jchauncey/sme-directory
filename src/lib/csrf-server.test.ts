/**
 * Tests for the server-side CSRF helpers used by Server Actions.
 *
 * Stubs `next/headers` cookies() with an in-memory Map (same shape used by
 * auth.test.ts) so we can exercise assertCsrf / assertCsrfToken without
 * spinning up Next.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CSRF_COOKIE, CSRF_FIELD, generateCsrfToken } from "./csrf";

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

const csrfServer = await import("./csrf-server");

beforeEach(() => {
  cookieStore.clear();
});

describe("assertCsrf (form-driven)", () => {
  it("throws CsrfError when the cookie is missing", async () => {
    const fd = new FormData();
    fd.set(CSRF_FIELD, generateCsrfToken());
    await expect(csrfServer.assertCsrf(fd)).rejects.toBeInstanceOf(csrfServer.CsrfError);
  });

  it("throws CsrfError when the form field is missing", async () => {
    const token = generateCsrfToken();
    cookieStore.set(CSRF_COOKIE, { name: CSRF_COOKIE, value: token });
    const fd = new FormData();
    await expect(csrfServer.assertCsrf(fd)).rejects.toBeInstanceOf(csrfServer.CsrfError);
  });

  it("throws CsrfError when the field does not match the cookie", async () => {
    cookieStore.set(CSRF_COOKIE, { name: CSRF_COOKIE, value: generateCsrfToken() });
    const fd = new FormData();
    fd.set(CSRF_FIELD, generateCsrfToken());
    await expect(csrfServer.assertCsrf(fd)).rejects.toBeInstanceOf(csrfServer.CsrfError);
  });

  it("resolves when the field matches the cookie", async () => {
    const token = generateCsrfToken();
    cookieStore.set(CSRF_COOKIE, { name: CSRF_COOKIE, value: token });
    const fd = new FormData();
    fd.set(CSRF_FIELD, token);
    await expect(csrfServer.assertCsrf(fd)).resolves.toBeUndefined();
  });
});

describe("assertCsrfToken (programmatic)", () => {
  it("throws when the provided token is null/empty", async () => {
    cookieStore.set(CSRF_COOKIE, { name: CSRF_COOKIE, value: generateCsrfToken() });
    await expect(csrfServer.assertCsrfToken(null)).rejects.toBeInstanceOf(csrfServer.CsrfError);
    await expect(csrfServer.assertCsrfToken("")).rejects.toBeInstanceOf(csrfServer.CsrfError);
  });

  it("throws when the provided token does not match the cookie", async () => {
    cookieStore.set(CSRF_COOKIE, { name: CSRF_COOKIE, value: generateCsrfToken() });
    await expect(csrfServer.assertCsrfToken(generateCsrfToken())).rejects.toBeInstanceOf(
      csrfServer.CsrfError,
    );
  });

  it("resolves when the provided token matches the cookie", async () => {
    const token = generateCsrfToken();
    cookieStore.set(CSRF_COOKIE, { name: CSRF_COOKIE, value: token });
    await expect(csrfServer.assertCsrfToken(token)).resolves.toBeUndefined();
  });
});
