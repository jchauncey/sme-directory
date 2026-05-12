import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { ProfileAnswerList } from "@/components/profile/profile-answer-list";
import { requireAuth } from "@/lib/auth";
import { listAnswersByAuthor } from "@/lib/profile";

const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function MyAnswersPage({ searchParams }: Props) {
  const session = await requireAuth();
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);

  const answers = await listAnswersByAuthor(session.user.id, {
    page,
    per: PAGE_SIZE,
  });
  const totalPages = Math.max(Math.ceil(answers.total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your answers {answers.total > 0 ? `(${answers.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ProfileAnswerList
            items={answers.items}
            emptyState="You haven't posted any answers yet."
          />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={(p) => (p > 1 ? `/me/answers?page=${p}` : "/me/answers")}
            label="Answers pagination"
          />
        </CardContent>
      </Card>
    </div>
  );
}
