import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { groupSlugSchema } from "@/lib/validation/groups";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const buckets = new Map<string, number[]>();

function takeToken(userId: string, now: number): boolean {
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (buckets.get(userId) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) {
    buckets.set(userId, recent);
    return false;
  }
  recent.push(now);
  buckets.set(userId, recent);
  return true;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    if (!takeToken(session.user.id, Date.now())) {
      return Response.json({ error: "RateLimited" }, { status: 429 });
    }

    const url = new URL(req.url);
    const raw = url.searchParams.get("slug") ?? "";
    const parsed = groupSlugSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ valid: false, available: false }, { status: 200 });
    }
    const existing = await db.group.findUnique({
      where: { slug: parsed.data },
      select: { id: true },
    });
    return Response.json({ valid: true, available: existing === null }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
