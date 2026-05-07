export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-live="polite">
      <div className="rounded-lg border border-border">
        <div className="space-y-3 border-b p-6">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
        <div className="space-y-3 p-6">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="space-y-2 border-b p-6">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
        <ul className="space-y-2 p-6">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b p-6">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <ul className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <li key={i} className="space-y-2 p-6">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
