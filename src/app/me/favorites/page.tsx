import { redirect } from "next/navigation";

export default function FavoritesIndexPage(): never {
  redirect("/me/favorites/questions");
}
