"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FlaskConical,
  Inbox,
  Loader2,
  PlugZap,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AutomationRuleCard } from "@/components/app/AutomationRuleCard";
import { ReminderAutomationCard } from "@/components/app/ReminderAutomationCard";
import { runAiAutomationModuleTest, sendIntegrationWebhookTest } from "@/lib/actions";
import type { AiWorkflowModule, AiWorkflowModuleId, ModuleRunOutput } from "@/lib/ai-workflows/types";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";
import { SERVICE_LABELS } from "@/lib/utils/statuses";
import type { AutomationRule, AutomationRun, CrmSyncEvent, Lead } from "@/types/app";

type LeadOption = Pick<
  Lead,
  "id" | "first_name" | "last_name" | "service_type" | "stage" | "urgency" | "lead_quality"
>;

interface AiAutomationsCenterProps {
  modules: AiWorkflowModule[];
  leads: LeadOption[];
  rules: AutomationRule[];
  runs: AutomationRun[];
  scheduledReminderCount: number;
  dueReminderCount: number;
  pendingApprovalCount: number;
  dryRunSyncCount: number;
  syncEvents: CrmSyncEvent[];
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  draft: "bg-amber-100 text-amber-800 border-amber-200",
  disabled: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-green-100 text-green-800 border-green-200",
  skipped: "bg-gray-100 text-gray-700 border-gray-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  dry_run: "bg-blue-100 text-blue-800 border-blue-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
};

const DESTINATION_ICONS: Record<string, typeof Database> = {
  internal_crm: Database,
  approval_queue: Inbox,
  quote_tool: ClipboardList,
  external_webhook: PlugZap,
  docs_only: Code2,
};

function leadLabel(lead: LeadOption) {
  return `${lead.first_name} ${lead.last_name}`;
}

function moduleRunName(run: AutomationRun, ruleNames: Map<string, string>) {
  if (run.rule_id) return ruleNames.get(run.rule_id) ?? "Automation rule";
  const workflowLine = run.actions_taken.find((item) => item.startsWith("Workflow: "));
  return workflowLine?.replace("Workflow: ", "") ?? "AI workflow module";
}

function runDestination(run: AutomationRun) {
  const text = run.actions_taken.join(" ").toLowerCase();
  if (text.includes("approval")) return "Approval queue";
  if (text.includes("webhook")) return "Webhook dry run";
  if (text.includes("quote")) return "Quote Tool";
  if (text.includes("manager")) return "Internal task";
  return "Internal CRM";
}

function approvalStatus(run: AutomationRun) {
  const text = run.actions_taken.join(" ").toLowerCase();
  if (text.includes("approval item")) return "Waiting in Inbox";
  if (text.includes("no external message")) return "Draft only";
  if (text.includes("not required")) return "Not required";
  return "Internal only";
}

function payloadExample() {
  return JSON.stringify(
    {
      eventType: "lead.created",
      source: "external_crm",
      payload: {
        name: "Sarah Mitchell",
        email: "sarah@example.com",
        phone: "414-555-0188",
        serviceType: "roofing",
        message: "We had hail last night and now water is coming in upstairs.",
      },
    },
    null,
    2
  );
}

function curlExample() {
  return `curl -X POST http://localhost:3000/api/demo/webhook/lead-created \\
  -H "Content-Type: application/json" \\
  -d '${payloadExample().replace(/\n/g, " ")}'`;
}

