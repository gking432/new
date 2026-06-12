import { AppHeader } from "@/components/app/AppHeader";
import { AppSidebar } from "@/components/app/AppSidebar";
import { CallProvider } from "@/components/calls/CallProvider";
import { DemoGuideWidget } from "@/components/demo/DemoGuideWidget";
import { getCurrentProfile } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  // Notification badge counts (sidebar). Each refreshes via revalidatePath.
  const now = new Date().toISOString();
  const [draftsRes, overdueRes, followupRes] = await Promise.all([
    supabase
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .eq("direction", "outbound"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .lt("due_at", now),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("stage", "follow_up_needed"),
  ]);

  const badges: Record<string, number> = {
    "/app/inbox": draftsRes.count ?? 0,
    "/app/tasks": overdueRes.count ?? 0,
    "/app/follow-up": followupRes.count ?? 0,
  };

  return (
    <CallProvider>
      <div className="flex min-h-screen">
        <AppSidebar profile={profile} badges={badges} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader profile={profile} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
      <DemoGuideWidget audience="internal" />
    </CallProvider>
  );
}
