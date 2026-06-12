import { Bot, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/format";
import type { CallSummary } from "@/types/app";

export function CallSummaryCard({ summary }: { summary: CallSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" />
          AI Call Summary
        </CardTitle>
        <CardDescription>{formatDateTime(summary.created_at)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">CRM note</p>
          <p className="mt-1 text-sm">{summary.crm_note}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {summary.service_type && (
            <Badge variant="secondary">{summary.service_type.replace(/_/g, " ")}</Badge>
          )}
          {summary.urgency && <Badge variant="secondary">urgency: {summary.urgency}</Badge>}
          {summary.lead_quality && <Badge variant="secondary">{summary.lead_quality} lead</Badge>}
          {summary.customer_intent && <Badge variant="outline">{summary.customer_intent}</Badge>}
        </div>

        {summary.appointment_requested && (
          <p className="flex items-center gap-2 text-sm">
            <CalendarCheck className="h-4 w-4 text-status-success" />
            Appointment requested
            {summary.appointment_time ? ` — ${formatDateTime(summary.appointment_time)}` : ""}
          </p>
        )}

        {summary.next_action && (
          <p className="text-sm">
            <span className="font-medium">Next action:</span> {summary.next_action}
          </p>
        )}

        {summary.objections.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Objections / concerns
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              {summary.objections.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        {Object.values(summary.extracted_fields ?? {}).some(Boolean) && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Extracted fields
            </p>
            <dl className="mt-1.5 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {Object.entries(summary.extracted_fields)
                .filter(([, v]) => v)
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 border-b py-1">
                    <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
