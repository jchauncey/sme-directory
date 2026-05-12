import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { ProfileQuestionList } from "@/components/profile/profile-question-list";
import { requireAuth } from "@/lib/auth";
import { listQuestionsByAuthor } from "@/lib/profile";

const PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function MyQuestionsPage({ searchParams }: Props) {
  const session = await requireAuth();
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);

  const questions = await listQuestionsByAuthor(session.user.id, {
    page,
    per: PAGE_SIZE,
  });
  const totalPages = Math.max(Math.ceil(questions.total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Your questions {questions.total > 0 ? `(${questions.total})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ProfileQuestionList
            items={questions.items}
            emptyState={
              <>
                You haven&rsquo;t asked any questions yet.{" "}
                <Link href="/groups" className="underline">
                  Browse groups
                </Link>{" "}
                to get started.
              </>
            }
          />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={(p) => (p > 1 ? `/me/questions?page=${p}` : "/me/questions")}
            label="Questions pagination"
          />
        </CardContent>
      </Card>
    </div>
  );
}
