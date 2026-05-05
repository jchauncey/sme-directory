import { getSession } from "@/lib/auth";
import {
  errorToResponse,
  unauthorized,
  validationFailed,
} from "@/lib/api/errors";
import {
  getQuestionById,
  softDeleteQuestion,
  updateQuestion,
} from "@/lib/questions";
import { updateQuestionSchema } from "@/lib/validation/questions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const question = await getQuestionById(id);
    return Response.json({ question }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}

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

  const parsed = updateQuestionSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const question = await updateQuestion(id, parsed.data, session.user.id);
    return Response.json({ question }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    await softDeleteQuestion(id, session.user.id);
    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
