import { getSession } from "@/lib/auth";
import {
  errorToResponse,
  unauthorized,
  validationFailed,
} from "@/lib/api/errors";
import { updateUserProfile } from "@/lib/profile";
import { updateMeSchema } from "@/lib/validation/users";

export async function PATCH(req: Request): Promise<Response> {
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

  const parsed = updateMeSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const user = await updateUserProfile(session.user.id, parsed.data);
    return Response.json({ user }, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
