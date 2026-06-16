import {
  ArrowRight,
  Bot,
  CalendarDays,
  Cable,
  CheckCircle2,
  Database,
  FileJson,
  Info,
  Mail,
  MessageSquareText,
  PhoneCall,
  PlugZap,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadSyncPanel } from "@/components/crm-sync/LeadSyncPanel";
import { HUBSPOT_FIELD_MAPPING } from "@/lib/integrations/hubspot/client";
import { getCrmConnection, getCrmSyncEvents } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatRelative } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const EVENT_STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  dry_run: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
  skipped: "bg-secondary text-muted-foreground",
};

const CONNECTORS = [
  {
    name: "HubSpot",
    type: "CRM",
    status: "Dry-run",
    icon: Database,
    detail: "Contacts, deals, notes, tasks, pipeline stage, owner, source.",
  },
  {
    name: "JobNimbus",
    type: "Home services CRM",
    status: "Ready",
    icon: Database,
    detail: "Lead, job, appointment, production handoff, activity history.",
  },
  {
    name: "ServiceTitan",
    type: "Field operations",
    status: "Ready",
    icon: Workflow,
    detail: "Customer, job, estimate, dispatch, and service notes.",
  },
  {
    name: "Twilio / OpenPhone",
    type: "Phone and SMS",
    status: "Simulated",
    icon: PhoneCall,
    detail: "Inbound calls, missed calls, SMS threads, call summaries.",
  },
  {
    name: "Google Calendar",
    type: "Scheduling",
    status: "Simulated",
    icon: CalendarDays,
    detail: "Estimator availability, booked inspections, reminder timing.",
  },
  {
    name: "Gmail / Outlook",
    type: "Email",
    status: "Simulated",
    icon: Mail,
    detail: "Email leads, customer replies, AI reply drafting, owner alerts.",
  },
  {
    name: "Zapier",
    type: "Automation",
    status: "Ready",
    icon: PlugZap,
    detail: "Fast no-code routing for forms, alerts, Sheets, and CRM updates.",
  },
  {
    name: "Make",
    type: "Automation",
    status: "Ready",
    icon: Workflow,
    detail: "Visual multi-step scenarios for lead routing and summaries.",
  },
  {
    name: "n8n",
    type: "Automation",
    status: "Ready",
    icon: Workflow,
    detail: "Self-hostable workflows for API-heavy or private data flows.",
  },
  {
    name: "Power Automate",
    type: "Microsoft stack",
    status: "Ready",
    icon: Workflow,
    detail: "Outlook, Teams, SharePoint, Excel, and approval workflows.",
  },
  {
    name: "QuickBooks",
    type: "Finance",
    status: "Ready",
    icon: Database,
    detail: "Won-job handoff, customer records, invoices, and job-cost checks.",
  },
  {
    name: "CompanyCam",
    type: "Photos",
    status: "Ready",
    icon: FileJson,
    detail: "Inspection photos, property notes, production documentation.",
  },
];

const INTEGRATION_ROUTES = [
  {
    name: "Web lead to AI scheduler",
    trigger: "Public form, Facebook lead, Angi lead, or website chat",
    route: "Normalize lead -> score urgency -> call or text -> book inspection -> write CRM note",
    systems: "Website, phone, SMS, calendar, CRM",
  },
  {
    name: "Inbound call to CRM record",
    trigger: "Known or unknown homeowner calls the office",
    route: "Transcribe -> extract fields -> create/update lead -> summarize -> create next task",
    systems: "Phone, AI notes, CRM, tasks",
  },
  {
    name: "Appointment confirmation",
    trigger: "Inspection is booked or moved",
    route: "Generate confirmation -> auto-send safe SMS or request approval -> log activity",
    systems: "Calendar, SMS, CRM activity timeline",
  },
  {
    name: "Estimate follow-up",
    trigger: "Estimate sent and no customer response",
    route: "Draft follow-up -> rotate channel -> alert rep on high-value jobs -> track result",
    systems: "CRM, email, SMS, manager digest",
  },
  {
    name: "Bad review escalation",
    trigger: "Negative sentiment from review, survey, email, or text",
    route: "Summarize issue -> assign manager task -> draft response -> track resolution",
    systems: "Reviews, inbox, tasks, reporting",
  },
];

