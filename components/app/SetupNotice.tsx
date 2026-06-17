import { Compass } from "lucide-react";

/**
 * Shown when the demo is deployed without its Supabase environment variables.
 * Keeps the app from crashing with a generic server error and tells the
 * operator exactly what to set — there's no login here, so a missing database
 * should be a clear message, not a sign-in screen or a white error page.
 */
export function SetupNotice() {
  const vars = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", note: "Supabase project URL" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", note: "service-role key (runs the no-login demo)" },
    { name: "OPENAI_API_KEY", note: "powers the live AI voice + analysis" },
  ];
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Compass className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Almost there</h1>
          <p className="text-sm text-muted-foreground">
            This demo is database-backed but no Supabase credentials are set in this
            environment. Add the variables below in your Vercel project
            (Settings → Environment Variables), then redeploy.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/40 p-4 text-left">
          <ul className="space-y-2 text-sm">
            {vars.map((v) => (
              <li key={v.name} className="flex flex-col">
                <code className="font-mono text-xs">{v.name}</code>
                <span className="text-xs text-muted-foreground">{v.note}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          The dashboard and tutorial open automatically once these are present.
        </p>
      </div>
    </div>
  );
}
