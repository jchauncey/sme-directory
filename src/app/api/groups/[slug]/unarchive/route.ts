import { getSession } from "@/lib/auth";
import { unarchiveGroup } from "@/lib/groups";
import { errorToResponse, unauthorized } from "@/lib/api/errors";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const group = await unarchiveGroup(slug, session.user.id);
    return Response.json({ group });
  } catch (err) {
    return errorToResponse(err);
  }
}
