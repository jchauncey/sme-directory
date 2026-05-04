import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownBody } from "@/components/markdown-body";
import { getSession } from "@/lib/auth";
import { NotFoundError, getMembership } from "@/lib/memberships";
import { getQuestionById } from "@/lib/questions";
import { AnswerForm } from "./answer-form";
import { AnswerActions } from "./answer-actions";
import { VoteButton } from "./vote-button";

type Props = { params: Promise<{ id: string }> };

function authorLabel(a: { name: string | null; email: string | null }): string {
  return a.name ?? a.email ?? "unknown";
}

export default async function QuestionDetailPage({ params }: Props) {
  const { id } = await params;

  const session = await getSession();
  const currentUserId = session?.user.id ?? null;

  let question;
  try {
    question = await getQuestionById(id, currentUserId ?? undefined);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const viewerMembership = currentUserId
    ? await getMembership(question.group.id, currentUserId)
    : null;
  const isApprovedViewer = viewerMembership?.status === "approved";
  const canDeleteAny =
    isApprovedViewer &&
    (viewerMembership?.role === "owner" || viewerMembership?.role === "moderator");

  const voteDisabledReason = !currentUserId
    ? "Sign in to vote."
    : !isApprovedViewer
      ? "You must be an approved member of this group to vote."
      : undefined;
  const questionVoteDisabled =
    !currentUserId || !isApprovedViewer || question.author.id === currentUserId;
  const questionVoteDisabledReason =
    currentUserId && question.author.id === currentUserId
      ? "You cannot vote on your own question."
      : voteDisabledReason;

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
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <VoteButton
            targetType="question"
            targetId={question.id}
            questionId={question.id}
            initialScore={question.voteScore}
            initialVoted={question.viewerVote === 1}
            disabled={questionVoteDisabled}
            disabledReason={questionVoteDisabledReason}
          />
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
            Be the first to answer.
          </p>
        ) : (
          <ul className="space-y-3">
            {question.answers.map((a) => {
              const isOwnAnswer =
                currentUserId !== null && a.author.id === currentUserId;
              const canEdit = isOwnAnswer;
              const answerVoteDisabled =
                !currentUserId || !isApprovedViewer || isOwnAnswer;
              const answerVoteDisabledReason = isOwnAnswer
                ? "You cannot vote on your own answer."
                : voteDisabledReason;
              return (
                <li key={a.id}>
                  <Card>
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center gap-3">
                        <VoteButton
                          targetType="answer"
                          targetId={a.id}
                          questionId={question.id}
                          initialScore={a.voteScore}
                          initialVoted={a.viewerVote === 1}
                          disabled={answerVoteDisabled}
                          disabledReason={answerVoteDisabledReason}
                        />
                        <p className="text-xs text-muted-foreground">
                          {authorLabel(a.author)}
                        </p>
                      </div>
                      <AnswerActions
                        answerId={a.id}
                        questionId={question.id}
                        body={a.body}
                        canEdit={canEdit}
                        canDelete={canDeleteAny}
                      />
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-medium">Post an answer</h3>
        {!currentUserId ? (
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="underline">
              Sign in
            </Link>{" "}
            to post an answer.
          </p>
        ) : isApprovedViewer ? (
          <AnswerForm questionId={question.id} />
        ) : (
          <p className="text-sm text-muted-foreground">
            You must be an approved member of{" "}
            <Link href={`/groups/${question.group.slug}`} className="underline">
              {question.group.name}
            </Link>{" "}
            to answer this question.
          </p>
        )}
      </section>
    </div>
  );
}
