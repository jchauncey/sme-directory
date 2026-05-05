import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import { assertGroupNotArchived, getGroupBySlugOrThrow } from "@/lib/groups";
import { assertApprovedMember } from "@/lib/memberships";
import { createQuestion, listQuestionsForGroup } from "@/lib/questions";
import { notifyQuestionCreated } from "@/lib/notifications";
import {
  createQuestionSchema,
  questionListQuerySchema,
} from "@/lib/validation/questions";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
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

  const parsed = createQuestionSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const group = await getGroupBySlugOrThrow(slug);
    await assertApprovedMember(group.id, session.user.id);
    await assertGroupNotArchived(group.id);
    const question = await createQuestion(parsed.data, group.id, session.user.id);
    try {
      await notifyQuestionCreated(question, group, session.user.name);
    } catch (notifyErr) {
      console.error("notifyQuestionCreated failed:", notifyErr);
    }
    return Response.json({ question }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function GET(req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;

  const url = new URL(req.url);
  const parsed = questionListQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    per: url.searchParams.get("per") ?? undefined,
  });
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const group = await getGroupBySlugOrThrow(slug);
    const page = await listQuestionsForGroup(group.id, parsed.data);
    return Response.json(page, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
