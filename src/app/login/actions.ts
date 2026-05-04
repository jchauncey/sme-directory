"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";

export type SignInState = { error?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn(email);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sign-in failed." };
  }
  redirect("/account");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/");
}
