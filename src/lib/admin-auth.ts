import "server-only";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/memberships";

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return u?.isSuperAdmin === true;
}

export async function assertSuperAdmin(userId: string): Promise<void> {
  if (!(await isSuperAdmin(userId))) {
    throw new AuthorizationError();
  }
}
