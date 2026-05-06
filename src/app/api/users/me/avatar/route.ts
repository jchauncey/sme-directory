import { getSession, refreshSession } from "@/lib/auth";
import { clearUserAvatar, setUserAvatar } from "@/lib/avatars";
import { errorToResponse, unauthorized } from "@/lib/api/errors";

async function readFileFromForm(req: Request): Promise<File | Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "InvalidForm" }, { status: 400 });
  }
  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return Response.json(
      { error: "InvalidForm", message: "Expected a 'file' field with an image." },
      { status: 400 },
    );
  }
  return entry;
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  const fileOrErr = await readFileFromForm(req);
  if (fileOrErr instanceof Response) return fileOrErr;

  try {
    const result = await setUserAvatar(session.user.id, fileOrErr);
    await refreshSession();
    return Response.json(result);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    await clearUserAvatar(session.user.id);
    await refreshSession();
    return Response.json({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
