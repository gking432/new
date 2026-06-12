import Link from "next/link";
import { InboxView } from "@/components/inbox/InboxView";
import { getCommunications } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const supabase = await createClient();
  const communications = await getCommunications(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Omnichannel Inbox</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Forms, calls, texts, and emails in one place. Every AI-drafted outbound message waits
          here for human approval — in demo mode, sending is simulated. Try the{" "}
          <Link href="/app/demo-center" className="font-medium text-primary underline">
            Demo Center
          </Link>{" "}
          to generate inbound messages.
        </p>
      </div>
      <InboxView communications={communications} />
    </div>
  );
}
