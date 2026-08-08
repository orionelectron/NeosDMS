"use client";

import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          NEOS DMS can&apos;t reach the server right now. Check your connection and
          try again.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <RefreshCw className="size-4" aria-hidden />
        Retry
      </button>
    </main>
  );
}
