"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
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
import type { LeadStage, LeadWithRelations } from "@/types/app";

export function PipelineBoard({ leads }: { leads: LeadWithRelations[] }) {
  const [collapsed, setCollapsed] = useState<Set<LeadStage>>(new Set());

  const byStage = new Map(LEAD_STAGES.map((stage) => [stage, [] as LeadWithRelations[]]));
  for (const lead of leads) {
    byStage.get(lead.stage)?.push(lead);
  }

  function toggle(stage: LeadStage) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 max-lg:flex-col">
      {LEAD_STAGES.map((stage) => {
        const stageLeads = byStage.get(stage) ?? [];
        const stageValue = stageLeads.reduce(
          (sum, lead) =>
            sum + estimatedValueMidpoint(lead.estimated_value_min, lead.estimated_value_max),
          0
        );
        const isCollapsed = collapsed.has(stage);
        const dotClass = STAGE_STYLES[stage].className
          .split(" ")[0]
          .replace("-100", "-500");

        if (isCollapsed) {
          return (
            <button
              key={stage}
              type="button"
              onClick={() => toggle(stage)}
              className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg border bg-secondary/40 py-3 transition-colors hover:bg-secondary max-lg:w-full max-lg:flex-row max-lg:px-3 max-lg:py-2"
              title={`Expand ${STAGE_STYLES[stage].label}`}
            >
              <ChevronsRight className="h-3.5 w-3.5 text-muted-foreground max-lg:rotate-90" />
              <span className={cn("inline-block h-2 w-2 rounded-full", dotClass)} />
              <span className="text-xs font-semibold [writing-mode:vertical-rl] max-lg:[writing-mode:horizontal-tb]">
                {STAGE_STYLES[stage].label}
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
                {stageLeads.length}
              </span>
            </button>
          );
        }

        return (
          <div key={stage} className="w-64 shrink-0 max-lg:w-full">
            <div className="mb-3 flex items-center justify-between gap-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", dotClass)} />
                <h3 className="truncate text-sm font-semibold">{STAGE_STYLES[stage].label}</h3>
                <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{formatMoney(stageValue)}</span>
                <button
                  type="button"
                  onClick={() => toggle(stage)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title={`Collapse ${STAGE_STYLES[stage].label}`}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>
              </div>
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
