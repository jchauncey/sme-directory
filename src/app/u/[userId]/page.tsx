import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarkdownBody } from "@/components/markdown-body";
import { Pagination } from "@/components/ui/pagination";
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

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ qpage?: string; apage?: string }>;
};

export default async function PublicProfilePage({ params, searchParams }: Props) {
  const [{ userId }, sp] = await Promise.all([params, searchParams]);
  const profile = await getPublicUserProfile(userId);
  if (!profile) notFound();

  const qPage = Math.max(Number(sp.qpage) || 1, 1);
  const aPage = Math.max(Number(sp.apage) || 1, 1);

  const [questions, answers, groups] = await Promise.all([
    listQuestionsByAuthor(userId, { page: qPage, per: PAGE_SIZE }),
    listAnswersByAuthor(userId, { page: aPage, per: PAGE_SIZE }),
    listGroupsForUser(userId, { includePending: false }),
  ]);

  const qTotalPages = Math.max(Math.ceil(questions.total / PAGE_SIZE), 1);
  const aTotalPages = Math.max(Math.ceil(answers.total / PAGE_SIZE), 1);

  const buildProfileHref = (overrides: { qpage?: number; apage?: number }): string => {
    const params = new URLSearchParams();
    const nextQ = overrides.qpage ?? qPage;
    const nextA = overrides.apage ?? aPage;
    if (nextQ > 1) params.set("qpage", String(nextQ));
    if (nextA > 1) params.set("apage", String(nextA));
    const qs = params.toString();
    return qs ? `/u/${userId}?${qs}` : `/u/${userId}`;
  };

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
        {profile.bio ? (
          <CardContent className="pt-4">
            <MarkdownBody source={profile.bio} />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Questions {questions.total > 0 ? `(${questions.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ProfileQuestionList
            items={questions.items}
            emptyState="No questions yet."
          />
          <Pagination
            currentPage={qPage}
            totalPages={qTotalPages}
            buildHref={(p) => buildProfileHref({ qpage: p })}
            label="Questions pagination"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Answers {answers.total > 0 ? `(${answers.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ProfileAnswerList
            items={answers.items}
            emptyState="No answers yet."
          />
          <Pagination
            currentPage={aPage}
            totalPages={aTotalPages}
            buildHref={(p) => buildProfileHref({ apage: p })}
            label="Answers pagination"
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
