import { getSession } from "@/lib/auth";
import { errorToResponse, unauthorized } from "@/lib/api/errors";
import { listPreferencesForUser } from "@/lib/notification-preferences";

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const preferences = await listPreferencesForUser(session.user.id);
    return Response.json({ preferences }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
