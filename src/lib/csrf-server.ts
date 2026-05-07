import "server-only";
import { cookies } from "next/headers";
import { CSRF_COOKIE, CSRF_FIELD, verifyCsrfToken } from "@/lib/csrf";

export class CsrfError extends Error {
  constructor(message = "Invalid or missing CSRF token.") {
    super(message);
    this.name = "CsrfError";
  }
}

export async function getCsrfToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? null;
}

export async function clearCsrfCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CSRF_COOKIE);
}

export async function assertCsrf(formData: FormData): Promise<void> {
  const provided = formData.get(CSRF_FIELD);
  await assertCsrfToken(typeof provided === "string" ? provided : null);
}

export async function assertCsrfToken(token: string | null | undefined): Promise<void> {
  const expected = await getCsrfToken();
  if (!verifyCsrfToken(token ?? null, expected)) {
    throw new CsrfError();
  }
}
