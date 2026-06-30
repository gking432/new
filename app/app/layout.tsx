import { AppHeader } from "@/components/app/AppHeader";
import { AppSidebar } from "@/components/app/AppSidebar";
import { CallProvider } from "@/components/calls/CallProvider";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { SetupNotice } from "@/components/app/SetupNotice";
import { isAppConfigured } from "@/lib/supabase/server";
import type { Profile } from "@/types/app";

const DEMO_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000001",
  full_name: "Dana Whitfield",
  role: "admin",
  avatar_url: null,
  created_at: "",
  updated_at: "",
};

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // No-login demo: with no Supabase keys there's no database to read, so show a
  // clear setup notice instead of crashing on a missing client.
  if (!isAppConfigured()) {
    return <SetupNotice />;
  }

  return (
    <CallProvider>
      <div className="flex min-h-screen" data-app-main>
        <AppSidebar profile={DEMO_PROFILE} badges={{}} />
        <div className="flex min-w-0 flex-1 flex-col" data-app-content>
          <AppHeader profile={DEMO_PROFILE} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
      <TutorialProvider />
    </CallProvider>
  );
}
