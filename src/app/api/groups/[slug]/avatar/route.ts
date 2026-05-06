import { getSession } from "@/lib/auth";
import { clearGroupAvatar, setGroupAvatar } from "@/lib/avatars";
import { errorToResponse, unauthorized } from "@/lib/api/errors";

type Ctx = { params: Promise<{ slug: string }> };

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

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  const fileOrErr = await readFileFromForm(req);
  if (fileOrErr instanceof Response) return fileOrErr;

  try {
    const result = await setGroupAvatar(slug, fileOrErr, session.user.id);
    return Response.json(result);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params;
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    await clearGroupAvatar(slug, session.user.id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
