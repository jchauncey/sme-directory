import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { searchUsersByNameOrEmail } from "@/lib/users";

export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const limitRaw = url.searchParams.get("limit");
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;

    const items = await searchUsersByNameOrEmail(q, limit);
    return Response.json({ items }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
