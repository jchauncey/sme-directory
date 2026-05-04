import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/groups";
import { getMembership } from "@/lib/memberships";
import { AskQuestionForm } from "./ask-question-form";

type Props = { params: Promise<{ slug: string }> };

export default async function AskQuestionPage({ params }: Props) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=/groups/${slug}/ask`);

  const membership = await getMembership(group.id, session.user.id);
  const isApproved = membership?.status === "approved";

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Ask a question</CardTitle>
          <CardDescription>
            Posting in <Link href={`/groups/${group.slug}`} className="underline">{group.name}</Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isApproved ? (
            <AskQuestionForm slug={group.slug} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                You must be an approved member of this group to post a question.
              </p>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/groups/${group.slug}`} />}
              >
                Back to group
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
