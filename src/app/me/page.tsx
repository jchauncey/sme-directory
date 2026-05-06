import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarUploadForm } from "@/components/avatar/avatar-upload-form";
import { ProfileAnswerList } from "@/components/profile/profile-answer-list";
import { ProfileFavoriteList } from "@/components/profile/profile-favorite-list";
import { ProfileGroupList } from "@/components/profile/profile-group-list";
import { ProfileQuestionList } from "@/components/profile/profile-question-list";
import { requireAuth } from "@/lib/auth";
import { listPreferencesForUser } from "@/lib/notification-preferences";
import {
  getOwnProfile,
  listAnswersByAuthor,
  listFavoritesByUser,
  listGroupsForUser,
  listQuestionsByAuthor,
} from "@/lib/profile";
import { EditProfileForm } from "./edit-profile-form";

const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ qpage?: string; apage?: string }>;
};

export default async function MePage({ searchParams }: Props) {
  const session = await requireAuth();
  const userId = session.user.id;
  const sp = await searchParams;
  const qPage = Math.max(Number(sp.qpage) || 1, 1);
  const aPage = Math.max(Number(sp.apage) || 1, 1);

  const [profile, questions, answers, groups, favorites, preferences] = await Promise.all([
    getOwnProfile(userId),
    listQuestionsByAuthor(userId, { page: qPage, per: PAGE_SIZE }),
    listAnswersByAuthor(userId, { page: aPage, per: PAGE_SIZE }),
    listGroupsForUser(userId, { includePending: true }),
    listFavoritesByUser(userId),
    listPreferencesForUser(userId),
  ]);

  const qTotalPages = Math.max(Math.ceil(questions.total / PAGE_SIZE), 1);
  const aTotalPages = Math.max(Math.ceil(answers.total / PAGE_SIZE), 1);

  const buildMeHref = (overrides: { qpage?: number; apage?: number }): string => {
    const params = new URLSearchParams();
    const nextQ = overrides.qpage ?? qPage;
    const nextA = overrides.apage ?? aPage;
    if (nextQ > 1) params.set("qpage", String(nextQ));
    if (nextA > 1) params.set("apage", String(nextA));
    const qs = params.toString();
    return qs ? `/me?${qs}` : "/me";
  };

  const mutedTypesByGroupId = Object.fromEntries(
    preferences.map((p) => [p.groupId, p.mutedTypes]),
  );

  const name = profile?.name ?? session.user.name;
  const bio = profile?.bio ?? null;
  const display = name?.trim() || session.user.email;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start gap-4">
            <UserAvatar user={session.user} size="lg" />
            <div className="flex-1 space-y-1">
              <CardTitle className="text-xl">{display}</CardTitle>
              <CardDescription>
                <span>{session.user.email}</span>
                {" · "}
                <span className="font-mono text-xs">{session.user.id}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <AvatarUploadForm
            endpoint="/api/users/me/avatar"
            hasImage={Boolean(session.user.image)}
            label="Profile avatar"
          />
          <EditProfileForm name={name} bio={bio} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your questions {questions.total > 0 ? `(${questions.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
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
          <Pagination
            currentPage={qPage}
            totalPages={qTotalPages}
            buildHref={(p) => buildMeHref({ qpage: p })}
            label="Questions pagination"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your answers {answers.total > 0 ? `(${answers.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ProfileAnswerList
            items={answers.items}
            emptyState="You haven't posted any answers yet."
          />
          <Pagination
            currentPage={aPage}
            totalPages={aTotalPages}
            buildHref={(p) => buildMeHref({ apage: p })}
            label="Answers pagination"
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
            mutedTypesByGroupId={mutedTypesByGroupId}
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
