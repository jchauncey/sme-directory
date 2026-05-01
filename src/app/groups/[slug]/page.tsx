import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGroupBySlug } from "@/lib/groups";

type Props = { params: Promise<{ slug: string }> };

export default async function GroupDetailPage({ params }: Props) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) notFound();

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-xl">{group.name}</CardTitle>
          <CardDescription>
            <span className="font-mono text-xs">{group.slug}</span>
            {" · "}
            <span>
              {group.autoApprove ? "auto-approves new members" : "requires owner approval"}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {group.description ? (
            <p className="text-sm">{group.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description yet.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Owner: {group.createdBy.name ?? group.createdBy.email}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
