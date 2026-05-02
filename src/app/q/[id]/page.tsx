import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownBody } from "@/components/markdown-body";
import { NotFoundError } from "@/lib/memberships";
import { getQuestionById } from "@/lib/questions";

type Props = { params: Promise<{ id: string }> };

function authorLabel(a: { name: string | null; email: string | null }): string {
  return a.name ?? a.email ?? "unknown";
}

export default async function QuestionDetailPage({ params }: Props) {
  const { id } = await params;

  let question;
  try {
    question = await getQuestionById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-8">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-2xl">{question.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Asked by {authorLabel(question.author)} in{" "}
            <Link href={`/groups/${question.group.slug}`} className="underline">
              {question.group.name}
            </Link>
            {" · "}
            <span>Score {question.voteScore}</span>
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <MarkdownBody source={question.body} />
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">
          {question.answers.length === 0
            ? "No answers yet"
            : `${question.answers.length} ${question.answers.length === 1 ? "answer" : "answers"}`}
        </h2>
        {question.answers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Answers ship in a follow-up — check back soon.
          </p>
        ) : (
          <ul className="space-y-3">
            {question.answers.map((a) => (
              <li key={a.id}>
                <Card>
                  <CardContent className="space-y-2 pt-4">
                    <p className="text-xs text-muted-foreground">
                      {authorLabel(a.author)} · Score {a.voteScore}
                    </p>
                    <MarkdownBody source={a.body} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
