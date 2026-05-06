import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import {
  getPreferenceForGroup,
  setPreferenceForGroup,
} from "@/lib/notification-preferences";
import { updateNotificationPreferenceSchema } from "@/lib/validation/notification-preferences";

type Ctx = { params: Promise<{ groupId: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const { groupId } = await ctx.params;
  try {
    const mutedTypes = await getPreferenceForGroup(session.user.id, groupId);
    return Response.json({ groupId, mutedTypes }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: Request, ctx: Ctx): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();
  const { groupId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "InvalidJson" }, { status: 400 });
  }

  const parsed = updateNotificationPreferenceSchema.safeParse(body);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const mutedTypes = await setPreferenceForGroup(
      session.user.id,
      groupId,
      parsed.data.mutedTypes,
    );
    return Response.json({ groupId, mutedTypes }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
