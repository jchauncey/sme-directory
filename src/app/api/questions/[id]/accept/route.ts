import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import { acceptAnswer } from "@/lib/questions";
import { acceptQuestionSchema } from "@/lib/validation/questions";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  let raw: unknown = {};
  const text = await req.text();
  if (text.length > 0) {
    try {
      raw = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "ValidationError", message: "Body must be valid JSON." },
        { status: 400 },
      );
    }
  }

  const parsed = acceptQuestionSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const question = await acceptAnswer(
      id,
      parsed.data.answerId ?? null,
      session.user.id,
    );
    return Response.json({ question }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
