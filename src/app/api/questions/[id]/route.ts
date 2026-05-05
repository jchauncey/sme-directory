import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { getQuestionById, softDeleteQuestion } from "@/lib/questions";

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
