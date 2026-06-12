import { AppHeader } from "@/components/app/AppHeader";
import { AppSidebar } from "@/components/app/AppSidebar";
import { getCurrentProfile } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  return (
    <div className="flex min-h-screen">
      <AppSidebar profile={profile} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader profile={profile} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
