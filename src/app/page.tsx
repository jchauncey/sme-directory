import Link from "next/link";
import { DashboardBlock } from "@/components/dashboard/dashboard-block";
import { OpenQuestionList } from "@/components/dashboard/open-question-list";
import { GroupCard } from "@/components/groups/group-card";
import { getSession } from "@/lib/auth";
import { listFavoriteGroupsForUser } from "@/lib/favorites";
import { listGroupsByActivity, type GroupListItem } from "@/lib/groups";
import { listRecentOpenQuestionsAcrossGroups } from "@/lib/questions";

const TOP_GROUPS_LIMIT = 5;
const FAVORITES_PREVIEW_LIMIT = 5;
const OPEN_QUESTIONS_LIMIT = 5;

export default async function Home() {
  const session = await getSession();

  // Fetch one extra favorite so we know whether to render the "See all favorites" link.
  const [topGroups, favoriteGroups, openQuestions] = await Promise.all([
    listGroupsByActivity(TOP_GROUPS_LIMIT),
    session
      ? listFavoriteGroupsForUser(session.user.id, FAVORITES_PREVIEW_LIMIT + 1)
      : Promise.resolve([]),
    listRecentOpenQuestionsAcrossGroups(OPEN_QUESTIONS_LIMIT),
  ]);

  const favoritesPreview = favoriteGroups.slice(0, FAVORITES_PREVIEW_LIMIT);
  const showAllFavoritesLink = favoriteGroups.length > FAVORITES_PREVIEW_LIMIT;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SME Directory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse groups, follow the ones you care about, and find unanswered questions.
        </p>
      </div>

      <DashboardBlock
        id="top-groups"
        title="Top groups"
        link={{ href: "/groups", label: "See more →" }}
      >
        <TopGroupsGrid items={topGroups} />
      </DashboardBlock>

      <DashboardBlock
        id="favorite-groups"
        title="Your favorite groups"
        link={
          showAllFavoritesLink
            ? { href: "/me/favorites", label: "See all favorites →" }
            : undefined
        }
      >
        {!session ? (
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="font-medium hover:underline">
              Sign in
            </Link>{" "}
            to track your favorite groups.
          </p>
        ) : favoritesPreview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No favorites yet. Star a group from its page to add it here.
          </p>
        ) : (
          <TopGroupsGrid items={favoritesPreview} />
        )}
      </DashboardBlock>

      <DashboardBlock id="open-questions" title="Recent open questions">
        <OpenQuestionList
          items={openQuestions}
          emptyState="No open questions right now."
        />
      </DashboardBlock>
    </div>
  );
}

function TopGroupsGrid({ items }: { items: GroupListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No groups yet.{" "}
        <Link href="/groups/new" className="font-medium hover:underline">
          Create the first one.
        </Link>
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}
    </div>
  );
}
