"use client";

import { useEffect, useState } from "react";
import { CSRF_FIELD, readCsrfToken } from "@/lib/csrf-client";

/**
 * Hidden form field that carries the double-submit CSRF token.
 *
 * Reads the `sme_csrf` cookie on mount (the cookie is non-httpOnly so the
 * client can echo it back). Server-rendered HTML emits an empty value to
 * avoid a hydration mismatch — by the time a user can submit, the effect has
 * populated the real token.
 */
export function CsrfField(): React.ReactElement {
  const [token, setToken] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(readCsrfToken());
  }, []);
  return <input type="hidden" name={CSRF_FIELD} value={token} />;
}
