import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownBody } from "@/components/markdown-body";
import { UserAvatar } from "@/components/ui/user-avatar";
import { requireAuth } from "@/lib/auth";
import { countFavoriteGroupsForUser, listFavoritesForUser } from "@/lib/favorites";
import {
  countAnswersByAuthor,
  countQuestionsByAuthor,
  getOwnProfile,
  listGroupsForUser,
} from "@/lib/profile";

type SummaryCard = {
  label: string;
  count: number;
  href: string;
};

export default async function MePage() {
  const session = await requireAuth();
  const userId = session.user.id;

  const [profile, questionCount, answerCount, favorites, favoriteGroupCount, groups] =
    await Promise.all([
      getOwnProfile(userId),
      countQuestionsByAuthor(userId),
      countAnswersByAuthor(userId),
      listFavoritesForUser(userId),
      countFavoriteGroupsForUser(userId),
      listGroupsForUser(userId, { includePending: false }),
    ]);

  const name = profile?.name ?? session.user.name;
  const bio = profile?.bio ?? null;
  const display = name?.trim() || session.user.email;

  const summary: SummaryCard[] = [
    { label: "Questions", count: questionCount, href: "/me/questions" },
    { label: "Answers", count: answerCount, href: "/me/answers" },
    {
      label: "Favorite questions",
      count: favorites.questions.length,
      href: "/me/favorites/questions",
    },
    {
      label: "Favorite answers",
      count: favorites.answers.length,
      href: "/me/favorites/answers",
    },
    {
      label: "Favorite groups",
      count: favoriteGroupCount,
      href: "/me/favorites/groups",
    },
    { label: "Groups", count: groups.length, href: "/me/groups" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-start gap-4">
            <UserAvatar user={session.user} size="lg" />
            <div className="flex-1 space-y-1">
              <CardTitle className="text-xl">{display}</CardTitle>
              <CardDescription>{session.user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        {bio ? (
          <CardContent className="pt-4">
            <MarkdownBody source={bio} />
          </CardContent>
        ) : null}
      </Card>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group block rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">{s.count}</span>
                <span className="text-xs text-muted-foreground group-hover:text-foreground">
                  View →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
