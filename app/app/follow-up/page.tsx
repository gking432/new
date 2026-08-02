import { FollowupComposer } from "@/components/app/FollowupComposer";
import { getLeads } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalLeads } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const leads = isLocalDemoMode() ? await getLocalLeads() : await getLeads(await createClient());

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Generate customer communication drafts grounded in the lead&apos;s details and AI analysis.
        Every draft is editable, labeled as AI-generated, and saved to the lead&apos;s history —
        nothing is sent automatically.
      </p>
      <FollowupComposer leads={leads} />
    </div>
  );
}
