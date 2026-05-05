import { getSession } from "@/lib/auth";
import { archiveGroup, getGroupBySlug, updateGroup } from "@/lib/groups";
import { updateGroupSchema } from "@/lib/validation/groups";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const group = await getGroupBySlug(slug);
  if (!group) {
    return Response.json({ error: "NotFound" }, { status: 404 });
  }
  const { createdBy, ...rest } = group;
  return Response.json({ group: rest, owner: createdBy });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "InvalidJson" }, { status: 400 });
  }

  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const group = await updateGroup(slug, parsed.data, session.user.id);
    return Response.json({ group });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const group = await archiveGroup(slug, session.user.id);
    return Response.json({ group });
  } catch (err) {
    return errorToResponse(err);
  }
}
