import { getSession } from "@/lib/auth";
import { errorToResponse, rateLimited, unauthorized, validationFailed } from "@/lib/api/errors";
import { RateLimitError, assertRateLimitForAction } from "@/lib/rate-limit";
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

  // Mirror the server-action rate-limit (see `voteAction` in
  // `src/app/q/[id]/vote-actions.ts`) so direct-API callers can't bypass the
  // per-user budget if the proxy is ever skipped (internal callers, tests, or
  // a future routing change). Entrypoints own rate-limiting — not `castVote`.
  try {
    await assertRateLimitForAction("votes");
  } catch (err) {
    if (err instanceof RateLimitError) {
      const seconds = Math.max(1, Math.ceil(err.retryAfterMs / 1000));
      return rateLimited(err.retryAfterMs, `Too many votes. Try again in ${seconds} seconds.`);
    }
    throw err;
  }

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
