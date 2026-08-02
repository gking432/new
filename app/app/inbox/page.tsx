import Link from "next/link";
import { InboxView } from "@/components/inbox/InboxView";
import { runDueScheduledReminders } from "@/lib/communications/reminders";
import { getCommunications } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalCommunications } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; tab?: string }>;
}) {
  const { lead, tab } = await searchParams;
  let communications;
  if (isLocalDemoMode()) {
    communications = await getLocalCommunications();
  } else {
    const supabase = await createClient();
    await runDueScheduledReminders(supabase);
    communications = await getCommunications(supabase);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Omnichannel Inbox</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Forms, calls, texts, and emails in one place. Automatic follow-up drafts wait for
          approval, while normal email and SMS threads stay in Conversations. Try the{" "}
          <Link href="/app/demo-center" className="font-medium text-primary underline">
            Demo Center
          </Link>{" "}
          to generate inbound messages.
        </p>
      </div>
      <InboxView communications={communications} initialLeadId={lead} initialTab={tab} />
    </div>
  );
}
