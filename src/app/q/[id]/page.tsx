import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { NotFoundError, getMembership } from "@/lib/memberships";
import { getQuestionById } from "@/lib/questions";
import { AnswerForm } from "./answer-form";
import { AnswerActions } from "./answer-actions";
import { VoteButton } from "./vote-button";
import { FavoriteButton } from "./favorite-button";
import { QuestionResolveControls } from "./question-resolve-controls";
import { QuestionDeleteButton } from "./question-delete-button";
import { AcceptAnswerButton } from "./accept-answer-button";
import { EditQuestionForm } from "./edit-question-form";

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

  if (question.deletedAt) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-2xl text-muted-foreground line-through">
              {question.title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Asked by {authorLabel(question.author)} in{" "}
              <Link
                href={`/groups/${question.group.slug}`}
                className="underline"
              >
                {question.group.name}
              </Link>
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm text-muted-foreground">
              This question has been deleted on{" "}
              <time dateTime={question.deletedAt.toISOString()}>
                {question.deletedAt.toLocaleDateString()}
              </time>
              . It is no longer listed in the group, search, or notifications.
            </p>
            <p className="text-sm">
              <Link
                href={`/groups/${question.group.slug}`}
                className="underline"
              >
                Back to {question.group.name}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const viewerMembership = currentUserId
    ? await getMembership(question.group.id, currentUserId)
    : null;
  const isApprovedViewer = viewerMembership?.status === "approved";
  const isModOrOwner =
    isApprovedViewer &&
    (viewerMembership?.role === "owner" || viewerMembership?.role === "moderator");
  const canDeleteAny = isModOrOwner;
  const isAuthor =
    currentUserId !== null && question.author.id === currentUserId;
  const canResolve =
    currentUserId !== null && (isAuthor || isModOrOwner);
  const canDeleteQuestion =
    currentUserId !== null && (isAuthor || isModOrOwner);
  const isEdited =
    question.updatedAt.getTime() > question.createdAt.getTime();

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
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-2xl">{question.title}</CardTitle>
            <div className="flex flex-col items-end gap-2">
              <QuestionResolveControls
                questionId={question.id}
                status={question.status}
                canResolve={canResolve}
              />
              {canDeleteQuestion ? (
                <QuestionDeleteButton questionId={question.id} />
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Asked by {authorLabel(question.author)} in{" "}
            <Link href={`/groups/${question.group.slug}`} className="underline">
              {question.group.name}
            </Link>
            {isEdited ? (
              <span className="ml-2 inline-flex items-center rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                edited
              </span>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <VoteButton
              targetType="question"
              targetId={question.id}
              questionId={question.id}
              initialScore={question.voteScore}
              initialVoted={question.viewerVote === 1}
              disabled={questionVoteDisabled}
              disabledReason={questionVoteDisabledReason}
            />
            <FavoriteButton
              targetType="question"
              targetId={question.id}
              questionId={question.id}
              initialFavorited={question.isFavorited}
              disabled={!currentUserId}
              disabledReason={!currentUserId ? "Sign in to favorite." : undefined}
            />
          </div>
          <EditQuestionForm
            questionId={question.id}
            title={question.title}
            body={question.body}
            canEdit={isAuthor}
          />
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
              const isAccepted = a.id === question.acceptedAnswerId;
              const showAcceptButton = canResolve && !isAccepted;
              return (
                <li key={a.id}>
                  <Card
                    className={
                      isAccepted
                        ? "border-green-600/60 bg-green-50/40 dark:border-green-500/50 dark:bg-green-950/20"
                        : undefined
                    }
                  >
                    <CardContent className="space-y-2 pt-4">
                      {isAccepted ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-green-600/40 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-500/40 dark:bg-green-950/40 dark:text-green-300">
                            ✓ Accepted answer
                          </span>
                        </div>
                      ) : null}
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
                        <FavoriteButton
                          targetType="answer"
                          targetId={a.id}
                          questionId={question.id}
                          initialFavorited={a.isFavorited}
                          disabled={!currentUserId}
                          disabledReason={
                            !currentUserId ? "Sign in to favorite." : undefined
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {authorLabel(a.author)}
                        </p>
                        {showAcceptButton ? (
                          <AcceptAnswerButton
                            questionId={question.id}
                            answerId={a.id}
                          />
                        ) : null}
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
