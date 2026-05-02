import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { listForUser } from "@/lib/notifications";

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const result = await listForUser(session.user.id, { limit: 20 });
    return Response.json(result, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
