import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";
import { castVote } from "@/lib/votes";
import { voteInputSchema } from "@/lib/validation/votes";

export async function POST(req: Request): Promise<Response> {
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

  const parsed = voteInputSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const result = await castVote(
      { targetType: parsed.data.targetType, targetId: parsed.data.targetId },
      session.user.id,
    );
    return Response.json(result, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
