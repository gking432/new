import { AppHeader } from "@/components/app/AppHeader";
import { AppSidebar } from "@/components/app/AppSidebar";
import { CallProvider } from "@/components/calls/CallProvider";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { SetupNotice } from "@/components/app/SetupNotice";
import { getCurrentProfile } from "@/lib/db/queries";
import { createClient, isAppConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // No-login demo: with no Supabase keys there's no database to read, so show a
  // clear setup notice instead of crashing on a missing client.
  if (!isAppConfigured()) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  const endOfTomorrow = new Date();
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);

  // Notification badge counts (sidebar). Each refreshes via revalidatePath.
  const [openTasksRes, inboxAttentionRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .not("due_at", "is", null)
      .lte("due_at", endOfTomorrow.toISOString()),
    supabase
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .eq("status", "received")
      .contains("metadata", { needs_attention: true }),
  ]);

  const badges: Record<string, number> = {
    "/app/inbox": inboxAttentionRes.count ?? 0,
    "/app/tasks": openTasksRes.count ?? 0,
  };

  return (
    <CallProvider>
      <div className="flex min-h-screen" data-app-main>
        <AppSidebar profile={profile} badges={badges} />
        <div className="flex min-w-0 flex-1 flex-col" data-app-content>
          <AppHeader profile={profile} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
      <TutorialProvider />
    </CallProvider>
  );
}
