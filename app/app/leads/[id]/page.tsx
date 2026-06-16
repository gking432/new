import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Bot } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ActivityTimeline } from "@/components/app/ActivityTimeline";
import { LeadLiveCallPanel } from "@/components/app/LeadLiveCallPanel";
import { LeadPhase2Cards } from "@/components/app/LeadPhase2Cards";
import { LeadAssignSelect } from "@/components/app/LeadAssignSelect";
import { LeadStageSelect } from "@/components/app/LeadStageSelect";
import { QualityBadge } from "@/components/app/QualityBadge";
import { UrgencyBadge } from "@/components/app/UrgencyBadge";
import { getLeadDetail, getProfiles } from "@/lib/db/queries";
import { getLeadPhase2 } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoneyRange, fullName } from "@/lib/utils/format";
import {
  BUDGET_LABELS,
  PROJECT_REASON_LABELS,
  SERVICE_LABELS,
  SOURCE_LABELS,
  TIMEFRAME_LABELS,
  labelFor,
} from "@/lib/utils/statuses";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [lead, profiles, phase2] = await Promise.all([
    getLeadDetail(supabase, id),
    getProfiles(supabase),
    getLeadPhase2(supabase, id),
  ]);

  if (!lead) notFound();
  const analysis = lead.analysis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {fullName(lead.first_name, lead.last_name)}
            </h2>
            <Badge variant="secondary">{SERVICE_LABELS[lead.service_type]}</Badge>
            <UrgencyBadge urgency={lead.urgency} />
            <QualityBadge quality={lead.lead_quality} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Est. {formatMoneyRange(lead.estimated_value_min, lead.estimated_value_max)} ·
            Created {formatDate(lead.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LeadAssignSelect leadId={lead.id} assignedTo={lead.assigned_to} profiles={profiles} />
          <LeadStageSelect leadId={lead.id} stage={lead.stage} />
        </div>
      </div>

      {lead.ai_status === "failed" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Rule-based analysis</AlertTitle>
          <AlertDescription>
            This lead is using a deterministic demo analysis. Re-run AI Analysis when you want to
            replace it with a live model-generated review.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: customer details */}
        <div className="space-y-6">
          <Card data-tour="lead-customer-card">
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <DetailRow label="Email" value={lead.email ?? "—"} />
                <DetailRow label="Phone" value={lead.phone ?? "—"} />
                <DetailRow
                  label="Prefers"
                  value={`${lead.preferred_contact_method ?? "—"}${
                    lead.best_time_to_contact ? `, ${lead.best_time_to_contact}` : ""
                  }`}
                />
                <DetailRow
                  label="Address"
                  value={
                    lead.street_address
                      ? `${lead.street_address}, ${lead.city ?? ""} ${lead.state ?? ""} ${lead.zip_code ?? ""}`
                      : "—"
                  }
                />
                <DetailRow label="Homeowner" value={lead.homeowner_status?.replace(/_/g, " ") ?? "—"} />
                {lead.secondary_contact ? (
                  <DetailRow
                    label="Secondary contact"
                    value={
                      <span>
                        {fullName(
                          lead.secondary_contact.first_name ?? "",
                          lead.secondary_contact.last_name ?? ""
                        )}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {[lead.secondary_contact.phone, lead.secondary_contact.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    }
                  />
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card data-tour="lead-request-card">
            <CardHeader>
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <DetailRow label="Service" value={SERVICE_LABELS[lead.service_type]} />
                <DetailRow label="Reason" value={labelFor(PROJECT_REASON_LABELS, lead.project_reason)} />
                <DetailRow label="Timeframe" value={labelFor(TIMEFRAME_LABELS, lead.timeframe)} />
                <DetailRow label="Budget" value={labelFor(BUDGET_LABELS, lead.budget_range)} />
                <DetailRow label="Insurance claim" value={lead.insurance_started?.replace(/_/g, " ") ?? "—"} />
                <DetailRow
                  label="Active leak"
                  value={
                    lead.active_leak === "yes" ? (
                      <span className="font-semibold text-status-urgent">Yes</span>
                    ) : (
                      lead.active_leak ?? "—"
                    )
                  }
                />
                <DetailRow label="Source" value={labelFor(SOURCE_LABELS, lead.source)} />
              </dl>
              <Separator className="my-3" />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Homeowner message
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{lead.description}</p>
            </CardContent>
          </Card>

        </div>

        {/* Center: live call → timeline (prominent) → AI analysis */}
        <div className="space-y-6">
          <LeadLiveCallPanel leadId={lead.id} />

          <Card data-tour="lead-timeline">
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>
                Every touchpoint — and where you can log a note by hand.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline leadId={lead.id} activities={lead.activities ?? []} />
            </CardContent>
          </Card>

        </div>
          </div>

        <Card data-tour="lead-analysis">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              AI Lead Analysis
            </CardTitle>
            {analysis ? (
              <CardDescription>
                {lead.ai_status === "completed" ? "AI review" : "Automated review"} ·{" "}
                {formatDate(analysis.created_at)}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!analysis ? (
              <p className="text-sm text-muted-foreground">
                No analysis yet. The next completed call or request will create one automatically.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-sm">{analysis.summary}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Urgency reasoning
                    </p>
                    <p className="mt-1 text-sm">{analysis.urgency_reasoning}</p>
                  </div>
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Quality reasoning
                    </p>
                    <p className="mt-1 text-sm">{analysis.lead_quality_reasoning}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    Recommended next action
                  </p>
                  <p className="mt-1 text-sm font-medium">{analysis.recommended_next_action}</p>
                  {analysis.recommended_contact_window ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Contact window: {analysis.recommended_contact_window}
                    </p>
                  ) : null}
                </div>
                {analysis.sales_questions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Key sales questions
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {analysis.sales_questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.potential_objections.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Potential objections
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {analysis.potential_objections.map((objection) => (
                        <li key={objection}>{objection}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.recommended_service_angle ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Recommended service angle
                    </p>
                    <p className="mt-1 text-sm">{analysis.recommended_service_angle}</p>
                  </div>
                ) : null}
                {analysis.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Right: action panel and related work */}
        <div className="space-y-6">
          {(lead.tasks?.length ?? 0) > 0 && (
            <Card data-tour="lead-open-tasks">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Open tasks</span>
                  <Badge className="bg-red-500 text-white">
                    {
                      lead.tasks!.filter(
                        (task) => task.status === "open" || task.status === "in_progress"
                      ).length
                    }
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {lead.tasks!
                    .filter((task) => task.status === "open" || task.status === "in_progress")
                    .map((task) => (
                      <li key={task.id}>
                        <Link
                          href={`/app/tasks?task=${task.id}`}
                          className="block rounded-md border p-2.5 text-sm transition-colors hover:bg-secondary/70"
                        >
                        <p className="font-medium">{task.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {task.priority} · {task.type?.replace(/_/g, " ")}
                        </p>
                        </Link>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {(lead.followups?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Follow-up history</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {lead.followups!.slice(0, 5).map((followup) => (
                    <li key={followup.id} className="rounded-md border p-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {followup.type.replace(/_/g, " ")} · {formatDate(followup.created_at)}
                      </p>
                      <p className="mt-1 line-clamp-3 text-sm">{followup.body}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <LeadPhase2Cards
            lead={lead}
            calls={phase2.calls}
            communications={phase2.communications}
            appointments={phase2.appointments}
            quote={phase2.quote}
            syncEvents={phase2.syncEvents}
            section="operations"
          />
          <LeadPhase2Cards
            lead={lead}
            calls={phase2.calls}
            communications={phase2.communications}
            appointments={phase2.appointments}
            quote={phase2.quote}
            syncEvents={phase2.syncEvents}
            section="intelligence"
          />
        </div>

      </div>
    </div>
  );
}
