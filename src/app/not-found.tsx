import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t find what you were looking for. It may have been moved, deleted, or the
        link might be wrong.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
              Home
            </Link>
            <Link href="/groups" className={cn(buttonVariants({ variant: "outline" }))}>
              Browse groups
            </Link>
            <Link href="/search" className={cn(buttonVariants({ variant: "outline" }))}>
              Search
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
