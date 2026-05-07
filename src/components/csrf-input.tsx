import { CSRF_FIELD } from "@/lib/csrf";
import { getCsrfToken } from "@/lib/csrf-server";

export async function CsrfInput(): Promise<React.ReactElement> {
  const token = (await getCsrfToken()) ?? "";
  return <input type="hidden" name={CSRF_FIELD} value={token} />;
}
