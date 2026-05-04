import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileAnswerList } from "@/components/profile/profile-answer-list";
import { ProfileGroupList } from "@/components/profile/profile-group-list";
import { ProfileQuestionList } from "@/components/profile/profile-question-list";
import {
  getPublicUserProfile,
  listAnswersByAuthor,
  listGroupsForUser,
  listQuestionsByAuthor,
} from "@/lib/profile";

const PAGE_SIZE = 20;

type Props = { params: Promise<{ userId: string }> };

export default async function PublicProfilePage({ params }: Props) {
  const { userId } = await params;
  const profile = await getPublicUserProfile(userId);
  if (!profile) notFound();

  const [questions, answers, groups] = await Promise.all([
    listQuestionsByAuthor(userId, { page: 1, per: PAGE_SIZE }),
    listAnswersByAuthor(userId, { page: 1, per: PAGE_SIZE }),
    listGroupsForUser(userId, { includePending: false }),
  ]);

  const display = profile.name?.trim() || "Anonymous user";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">{display}</CardTitle>
          <CardDescription>
            <span>
              {questions.total} {questions.total === 1 ? "question" : "questions"}
            </span>
            {" · "}
            <span>
              {answers.total} {answers.total === 1 ? "answer" : "answers"}
            </span>
            {" · "}
            <span>
              {groups.length} {groups.length === 1 ? "group" : "groups"}
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Questions {questions.total > 0 ? `(${questions.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileQuestionList
            items={questions.items}
            emptyState="No questions yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Answers {answers.total > 0 ? `(${answers.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileAnswerList
            items={answers.items}
            emptyState="No answers yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Groups {groups.length > 0 ? `(${groups.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileGroupList
            items={groups}
            viewer="public"
            emptyState="Not a member of any groups yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
