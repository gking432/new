import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QualityBadge } from "@/components/app/QualityBadge";
import { UrgencyBadge } from "@/components/app/UrgencyBadge";
import { SERVICE_LABELS } from "@/lib/utils/statuses";
import { formatRelative, fullName } from "@/lib/utils/format";
import type { LeadWithRelations } from "@/types/app";

export function LeadPriorityQueue({ leads }: { leads: LeadWithRelations[] }) {
  if (leads.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No open leads right now. New requests will appear here, ranked by urgency.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {leads.map((lead) => (
        <li key={lead.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{fullName(lead.first_name, lead.last_name)}</span>
              <span className="text-sm text-muted-foreground">
                {SERVICE_LABELS[lead.service_type]}
              </span>
              <UrgencyBadge urgency={lead.urgency} />
              <QualityBadge quality={lead.lead_quality} />
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {lead.analysis?.recommended_next_action ??
                "No AI recommendation yet — open the lead to run analysis."}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Submitted {formatRelative(lead.created_at)}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/leads/${lead.id}`}>
              Open Lead
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
