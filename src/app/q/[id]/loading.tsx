export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-8" aria-busy="true" aria-live="polite">
      <div className="rounded-lg border border-border">
        <div className="space-y-3 border-b p-6">
          <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-3 p-6">
          <div className="flex gap-2">
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <ul className="space-y-3">
          {[0, 1].map((i) => (
            <li key={i} className="rounded-lg border border-border">
              <div className="space-y-3 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
                  <div className="h-6 w-6 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
