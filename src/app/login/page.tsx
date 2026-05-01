import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/account");
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Dev sign-in: type any email to sign in as that user. A user record is created on first
          sign-in. This shim will be replaced by Active Directory authentication.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
