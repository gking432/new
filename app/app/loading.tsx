import { Compass, Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-dark text-brand-gold">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold">Loading the AI command center</p>
              <p className="text-sm text-muted-foreground">
                Preparing a fresh dashboard, demo records, and automation state.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Warming up
          </div>
        </div>
        <div className="h-1 overflow-hidden bg-secondary">
          <div className="h-full w-1/2 animate-pulse bg-brand-gold" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted/70" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-muted/70" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted/70" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-44 animate-pulse rounded bg-muted/70" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/70" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