export function AiAutomationsCenter({
  modules,
  leads,
  rules,
  runs,
  scheduledReminderCount,
  dueReminderCount,
  pendingApprovalCount,
  dryRunSyncCount,
  syncEvents,
}: AiAutomationsCenterProps) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.id ?? "");
  const [runningModuleId, setRunningModuleId] = useState<AiWorkflowModuleId | null>(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [lastOutput, setLastOutput] = useState<ModuleRunOutput | null>(null);
  const [pending, startTransition] = useTransition();
  const ruleNames = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.name])), [rules]);
  const activeModules = modules.filter((module) => module.status === "active").length;
  const hasLeads = leads.length > 0;

  useEffect(() => {
    if (!selectedLeadId && leads[0]?.id) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  async function createSampleLead() {
    setCreatingLead(true);
    const response = await fetch("/api/demo/webhook/lead-created", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "lead.created",
        source: "external_crm",
        payload: {
          name: "Sarah Mitchell",
          email: "sarah@example.com",
          phone: "414-555-0188",
          serviceType: "roofing",
          message: "We had hail last night and now water is coming in upstairs.",
        },
      }),
    });
    setCreatingLead(false);

    const data = (await response.json().catch(() => null)) as { leadId?: string; error?: string } | null;
    if (!response.ok) {
      toast.error(data?.error ?? "Could not create sample lead");
      return;
    }

    if (data?.leadId) {
      setSelectedLeadId(data.leadId);
    }
    toast.success("Sample lead created and Lead Intake Analysis logged");
    router.refresh();
  }

  function runModule(moduleId: AiWorkflowModuleId) {
    setRunningModuleId(moduleId);
    startTransition(async () => {
      const result = await runAiAutomationModuleTest({
        moduleId,
        leadId: selectedLeadId || undefined,
      });
      setRunningModuleId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setLastOutput(result.data ?? null);
      const approval = result.data?.approvalCommunicationId ? " Approval draft created." : "";
      toast.success(`Workflow test complete.${approval}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">AI Automations Center</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            This CRM includes an AI automation layer. Workflows can run inside the CRM, create
            approval-gated drafts, prepare estimator context, or show the webhook payload a
            Zapier/n8n workflow would receive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Internal CRM automation is active</Badge>
          <Badge variant="outline">External sends are demo/dry-run</Badge>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Honest demo boundary</AlertTitle>
        <AlertDescription>
          AI workflow tests write real demo records inside this CRM, including run logs, tasks,
          activity notes, and approval drafts. They do not send real SMS, email, or external
          webhook messages.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "AI modules",
            value: `${activeModules}/${modules.length}`,
            detail: "Active workflow modules",
            icon: Sparkles,
          },
          {
            label: "Approval queue",
            value: pendingApprovalCount,
            detail: "Drafts waiting for human review",
            icon: Inbox,
            href: "/app/inbox?tab=approvals",
          },
          {
            label: "Workflow logs",
            value: runs.length,
            detail: "Recent automation run records",
            icon: Workflow,
          },
          {
            label: "Dry-run syncs",
            value: dryRunSyncCount,
            detail: "Inspectable CRM payloads",
            icon: FileJson,
            href: "/app/crm-sync",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          const content = (
            <Card className={cn(stat.href && "transition-colors hover:border-primary/40")}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.detail}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              {content}
            </Link>
          ) : (
            <div key={stat.label}>{content}</div>
          );
        })}
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="integrations">Integration Lab</TabsTrigger>
          <TabsTrigger value="modules">Workflow modules</TabsTrigger>
          <TabsTrigger value="logs">Run log</TabsTrigger>
          <TabsTrigger value="rules">Internal rules</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <IntegrationGuide
            leads={leads}
            selectedLeadId={selectedLeadId}
            onSelectLead={setSelectedLeadId}
            onCreateSampleLead={createSampleLead}
            creatingLead={creatingLead}
            syncEvents={syncEvents}
          />
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          {!hasLeads ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Create a lead first</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  Workflow tests run against CRM lead data, and this demo is currently empty.
                  Create a sample webhook lead here, or submit a lead through the normal demo flow.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={createSampleLead} disabled={creatingLead}>
                    {creatingLead ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FlaskConical className="h-3.5 w-3.5" />
                    )}
                    Create sample lead
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/app/demo-center">Open Demo Center</Link>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-72 flex-1">
                <p className="text-sm font-medium">Run tests against existing CRM lead data</p>
                <p className="text-xs text-muted-foreground">
                  Pick a lead, then run any module below. The test creates auditable demo records.
                </p>
              </div>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  {hasLeads
                    ? leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {leadLabel(lead)} · {SERVICE_LABELS[lead.service_type] ?? lead.service_type}
                        </SelectItem>
                      ))
                    : null}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {modules.map((module) => {
              const Icon = DESTINATION_ICONS[module.destination] ?? Bot;
              const running = pending && runningModuleId === module.id;
              return (
                <Card key={module.id} className={module.status === "disabled" ? "opacity-70" : undefined}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Icon className="h-4 w-4 text-primary" />
                          {module.name}
                        </CardTitle>
                        <CardDescription className="mt-1">{module.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className={STATUS_STYLES[module.status]}>
                        {module.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <InfoBlock label="Trigger" value={module.trigger} />
                      <InfoBlock label="Output" value={module.output} />
                      <InfoBlock label="Approval" value={module.approval} />
                      <InfoBlock label="Destination" value={module.destinationLabel} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                      <Badge variant="secondary" className="text-xs">
                        {module.destination === "external_webhook"
                          ? "Webhook-ready docs"
                          : "Built-in demo workflow"}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => runModule(module.id)}
                        disabled={!selectedLeadId || running || module.status === "disabled"}
                      >
                        {running ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FlaskConical className="h-3.5 w-3.5" />
                        )}
                        {!selectedLeadId ? "Create a lead first" : module.runTestLabel ?? "Run test"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {lastOutput ? <LastOutputCard output={lastOutput} /> : null}
        </TabsContent>

        <TabsContent value="logs">
          <RunLogCard runs={runs} ruleNames={ruleNames} />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <ReminderAutomationCard
            scheduledCount={scheduledReminderCount}
            dueCount={dueReminderCount}
          />
          <div className="grid gap-4">
            {rules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No automation rules found. Run the seed migration to install the default rules.
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => <AutomationRuleCard key={rule.id} rule={rule} />)
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 leading-relaxed">{value}</p>
    </div>
  );
}

function LastOutputCard({ output }: { output: ModuleRunOutput }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-status-success" />
          Last test output
        </CardTitle>
        <CardDescription>
          {output.lead.name} · {SERVICE_LABELS[output.lead.serviceType] ?? output.lead.serviceType}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          {output.actionsTaken.map((action) => (
            <div key={action} className="flex gap-2 rounded-md border bg-background p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
              <span>{action}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {output.approvalCommunicationId ? (
              <Button asChild size="sm">
                <Link href="/app/inbox?tab=approvals">
                  Open approval queue
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
            {output.quoteToolHref ? (
              <Button asChild size="sm" variant="outline">
                <Link href={output.quoteToolHref}>
                  Open Quote Tool
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <pre className="max-h-80 overflow-auto rounded-md border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(
            {
              analysis: output.analysis,
              followUp: output.followUp,
              quotePrep: output.quotePrep,
              managerAlert: output.managerAlert,
              crmSuggestions: output.crmSuggestions,
              webhookPayload: output.webhookPayload,
            },
            null,
            2
          )}
        </pre>
      </CardContent>
    </Card>
  );
}

function RunLogCard({
  runs,
  ruleNames,
}: {
  runs: AutomationRun[];
  ruleNames: Map<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Workflow className="h-4 w-4 text-primary" />
          Workflow run log
        </CardTitle>
        <CardDescription>
          Every test or rule evaluation is logged so the demo explains what happened, what it
          touched, and whether approval was involved.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No automation runs yet. Submit a lead or run a workflow module test.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Related lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(run.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{moduleRunName(run, ruleNames)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.trigger_event.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {run.lead ? (
                      <Link href={`/app/leads/${run.lead.id}`} className="hover:underline">
                        {run.lead.first_name} {run.lead.last_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLES[run.status]}>
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{runDestination(run)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{approvalStatus(run)}</TableCell>
                  <TableCell className="min-w-48">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-primary">
                        View details
                      </summary>
                      <div className="mt-2 space-y-1 rounded-md border bg-secondary/30 p-3">
                        {run.actions_taken.length > 0 ? (
                          run.actions_taken.map((action, index) => (
                            <p key={`${run.id}-${index}`} className="text-xs text-muted-foreground">
                              {action}
                            </p>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {run.error_message ?? "Conditions not met."}
                          </p>
                        )}
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationGuide({
  leads,
  selectedLeadId,
  onSelectLead,
  onCreateSampleLead,
  creatingLead,
  syncEvents,
}: {
  leads: LeadOption[];
  selectedLeadId: string;
  onSelectLead: (leadId: string) => void;
  onCreateSampleLead: () => void;
  creatingLead: boolean;
  syncEvents: CrmSyncEvent[];
}) {
  const router = useRouter();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [lastWebhookResult, setLastWebhookResult] = useState<{
    status: "dry_run" | "success" | "failed";
    payload: Record<string, unknown>;
    responseStatus?: number;
    responsePreview?: string;
  } | null>(null);
  const [sendingWebhook, startWebhookTransition] = useTransition();
  const hasLeads = leads.length > 0;
  const statuses = [
    {
      name: "Internal CRM",
      status: "Built-in",
      body: "Records created in this CRM can trigger AI workflows directly.",
      icon: Database,
    },
    {
      name: "Zapier",
      status: "Webhook-ready",
      body: "Use Webhooks by Zapier to send leads, forms, or CRM updates into the automation layer.",
      icon: PlugZap,
    },
    {
      name: "n8n",
      status: "Webhook-ready",
      body: "Use an n8n Webhook trigger plus HTTP Request node to call the same workflow pattern.",
      icon: Workflow,
    },
    {
      name: "External CRM",
      status: "Conceptual",
      body: "Any CRM with webhooks/API calls could send lead.created or appointment.scheduled events.",
      icon: Code2,
    },
  ];

  const recipes = [
    {
      title: "External CRM/Form -> Northstar",
      tool: "Zapier / n8n / Make",
      flow: "lead.created webhook -> Northstar demo endpoint -> AI lead analysis -> CRM task + run log",
      status: "Demo endpoint",
    },
    {
      title: "Northstar -> Automation Platform",
      tool: "Zapier / n8n / Make",
      flow: "Select CRM lead -> build payload -> POST to pasted webhook URL -> log request/response",
      status: "Live testable",
    },
    {
      title: "Northstar -> External CRM",
      tool: "Generic webhook/API",
      flow: "Clean CRM payload -> dry-run sync log -> later native adapter or middleware mapping",
      status: "Dry-run",
    },
    {
      title: "Approval-Gated Messaging",
      tool: "Internal CRM + inbox",
      flow: "AI draft -> human approval -> simulated send -> activity timeline",
      status: "Built-in",
    },
  ];

  function sendWebhookTest(mode: "dry_run" | "send") {
    if (!selectedLeadId) {
      toast.error("Create or select a lead first.");
      return;
    }
    startWebhookTransition(async () => {
      const result = await sendIntegrationWebhookTest({
        leadId: selectedLeadId,
        webhookUrl: mode === "send" ? webhookUrl : "",
      });
      if (!result.success) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      setLastWebhookResult(result.data ?? null);
      toast.success(
        result.data?.status === "success"
          ? "Webhook test sent and logged"
          : "Webhook dry-run payload logged"
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-4 w-4 text-brand-gold" />
              Automation recipes
            </CardTitle>
            <CardDescription>
              These are the business-system patterns this demo is meant to communicate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipes.map((recipe) => (
              <div key={recipe.title} className="rounded-md border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{recipe.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{recipe.tool}</p>
                  </div>
                  <Badge variant="secondary">{recipe.status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{recipe.flow}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" />
              Outbound webhook test
            </CardTitle>
            <CardDescription>
              Paste a Zapier/n8n/Make webhook URL to send a real test, or leave it blank to log a
              dry-run payload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasLeads ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Create a lead first</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>Outbound webhook tests need a CRM lead to serialize into a payload.</p>
                  <Button size="sm" onClick={onCreateSampleLead} disabled={creatingLead}>
                    {creatingLead ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FlaskConical className="h-3.5 w-3.5" />
                    )}
                    Create sample lead
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <Select value={selectedLeadId} onValueChange={onSelectLead}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {leadLabel(lead)} · {SERVICE_LABELS[lead.service_type] ?? lead.service_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/... or n8n webhook URL"
                />
                <p className="text-xs text-muted-foreground">
                  Live sends require HTTPS. For local n8n, expose your webhook with a tunnel URL or
                  use dry-run.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => sendWebhookTest("dry_run")}
                    disabled={sendingWebhook}
                    variant="outline"
                  >
                    {sendingWebhook ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileJson className="h-3.5 w-3.5" />
                    )}
                    Log dry-run payload
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => sendWebhookTest("send")}
                    disabled={sendingWebhook || !webhookUrl.trim()}
                  >
                    {sendingWebhook ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send to webhook
                  </Button>
                </div>
              </div>
            )}

            {lastWebhookResult ? (
              <div className="rounded-md border bg-secondary/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Last webhook result</p>
                  <Badge variant="outline" className={STATUS_STYLES[lastWebhookResult.status]}>
                    {lastWebhookResult.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                {lastWebhookResult.responseStatus ? (
                  <p className="text-xs text-muted-foreground">
                    HTTP {lastWebhookResult.responseStatus}
                    {lastWebhookResult.responsePreview
                      ? ` · ${lastWebhookResult.responsePreview.slice(0, 120)}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No external request was sent. Payload was logged for inspection.
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statuses.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.name}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <Badge variant="secondary">{item.status}</Badge>
                </div>
                <p className="mt-4 text-sm font-medium">{item.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How the automation layer works</CardTitle>
            <CardDescription>
              A workflow starts with an event, optionally uses AI to analyze or draft something,
              then creates an internal output or dry-run payload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "New lead -> AI lead analysis -> CRM note/task suggestion",
              "Estimate sent -> follow-up draft -> human approval in Inbox",
              "Appointment booked -> quote prep packet -> Quote Tool handoff",
              "External CRM webhook -> normalized payload -> same workflow modules",
            ].map((item) => (
              <div key={item} className="flex gap-2 rounded-md border p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook event format</CardTitle>
            <CardDescription>
              Example payload for Zapier, n8n, Make, or a CRM webhook. This is documented/demo
              ready; it does not claim a production app exists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="/api/demo/n8n-workflow">
                  <Download className="h-3.5 w-3.5" />
                  Download n8n workflow JSON
                </a>
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
            <pre className="overflow-auto rounded-md border bg-secondary/40 p-4 text-xs leading-relaxed">
              {payloadExample()}
            </pre>
            <pre className="overflow-auto rounded-md border bg-secondary/40 p-4 text-xs leading-relaxed">
              {curlExample()}
            </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <IntegrationEventLog events={syncEvents} />

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Approval rules</AlertTitle>
        <AlertDescription>
          Internal CRM notes, task creation, and quote prep can run automatically in the demo.
          Customer-facing SMS/email drafts, pricing language, financing language, insurance
          language, and angry-customer replies should require human approval before simulated send.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function IntegrationEventLog({ events }: { events: CrmSyncEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileJson className="h-4 w-4 text-primary" />
          Recent integration events
        </CardTitle>
        <CardDescription>
          Outbound webhook tests, dry-run payloads, and CRM sync attempts are logged here for
          inspection.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {events.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No integration events yet. Run a dry-run payload or send a webhook test above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.slice(0, 12).map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">{event.provider.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm">{event.action.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLES[event.status]}>
                      {event.status.replace(/_/g, " ")}
                    </Badge>
                    {event.error_message ? (
                      <p className="mt-1 max-w-48 truncate text-xs text-red-600">
                        {event.error_message}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-48 truncate font-mono text-xs text-muted-foreground">
                    {event.external_id ?? "—"}
                  </TableCell>
                  <TableCell className="min-w-56">
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-primary">
                        Inspect
                      </summary>
                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                        <pre className="max-h-56 overflow-auto rounded-md border bg-secondary/30 p-3 text-xs text-muted-foreground">
                          {JSON.stringify(event.request_payload, null, 2)}
                        </pre>
                        <pre className="max-h-56 overflow-auto rounded-md border bg-secondary/30 p-3 text-xs text-muted-foreground">
                          {JSON.stringify(event.response_payload, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
