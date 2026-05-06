import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { DEFAULT_PER, MAX_PER, listForUser } from "@/lib/notifications";
import { isCategory, type NotificationCategory } from "@/lib/notification-preferences";

function parsePositiveInt(raw: string | null, fallback: number, max?: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max !== undefined ? Math.min(n, max) : n;
}

export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    const hasFilters = sp.has("page") || sp.has("per") || sp.has("types") || sp.has("unread");

    if (!hasFilters) {
      // Bell-dropdown default: most recent 20.
      const result = await listForUser(session.user.id, { limit: 20 });
      return Response.json(result, { status: 200 });
    }

    const page = parsePositiveInt(sp.get("page"), 1);
    const per = parsePositiveInt(sp.get("per"), DEFAULT_PER, MAX_PER);
    const typesRaw = sp.get("types");
    const types: NotificationCategory[] = typesRaw
      ? typesRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .filter(isCategory)
      : [];
    const unreadOnly = sp.get("unread") === "1" || sp.get("unread") === "true";

    const result = await listForUser(session.user.id, {
      page,
      per,
      types,
      unreadOnly,
    });
    return Response.json(result, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
