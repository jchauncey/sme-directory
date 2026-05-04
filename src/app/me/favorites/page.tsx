import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { listFavoritesForUser } from "@/lib/favorites";

function authorLabel(a: { name: string | null; email: string | null }): string {
  return a.name ?? a.email ?? "unknown";
}

function excerpt(body: string, max = 200): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trimEnd() + "…";
}

export default async function MyFavoritesPage() {
  const session = await requireAuth();
  const { questions, answers } = await listFavoritesForUser(session.user.id);

  const empty = questions.length === 0 && answers.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My favorites</h1>
        <p className="text-sm text-muted-foreground">
          Questions and answers you&rsquo;ve starred.
        </p>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">
          You haven&rsquo;t favorited anything yet. Open a question and tap the star
          to save it here.
        </p>
      ) : null}

      {questions.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">
            Questions ({questions.length})
          </h2>
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link href={`/q/${q.id}`} className="underline">
                        {q.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Asked by {authorLabel(q.author)} in{" "}
                    <Link href={`/groups/${q.group.slug}`} className="underline">
                      {q.group.name}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {answers.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Answers ({answers.length})</h2>
          <ul className="space-y-2">
            {answers.map((a) => (
              <li key={a.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link href={`/q/${a.question.id}`} className="underline">
                        {a.question.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm whitespace-pre-wrap">
                      {excerpt(a.body)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Answered by {authorLabel(a.author)}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
