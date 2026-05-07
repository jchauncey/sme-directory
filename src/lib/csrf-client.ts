"use client";

import { CSRF_COOKIE, CSRF_FIELD, CSRF_HEADER } from "@/lib/csrf";

export { CSRF_FIELD, CSRF_HEADER };

export function readCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(?:^|; )" + CSRF_COOKIE + "=([^;]+)"));
  return match ? decodeURIComponent(match[1]!) : "";
}

export function csrfHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set(CSRF_HEADER, readCsrfToken());
  return headers;
}

export function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, headers: csrfHeaders(init.headers) });
}
