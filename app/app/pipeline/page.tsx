import { PipelineBoard } from "@/components/app/PipelineBoard";
import { getLeads } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import type { LeadAnalysis, LeadWithRelations } from "@/types/app";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalLeads } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  if (isLocalDemoMode()) {
    const leads = await getLocalLeads();
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Move leads between stages with the selector on each card. Stage changes are logged to the
          lead timeline and can trigger automations.
        </p>
        <PipelineBoard leads={leads} />
      </div>
    );
  }
  const supabase = await createClient();
  const leads = await getLeads(supabase);

  // Attach the latest recommended next action to each card.
  const { data: analyses } = await supabase
    .from("lead_ai_analyses")
    .select("lead_id, recommended_next_action, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const actionByLead = new Map<string, string>();
  for (const analysis of (analyses ?? []) as Pick<
    LeadAnalysis,
    "lead_id" | "recommended_next_action" | "created_at"
  >[]) {
    if (!actionByLead.has(analysis.lead_id) && analysis.recommended_next_action) {
      actionByLead.set(analysis.lead_id, analysis.recommended_next_action);
    }
  }

  const enriched: LeadWithRelations[] = leads.map((lead) => ({
    ...lead,
    analysis: actionByLead.has(lead.id)
      ? ({ recommended_next_action: actionByLead.get(lead.id) } as LeadAnalysis)
      : null,
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Move leads between stages with the selector on each card. Stage changes are logged to the
        lead timeline and can trigger automations (for example, the estimate follow-up rule).
      </p>
      <PipelineBoard leads={enriched} />
    </div>
  );
}
