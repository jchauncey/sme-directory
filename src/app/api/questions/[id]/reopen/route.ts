import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { reopenQuestion } from "@/lib/questions";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const question = await reopenQuestion(id, session.user.id);
    return Response.json({ question }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
