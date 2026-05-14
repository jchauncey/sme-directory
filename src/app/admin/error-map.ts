import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/memberships";
import { CsrfError } from "@/lib/csrf-server";

export function mapAdminError(err: unknown, fallback: string): string {
  if (err instanceof CsrfError) return err.message;
  if (err instanceof AuthorizationError) {
    return "You don't have permission to do this.";
  }
  if (err instanceof NotFoundError) return err.message;
  if (err instanceof ConflictError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
