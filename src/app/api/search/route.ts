import { errorToResponse, validationFailed } from "@/lib/api/errors";
import { searchContent } from "@/lib/search";
import { searchQuerySchema } from "@/lib/validation/search";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = searchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
    groupIds: url.searchParams.get("groupIds") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    per: url.searchParams.get("per") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
    authorId: url.searchParams.get("authorId") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
  });
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const page = await searchContent(parsed.data);
    return Response.json(page, { status: 200 });
  } catch (err) {
    return errorToResponse(err);
  }
}
