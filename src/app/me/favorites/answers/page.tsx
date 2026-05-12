import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileFavoriteList } from "@/components/profile/profile-favorite-list";
import { requireAuth } from "@/lib/auth";
import { listFavoritesByUser } from "@/lib/profile";

export default async function FavoriteAnswersPage() {
  const session = await requireAuth();
  const favorites = await listFavoritesByUser(session.user.id, {
    kind: "answer",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Favorite answers {favorites.length > 0 ? `(${favorites.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ProfileFavoriteList
            items={favorites}
            emptyState="You haven't favorited any answers yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
