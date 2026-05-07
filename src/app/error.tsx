"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logServerError } from "@/lib/log-server-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logServerError("page", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        An unexpected error occurred while rendering this page. You can try again, or head back to a
        familiar place.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>What happened</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The error was logged. If the problem persists, please report it to the team.
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
