import Link from "next/link";
import type { OpenQuestionListItem } from "@/lib/questions";

type Props = {
  items: OpenQuestionListItem[];
  emptyState: React.ReactNode;
};

function authorLabel(a: { name: string | null; email: string | null }): string {
  return a.name ?? a.email ?? "unknown";
}

export function OpenQuestionList({ items, emptyState }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyState}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((q) => (
        <li key={q.id} className="py-3 first:pt-0 last:pb-0">
          <Link href={`/q/${q.id}`} className="text-sm font-medium hover:underline">
            {q.title}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            <Link href={`/groups/${q.group.slug}`} className="hover:underline">
              {q.group.name}
            </Link>
            {" · "}
            {authorLabel(q.author)}
            {" · "}
            {q.answerCount} {q.answerCount === 1 ? "answer" : "answers"}
            {" · Score "}
            {q.voteScore}
          </p>
        </li>
      ))}
    </ul>
  );
}