const PAYLOAD_PREVIEWS = [
  {
    name: "Contact",
    icon: Database,
    payload: {
      firstName: "Jordan",
      lastName: "Avery",
      phone: "(414) 555-0123",
      email: "jordan@example.com",
      source: "Inbound call",
      crmOwner: "Sales queue",
    },
  },
  {
    name: "Deal / Job",
    icon: Workflow,
    payload: {
      service: "Storm damage",
      stage: "Appointment scheduled",
      urgency: "High",
      estimatedValue: "$14,000 - $32,000",
      appointment: "Today at 5:30 PM",
    },
  },
  {
    name: "AI note",
    icon: Bot,
    payload: {
      summary: "Homeowner reports worsening roof leak after storm. Inspection moved earlier.",
      nextAction: "Send updated confirmation SMS.",
      transcriptStored: true,
      confidence: "High",
    },
  },
  {
    name: "Task",
    icon: CheckCircle2,
    payload: {
      title: "Review and send appointment confirmation",
      priority: "High",
      dueDate: "Today",
      linkedLead: "Jordan Avery",
    },
  },
  {
    name: "Message",
    icon: MessageSquareText,
    payload: {
      channel: "SMS",
      status: "Needs approval or auto-send eligible",
      body: "Your appointment is confirmed for today at 5:30 PM.",
    },
  },
  {
    name: "Webhook",
    icon: Zap,
    payload: {
      target: "Zapier, Make, n8n, Power Automate, or custom API",
      event: "lead.appointment.updated",
      retryPolicy: "3 attempts with audit log",
    },
  },
];

