export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">Search questions and answers across groups.</p>
      </div>
      <div className="h-8 w-full max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-2">
        <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted/30" />
        ))}
      </ul>
    </div>
  );
}
