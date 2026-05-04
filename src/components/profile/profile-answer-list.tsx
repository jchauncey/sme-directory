import Link from "next/link";
import type { ProfileAnswerItem } from "@/lib/profile";

type Props = {
  items: ProfileAnswerItem[];
  emptyState: React.ReactNode;
};

export function ProfileAnswerList({ items, emptyState }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyState}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id} className="py-3 first:pt-0 last:pb-0">
          <Link
            href={`/q/${a.question.id}`}
            className="text-sm font-medium hover:underline"
          >
            {a.question.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {a.bodyExcerpt}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Link
              href={`/groups/${a.question.group.slug}`}
              className="hover:underline"
            >
              {a.question.group.name}
            </Link>
            {" · Score "}
            {a.voteScore}
            {a.isAccepted ? (
              <>
                {" · "}
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  accepted
                </span>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
