import Link from "next/link";
import type { ProfileFavoriteItem } from "@/lib/profile";

type Props = {
  items: ProfileFavoriteItem[];
  emptyState: React.ReactNode;
};

export function ProfileFavoriteList({ items, emptyState }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyState}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((f) =>
        f.kind === "question" ? (
          <li key={`q-${f.id}`} className="py-3 first:pt-0 last:pb-0">
            <Link
              href={`/q/${f.id}`}
              className="text-sm font-medium hover:underline"
            >
              {f.title}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              Question in{" "}
              <Link
                href={`/groups/${f.groupSlug}`}
                className="hover:underline"
              >
                {f.groupName}
              </Link>
            </p>
          </li>
        ) : (
          <li key={`a-${f.id}`} className="py-3 first:pt-0 last:pb-0">
            <Link
              href={`/q/${f.questionId}`}
              className="text-sm font-medium hover:underline"
            >
              {f.questionTitle}
            </Link>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {f.bodyExcerpt}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Answer favorite
            </p>
          </li>
        ),
      )}
    </ul>
  );
}
