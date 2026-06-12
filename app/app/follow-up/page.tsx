import { FollowupComposer } from "@/components/app/FollowupComposer";
import { getLeads } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  const supabase = await createClient();
  const leads = await getLeads(supabase);

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
