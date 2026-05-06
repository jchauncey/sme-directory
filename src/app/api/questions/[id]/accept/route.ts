import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { acceptAnswer } from "@/lib/questions";
import { notifyAnswerAccepted } from "@/lib/notifications";
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
    if (parsed.data.answerId) {
      try {
        const acceptedAnswerId = parsed.data.answerId;
        const ctx = await db.answer.findUnique({
          where: { id: acceptedAnswerId },
          select: {
            id: true,
            authorId: true,
            question: {
              select: {
                id: true,
                title: true,
                group: { select: { slug: true, name: true } },
              },
            },
          },
        });
        if (ctx) {
          await notifyAnswerAccepted(
            { id: ctx.id, authorId: ctx.authorId },
            { id: ctx.question.id, title: ctx.question.title },
            ctx.question.group,
            { id: session.user.id, name: session.user.name },
          );
        }
      } catch (notifyErr) {
        console.error("notifyAnswerAccepted failed:", notifyErr);
      }
    }
    return Response.json({ question }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
