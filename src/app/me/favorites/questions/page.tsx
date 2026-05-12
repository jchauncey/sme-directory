import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileFavoriteList } from "@/components/profile/profile-favorite-list";
import { requireAuth } from "@/lib/auth";
import { listFavoritesByUser } from "@/lib/profile";

export default async function FavoriteQuestionsPage() {
  const session = await requireAuth();
  const favorites = await listFavoritesByUser(session.user.id, {
    kind: "question",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Favorite questions {favorites.length > 0 ? `(${favorites.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileFavoriteList
            items={favorites}
            emptyState="You haven't favorited any questions yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
