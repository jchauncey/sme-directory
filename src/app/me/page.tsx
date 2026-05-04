import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileAnswerList } from "@/components/profile/profile-answer-list";
import { ProfileFavoriteList } from "@/components/profile/profile-favorite-list";
import { ProfileGroupList } from "@/components/profile/profile-group-list";
import { ProfileQuestionList } from "@/components/profile/profile-question-list";
import { requireAuth } from "@/lib/auth";
import {
  listAnswersByAuthor,
  listFavoritesByUser,
  listGroupsForUser,
  listQuestionsByAuthor,
} from "@/lib/profile";

const PAGE_SIZE = 20;

export default async function MePage() {
  const session = await requireAuth();
  const userId = session.user.id;

  const [questions, answers, groups, favorites] = await Promise.all([
    listQuestionsByAuthor(userId, { page: 1, per: PAGE_SIZE }),
    listAnswersByAuthor(userId, { page: 1, per: PAGE_SIZE }),
    listGroupsForUser(userId, { includePending: true }),
    listFavoritesByUser(userId),
  ]);

  const display = session.user.name?.trim() || session.user.email;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">{display}</CardTitle>
          <CardDescription>
            <span>{session.user.email}</span>
            {" · "}
            <span className="font-mono text-xs">{session.user.id}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your questions {questions.total > 0 ? `(${questions.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileQuestionList
            items={questions.items}
            emptyState={
              <>
                You haven&rsquo;t asked any questions yet.{" "}
                <Link href="/groups" className="underline">
                  Browse groups
                </Link>{" "}
                to get started.
              </>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your answers {answers.total > 0 ? `(${answers.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileAnswerList
            items={answers.items}
            emptyState="You haven't posted any answers yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Favorites {favorites.length > 0 ? `(${favorites.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileFavoriteList
            items={favorites}
            emptyState="You haven't favorited anything yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your groups {groups.length > 0 ? `(${groups.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileGroupList
            items={groups}
            viewer="self"
            emptyState={
              <>
                You&rsquo;re not in any groups yet.{" "}
                <Link href="/groups" className="underline">
                  Browse groups
                </Link>
                .
              </>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
