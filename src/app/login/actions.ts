"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { assertCsrf, CsrfError } from "@/lib/csrf-server";
import { RateLimitError, assertRateLimitForAction } from "@/lib/rate-limit";

export type SignInState = { error?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // Rate-limit BEFORE CSRF: brute-force probes may not have a valid CSRF token,
  // but they should still consume budget so we can throttle the attacker's IP.
  try {
    await assertRateLimitForAction("signIn");
  } catch (err) {
    if (err instanceof RateLimitError) {
      const seconds = Math.max(1, Math.ceil(err.retryAfterMs / 1000));
      return { error: `Too many attempts. Try again in ${seconds} seconds.` };
    }
    throw err;
  }

  try {
    await assertCsrf(formData);
  } catch (err) {
    if (err instanceof CsrfError) return { error: err.message };
    throw err;
  }

  const email = String(formData.get("email") ?? "");
  try {
    await signIn(email);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sign-in failed." };
  }
  redirect("/me");
}

export async function signOutAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  await signOut();
  redirect("/");
}
