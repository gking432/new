import Link from "next/link";
import { CalendarDays, Cable, Calculator, MessageSquareText, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallLauncher } from "@/components/calls/CallLauncher";
import { SyncLeadButton } from "@/components/crm-sync/SyncLeadButton";
import { formatRelative } from "@/lib/utils/format";
import { formatDemoDateTime } from "@/lib/utils/demoTime";
import type {
  Appointment,
  CallWithRelations,
  Communication,
  CrmSyncEvent,
  Lead,
  QuoteEstimate,
} from "@/types/app";

/** Phase 2 cards for the lead detail page: calls, comms, appointments, quote, CRM sync. */
export function LeadPhase2Cards({
  lead,
  calls,
  communications,
  appointments,
  quote,
  syncEvents,
  section = "all",
}: {
  lead: Lead;
  calls: CallWithRelations[];
  communications: Communication[];
  appointments: Appointment[];
  quote: QuoteEstimate | null;
  syncEvents: CrmSyncEvent[];
  section?: "all" | "operations" | "intelligence";
}) {
  const lastCall = calls.find((c) => c.summary) ?? calls[0] ?? null;
  const upcomingAppointment = appointments.find(
    (a) => a.status !== "cancelled" && new Date(a.start_time) >= new Date()
  );
  const showOperations = section === "all" || section === "operations";
  const showIntelligence = section === "all" || section === "intelligence";

  return (
    <>
      {/* Calls */}
      {showOperations && (
      <Card data-tour="lead-calls-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4 text-primary" />
            Calls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lastCall?.summary ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Last call · {formatRelative(lastCall.created_at)}
              </p>
              <p className="mt-1 text-sm">{lastCall.summary.crm_note}</p>
              {lastCall.summary.next_action && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Next: {lastCall.summary.next_action}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No calls logged yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {lastCall && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/calls/${lastCall.id}`}>View call & transcript</Link>
              </Button>
            )}
            <CallLauncher
              scenario="existing_customer_call"
              leadId={lead.id}
              callerName={`${lead.first_name} ${lead.last_name}`}
              callerPhone={lead.phone}
              subtitle={`${lead.service_type.replace(/_/g, " ")} lead`}
              direction="inbound"
              buttonLabel="Simulate customer callback"
              buttonVariant="outline"
              buttonSize="sm"
              crmContext={[
                { label: "Stage", value: lead.stage.replace(/_/g, " ") },
                { label: "Urgency", value: lead.urgency },
                { label: "Service", value: lead.service_type.replace(/_/g, " ") },
                { label: "Active leak", value: lead.active_leak ?? "unknown" },
              ]}
            />
          </div>
        </CardContent>
      </Card>
      )}

      {/* Appointments */}
      {showOperations && appointments.length > 0 && (
        <Card data-tour="lead-appointments-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.slice(0, 3).map((appt) => (
              <div key={appt.id} className="rounded-md border p-2.5 text-sm">
                <p className="font-medium capitalize">{appt.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDemoDateTime(new Date(appt.start_time), {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })} · {appt.status}
                  {appt.source === "ai_call" ? " · booked by AI call" : ""}
                </p>
              </div>
            ))}
            {!upcomingAppointment && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/app/appointments">Book a new time</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Communications */}
      {showOperations && communications.length > 0 && (
        <Card data-tour="lead-communications-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4 text-primary" />
              Communications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {communications.slice(0, 4).map((comm) => (
              <div key={comm.id} className="rounded-md border p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {comm.channel} · {comm.direction}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {comm.status === "approved" && comm.scheduled_send_at
                      ? "scheduled"
                      : comm.status.replace(/_/g, " ")}
                  </Badge>
                  {comm.ai_generated && !comm.human_approved && (
                    <Badge variant="outline" className="text-[10px]">
                      needs approval
                    </Badge>
                  )}
                  {comm.scheduled_send_at && (
                    <Badge variant="outline" className="text-[10px]">
                      {formatRelative(comm.scheduled_send_at)}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm">{comm.body}</p>
              </div>
            ))}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/inbox?lead=${lead.id}`}>Open Inbox</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quote intelligence */}
      {showIntelligence && (
      <Card data-tour="lead-quote-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4 text-primary" />
            Quote intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quote ? (
            <div className="rounded-lg border p-3">
              <p className="text-lg font-semibold tracking-tight">
                ${Number(quote.estimate_low).toLocaleString()} – $
                {Number(quote.estimate_high).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Internal ballpark · {quote.confidence} confidence ·{" "}
                {formatRelative(quote.created_at)}
              </p>
              {quote.missing_info.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Missing: {quote.missing_info.join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No internal ballpark yet — not a final quote either way.
            </p>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/quote-tool?lead=${lead.id}`}>Open Quote Tool</Link>
          </Button>
        </CardContent>
      </Card>
      )}

      {/* CRM sync */}
      {showIntelligence && (
      <Card data-tour="lead-crm-sync-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cable className="h-4 w-4 text-primary" />
            CRM sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {syncEvents.length > 0 ? (
            <div className="rounded-md border p-2.5 text-sm">
              <p className="font-medium">
                Last sync: {syncEvents[0].status === "dry_run" ? "dry run" : syncEvents[0].status}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {syncEvents[0].action.replace(/_/g, " ")} ·{" "}
                {formatRelative(syncEvents[0].created_at)}
                {syncEvents[0].external_id ? ` · ${syncEvents[0].external_id}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not synced to an external CRM yet. Dry-run mode shows the exact payload without
              touching anything.
            </p>
          )}
          <SyncLeadButton leadId={lead.id} />
        </CardContent>
      </Card>
      )}
    </>
  );
}
