export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-live="polite">
      <div className="rounded-lg border border-border">
        <div className="border-b p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border">
          <div className="border-b p-6">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <ul className="divide-y divide-border">
            {[0, 1].map((j) => (
              <li key={j} className="space-y-2 p-6">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
