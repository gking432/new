"use client";

import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Safety net for the /app segment. If a page throws during render (most likely
 * because Supabase env vars are missing on the deploy), show a clear message
 * instead of the generic "Application error" screen.
 */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Compass className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load the demo</h1>
          <p className="text-sm text-muted-foreground">
            This usually means the demo&apos;s environment variables aren&apos;t set in
            this deployment. Confirm{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>, and{" "}
            <code className="font-mono text-xs">OPENAI_API_KEY</code> are configured in
            Vercel, then redeploy.
          </p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
