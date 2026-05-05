import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { assertGroupNotArchived } from "@/lib/groups";
import { NotFoundError, assertApprovedMember } from "@/lib/memberships";
import { createAnswer } from "@/lib/answers";
import { createAnswerSchema } from "@/lib/validation/answers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
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

  const parsed = createAnswerSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const question = await db.question.findUnique({
      where: { id },
      select: { id: true, groupId: true, deletedAt: true },
    });
    if (!question || question.deletedAt) {
      throw new NotFoundError("Question not found.");
    }
    await assertApprovedMember(question.groupId, session.user.id);
    await assertGroupNotArchived(question.groupId);
    const answer = await createAnswer(parsed.data, question.id, session.user.id);
    return Response.json({ answer }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
