import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { markAllRead } from "@/lib/notifications";

export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const updatedCount = await markAllRead(session.user.id);
    return Response.json({ updatedCount }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
