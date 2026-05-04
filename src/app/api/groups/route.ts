import { getSession } from "@/lib/auth";
import { createGroup } from "@/lib/groups";
import { createGroupSchema } from "@/lib/validation/groups";
import { errorToResponse, unauthorized, validationFailed } from "@/lib/api/errors";

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "InvalidJson" }, { status: 400 });
  }

  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const group = await createGroup(parsed.data, session.user.id);
    return Response.json({ group }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
