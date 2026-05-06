import "server-only";
import { db } from "@/lib/db";

export type UserSummary = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export async function searchUsersByNameOrEmail(
  q: string,
  limit = 10,
): Promise<UserSummary[]> {
  const term = q.trim();
  if (!term) return [];
  const take = Math.min(Math.max(limit, 1), 20);
  // SQLite `contains` is case-insensitive for ASCII without `mode: "insensitive"`,
  // and that mode is Postgres-only. Plain `contains` works on both providers.
  const rows = await db.user.findMany({
    where: {
      OR: [{ name: { contains: term } }, { email: { contains: term } }],
    },
    select: { id: true, name: true, email: true, image: true },
    take,
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return rows;
}

export async function getUserSummaryById(id: string): Promise<UserSummary | null> {
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, image: true },
  });
}
