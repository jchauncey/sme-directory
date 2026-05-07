"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logServerError } from "@/lib/log-server-error";

export default function QuestionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logServerError("page:q/[id]", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load this question</h1>
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We hit an error rendering this question. Try again, or go back and pick another.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-muted-foreground">
              Reference: <span data-testid="error-digest">{error.digest}</span>
            </p>
          ) : null}
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
