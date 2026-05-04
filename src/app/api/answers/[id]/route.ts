import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import { deleteAnswer, updateAnswer } from "@/lib/answers";
import { updateAnswerSchema } from "@/lib/validation/answers";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      { error: "ValidationError", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = updateAnswerSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const answer = await updateAnswer(id, parsed.data, session.user.id);
    return Response.json({ answer }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    await deleteAnswer(id, session.user.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorToResponse(err);
  }
}
