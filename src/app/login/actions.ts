"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { assertCsrf, CsrfError } from "@/lib/csrf-server";

export type SignInState = { error?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
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
  redirect("/account");
}

export async function signOutAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  await signOut();
  redirect("/");
}