function statusClass(status: string) {
  if (status === "Dry-run" || status === "Simulated") return "bg-blue-100 text-blue-800";
  if (status === "Ready") return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

export default async function CrmSyncPage() {
  const supabase = await createClient();
  const [connection, events, leadsRes] = await Promise.all([
    getCrmConnection(supabase),
    getCrmSyncEvents(supabase),
    supabase
      .from("leads")
      .select("id, first_name, last_name, service_type, stage, urgency")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const liveConfigured = process.env.ENABLE_HUBSPOT_LIVE_SYNC === "true" && Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN);
  const mode = liveConfigured ? "live" : "dry_run";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">CRM Sync and Integration Layer</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            This CRM is the demo workspace. The bigger idea is the AI integration layer: calls,
            texts, emails, notes, appointments, tasks, reports, and sync payloads can sit on top
            of an existing CRM, phone system, calendar, inbox, or automation platform.
          </p>
        </div>
        <Badge variant="secondary">Demo connectors and dry-run payloads</Badge>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>What is fake here?</AlertTitle>
        <AlertDescription>
          Connector tiles and workflow routes are sample portfolio data. The HubSpot dry run below
          builds and logs the same kind of payload a live integration would send, but it does not
          update any external system unless live sync is explicitly configured.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-4">
        {[
          {
            title: "Capture",
            body: "Calls, forms, texts, emails, reviews, and calendar updates enter one workflow.",
            icon: PhoneCall,
          },
          {
            title: "Understand",
            body: "AI extracts customer info, urgency, service type, notes, objections, and next action.",
            icon: Bot,
          },
          {
            title: "Route",
            body: "Rules decide whether to auto-send, ask for approval, create a task, or escalate.",
            icon: Workflow,
          },
          {
            title: "Write back",
            body: "Clean records sync to the CRM, inbox, calendar, task board, and reports.",
            icon: Database,
          },
        ].map((step, index, steps) => {
          const Icon = step.icon;
          return (
            <Card key={step.title}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  {index < steps.length - 1 ? (
                    <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
                  ) : null}
                </div>
                <p className="mt-4 text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="h-4 w-4 text-brand-gold" />
            Connector map
          </CardTitle>
          <CardDescription>
            Sample systems this AI layer could connect to through native APIs, webhooks, Zapier,
            Make, Power Automate, n8n, or custom middleware.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CONNECTORS.map((connector) => {
              const Icon = connector.icon;
              return (
                <div key={connector.name} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{connector.name}</p>
                        <p className="text-xs text-muted-foreground">{connector.type}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={statusClass(connector.status)}>
                      {connector.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {connector.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-primary" />
              Automation and middleware routes
            </CardTitle>
            <CardDescription>
              Fake route map showing how workflows could be implemented with Zapier, Make, n8n,
              Power Automate, or custom APIs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {INTEGRATION_ROUTES.map((route) => (
              <div key={route.name} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{route.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{route.trigger}</p>
                  </div>
                  <Badge variant="outline">{route.systems}</Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{route.route}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Integration guardrails
            </CardTitle>
            <CardDescription>
              Controls that matter when AI starts touching customer-facing systems.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Dry-run first: preview payloads before live writes.",
              "Human approval for high-risk or uncertain customer messages.",
              "Auto-send only for safe confirmations and appointment reminders.",
              "Retry, failure alerts, and audit logs for every webhook or API call.",
              "Role-based access for customer data, sync settings, and AI prompts.",
            ].map((item) => (
              <div key={item} className="flex gap-2.5 rounded-lg border p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connection status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cable className="h-4 w-4 text-primary" />
              Connection status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{connection?.name ?? "HubSpot"}</p>
                <p className="text-xs text-muted-foreground">
                  Provider: HubSpot · Private app token{" "}
                  {process.env.HUBSPOT_PRIVATE_APP_TOKEN ? "configured" : "not configured"}
                </p>
              </div>
              <Badge
                className={mode === "live" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}
                variant="secondary"
              >
                {mode === "live" ? "Live" : "Dry-run mode"}
              </Badge>
            </div>
            {mode === "dry_run" && (
              <p className="text-xs text-muted-foreground">
                External CRM sync is in dry-run mode: every sync builds the real payload, logs it
                below with mock HubSpot IDs, and touches nothing external. Add
                <code className="mx-1 rounded bg-secondary px-1 py-0.5">HUBSPOT_PRIVATE_APP_TOKEN</code>
                and set
                <code className="mx-1 rounded bg-secondary px-1 py-0.5">ENABLE_HUBSPOT_LIVE_SYNC=true</code>
                to sync for real.
              </p>
            )}
            {connection?.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                Last sync: {formatRelative(connection.last_sync_at)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Field mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Field mapping</CardTitle>
            <CardDescription>
              If a custom HubSpot property doesn&apos;t exist in the portal, the detail is carried
              in the note body instead of failing the sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local field</TableHead>
                  <TableHead>External CRM field</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HUBSPOT_FIELD_MAPPING.map((row) => (
                  <TableRow key={row.local}>
                    <TableCell className="font-mono text-xs">{row.local}</TableCell>
                    <TableCell className="font-mono text-xs">{row.external}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson className="h-4 w-4 text-primary" />
            Sample sync objects
          </CardTitle>
          <CardDescription>
            These fake payload cards show the objects the AI layer prepares before a CRM, webhook,
            or automation platform receives them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PAYLOAD_PREVIEWS.map((preview) => {
              const Icon = preview.icon;
              return (
                <div key={preview.name} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b px-4 py-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">{preview.name}</p>
                  </div>
                  <pre className="max-h-52 overflow-auto p-4 text-xs leading-relaxed text-muted-foreground">
                    {JSON.stringify(preview.payload, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <LeadSyncPanel leads={leadsRes.data ?? []} />

      {/* Sync events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sync events</CardTitle>
          <CardDescription>Every outbound sync attempt is logged — dry runs included.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sync events yet. Sync a lead above or run the HubSpot dry sync from the Demo
              Center.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{event.action.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm capitalize">{event.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{event.external_id ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={EVENT_STATUS_STYLES[event.status]} variant="secondary">
                        {event.status.replace(/_/g, " ")}
                      </Badge>
                      {event.error_message && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-red-600">
                          {event.error_message}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
