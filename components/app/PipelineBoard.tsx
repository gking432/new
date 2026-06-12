import Link from "next/link";
import { LeadStageSelect } from "@/components/app/LeadStageSelect";
import { UrgencyBadge } from "@/components/app/UrgencyBadge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  estimatedValueMidpoint,
  formatMoney,
  formatRelative,
  fullName,
} from "@/lib/utils/format";
import { LEAD_STAGES, SERVICE_LABELS, STAGE_STYLES } from "@/lib/utils/statuses";
import type { LeadWithRelations } from "@/types/app";

export function PipelineBoard({ leads }: { leads: LeadWithRelations[] }) {
  const byStage = new Map(LEAD_STAGES.map((stage) => [stage, [] as LeadWithRelations[]]));
  for (const lead of leads) {
    byStage.get(lead.stage)?.push(lead);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 max-lg:flex-col">
      {LEAD_STAGES.map((stage) => {
        const stageLeads = byStage.get(stage) ?? [];
        const stageValue = stageLeads.reduce(
          (sum, lead) =>
            sum + estimatedValueMidpoint(lead.estimated_value_min, lead.estimated_value_max),
          0
        );
        return (
          <div key={stage} className="w-72 shrink-0 max-lg:w-full">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    STAGE_STYLES[stage].className.split(" ")[0].replace("bg-", "bg-").replace("-100", "-500")
                  )}
                />
                <h3 className="text-sm font-semibold">{STAGE_STYLES[stage].label}</h3>
                <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatMoney(stageValue)}</span>
            </div>
            <div className="space-y-2">
              {stageLeads.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No leads
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <Card key={lead.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/app/leads/${lead.id}`}
                        className="min-w-0 font-medium hover:underline"
                      >
                        {fullName(lead.first_name, lead.last_name)}
                      </Link>
                      <UrgencyBadge urgency={lead.urgency} className="shrink-0" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SERVICE_LABELS[lead.service_type]} ·{" "}
                      {formatMoney(
                        estimatedValueMidpoint(lead.estimated_value_min, lead.estimated_value_max)
                      )}
                    </p>
                    {lead.analysis?.recommended_next_action ? (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {lead.analysis.recommended_next_action}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-muted-foreground">
                        {lead.assigned_profile?.full_name ?? "Unassigned"} ·{" "}
                        {formatRelative(lead.updated_at)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <LeadStageSelect leadId={lead.id} stage={lead.stage} size="sm" />
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
