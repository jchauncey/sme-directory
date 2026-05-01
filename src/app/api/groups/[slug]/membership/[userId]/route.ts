import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import { getGroupBySlugOrThrow } from "@/lib/groups";
import { removeMembership, setMembershipStatus } from "@/lib/memberships";
import { updateMembershipStatusSchema } from "@/lib/validation/memberships";

type Ctx = { params: Promise<{ slug: string; userId: string }> };

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const { slug, userId } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "InvalidJson" }, { status: 400 });
  }

  const parsed = updateMembershipStatusSchema.safeParse(body);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const group = await getGroupBySlugOrThrow(slug);
    const membership = await setMembershipStatus(
      group.id,
      userId,
      parsed.data.status,
      session.user.id,
    );
    return Response.json({ membership });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug, userId } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const group = await getGroupBySlugOrThrow(slug);
    await removeMembership(group.id, userId, session.user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
