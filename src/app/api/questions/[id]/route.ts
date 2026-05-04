import { errorToResponse } from "@/lib/api/errors";
import { getQuestionById } from "@/lib/questions";

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
