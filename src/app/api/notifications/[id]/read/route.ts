import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { markRead } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const notification = await markRead(id, session.user.id);
    return Response.json({ notification }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
