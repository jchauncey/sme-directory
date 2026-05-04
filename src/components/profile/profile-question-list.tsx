import Link from "next/link";
import type { ProfileQuestionItem } from "@/lib/profile";

type Props = {
  items: ProfileQuestionItem[];
  emptyState: React.ReactNode;
};

export function ProfileQuestionList({ items, emptyState }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyState}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((q) => (
        <li key={q.id} className="py-3 first:pt-0 last:pb-0">
          <Link
            href={`/q/${q.id}`}
            className="text-sm font-medium hover:underline"
          >
            {q.title}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            <Link
              href={`/groups/${q.group.slug}`}
              className="hover:underline"
            >
              {q.group.name}
            </Link>
            {" · "}
            {q.answerCount} {q.answerCount === 1 ? "answer" : "answers"}
            {" · Score "}
            {q.voteScore}
            {q.status === "answered" ? (
              <>
                {" · "}
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  answered
                </span>
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
