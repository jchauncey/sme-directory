import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { getGroupBySlugOrThrow } from "@/lib/groups";
import { applyToGroup } from "@/lib/memberships";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const group = await getGroupBySlugOrThrow(slug);
    const membership = await applyToGroup(group.id, session.user.id);
    return Response.json({ membership }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
