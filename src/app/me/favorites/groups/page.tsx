import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupCard } from "@/components/groups/group-card";
import { requireAuth } from "@/lib/auth";
import { listFavoriteGroupsForUser } from "@/lib/favorites";

export default async function FavoriteGroupsPage() {
  const session = await requireAuth();
  const groups = await listFavoriteGroupsForUser(session.user.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Favorite groups {groups.length > 0 ? `(${groups.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven&rsquo;t favorited any groups yet. Open a group page and tap the star to save
              it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {groups.map((g) => (
                <GroupCard key={g.id} group={g} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
