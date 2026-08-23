"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Calculator,
  Cable,
  Headphones,
  Loader2,
  Mail,
  MessageSquareText,
  Mic,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Workflow,
  Zap,
} from "lucide-react";

const JORDAN_SEED: Record<string, string | null> = {
  first_name: "Jordan",
  last_name: "Avery",
  phone: "(414) 555-0123",
  email: "jordan.avery@example.com",
  address: "418 Lakeview Ct",
  city: "Pewaukee",
  active_leak: "yes",
  insurance_started: "no",
  preferred_contact_method: "phone",
  service_type: "storm_damage",
  urgency: "high",
};
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CallLauncher } from "@/components/calls/CallLauncher";
import { useCall } from "@/components/calls/CallProvider";
import { syncLeadToHubSpot } from "@/lib/actions/crm";
import {
  createDemoSpeedToLead,
  ensureDemoStorylineLead,
  getDemoGuideContext,
  type DemoLatestLead,
} from "@/lib/actions/demo";
import { simulateInboundEmail, simulateInboundText } from "@/lib/actions/inbox";
import { appendDemoEvent } from "@/lib/demo-log";
import { DemoEventLog } from "./DemoEventLog";

export function DemoCenterClient({
  latestLead,
}: {
  latestLead: DemoLatestLead | null;
}) {
  const router = useRouter();
  const { startCall, callActive } = useCall();
  const [busy, setBusy] = useState<string | null>(null);
  const [storylineLead, setStorylineLead] = useState<DemoLatestLead | null>(latestLead);

  async function runSpeedToLead() {
    setBusy("speed");
    appendDemoEvent("Submitting website lead through the public pipeline…");
    const result = await createDemoSpeedToLead();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    appendDemoEvent(
      result.data.reused
        ? `Repeat submission matched to existing lead: ${result.data.name} (no duplicate created)`
        : `Website lead submitted: ${result.data.name} — AI classified it and automations fired`
    );
    appendDemoEvent("Speed-to-lead AI call starting…");
    const context = await getDemoGuideContext(result.data.leadId);
    if (context.latestLead) setStorylineLead(context.latestLead);
    startCall({
      scenario: "speed_to_lead_outbound",
      leadId: result.data.leadId,
      callerName: "Northstar Exterior & Home",
      subtitle: "AI Scheduling Assistant",
      direction: "inbound",
      navigateTo: `/app/leads/${result.data.leadId}`,
    });
  }

  async function runExistingCustomerCall() {
    setBusy("existing");
    const ctx = await ensureDemoStorylineLead(storylineLead?.id);
    setBusy(null);
    if (!ctx.success) {
      toast.error(ctx.error);
      return;
    }
    const l = ctx.data.lead;
    setStorylineLead(l);
    if (ctx.data.created) {
      appendDemoEvent(`Created ${l.first_name} ${l.last_name} before simulating the callback`);
    }
    startCall({
      scenario: "existing_customer_call",
      leadId: l.id,
      callerName: `${l.first_name} ${l.last_name}`,
      callerPhone: l.phone,
      subtitle: `${l.service_type.replace(/_/g, " ")} lead`,
      direction: "inbound",
      navigateTo: `/app/leads/${l.id}`,
      crmContext: [
        { label: "Name", value: `${l.first_name} ${l.last_name}` },
        { label: "Stage", value: l.stage.replace(/_/g, " ") },
        { label: "Service", value: l.service_type.replace(/_/g, " ") },
      ],
    });
  }

  async function runInboundText() {
    setBusy("text");
    const ctx = await ensureDemoStorylineLead(storylineLead?.id);
    if (!ctx.success) {
      setBusy(null);
      toast.error(ctx.error);
      return;
    }
    setStorylineLead(ctx.data.lead);
    appendDemoEvent(`Inbound text received from ${ctx.data.lead.first_name} ${ctx.data.lead.last_name}…`);
    const result = await simulateInboundText({ leadId: ctx.data.lead.id });
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    result.data.events.forEach(appendDemoEvent);
    toast.success("Inbound text processed — opening the conversation");
    router.push("/app/inbox");
  }

  async function runInboundEmail() {
    setBusy("email");
    appendDemoEvent("Inbound email received: “Window estimate”…");
    const result = await simulateInboundEmail();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    result.data.events.forEach(appendDemoEvent);
    toast.success("Inbound email processed — opening the Inbox");
    router.push("/app/inbox");
  }

  async function runHubSpotSync() {
    setBusy("hubspot");
    const ctx = await ensureDemoStorylineLead(storylineLead?.id);
    if (!ctx.success) {
      setBusy(null);
      toast.error(ctx.error);
      return;
    }
    const lead = ctx.data.lead;
    setStorylineLead(lead);
    appendDemoEvent(`Preparing HubSpot payload for ${lead.first_name} ${lead.last_name}…`);
    const result = await syncLeadToHubSpot(lead.id);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      appendDemoEvent(`HubSpot sync failed: ${result.error}`);
      return;
    }
    appendDemoEvent(
      result.data.mode === "dry_run"
        ? `HubSpot dry run successful — contact ${result.data.contactId}, deal ${result.data.dealId} (no external CRM updated)`
        : `HubSpot live sync complete — contact ${result.data.contactId}, deal ${result.data.dealId}`
    );
    toast.success(
      result.data.mode === "dry_run"
        ? "Dry run successful — see CRM Sync for the payload"
        : "Synced to HubSpot"
    );
    router.refresh();
  }

  async function testAiVoice() {
    setBusy("voice");
    const res = await fetch("/api/realtime/session");
    const data = (await res.json()) as { ok: boolean; reason?: string; api?: string; model?: string };
    setBusy(null);
    if (data.ok) {
      toast.success(`Live AI voice is working (${data.api} API · ${data.model})`);
      appendDemoEvent(`AI voice check passed: ${data.model} via ${data.api} API`);
    } else {
      toast.error(`Live AI voice unavailable — calls will run in scripted mode`, {
        description: data.reason,
        duration: 12000,
      });
      appendDemoEvent(`AI voice check failed: ${data.reason}`);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
        {/* 1. Speed to lead */}
        <ScenarioCard
          icon={Zap}
          title="Run Speed-to-Lead Demo"
          tag="Primary wow demo"
          target="Creates or reuses Jordan Avery"
          description="A homeowner submits the website form — and the AI scheduling assistant calls them back within seconds. Answer the call, then browse the CRM while it runs."
        >
          <Button onClick={runSpeedToLead} disabled={busy !== null || callActive}>
            {busy === "speed" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PhoneOutgoing className="h-4 w-4" />
            )}
            Submit lead & start AI call
          </Button>
        </ScenarioCard>

        <ScenarioCard
          icon={Workflow}
          title="Run AI Automation Workflow"
          tag="Portfolio systems demo"
          description="Open the AI Automations Center, run a workflow against existing CRM lead data, inspect the run log, and review any approval-gated draft in the Inbox."
        >
          <Button variant="outline" asChild>
            <Link href="/app/automations">Open AI Automations</Link>
          </Button>
        </ScenarioCard>

        {/* 2. New inbound call — AI answers */}
        <ScenarioCard
          icon={PhoneIncoming}
          title="Simulate New Inbound Call (AI answers)"
          target="Creates Marcus Webb"
          description="An unknown homeowner (Marcus Webb) calls the office. The AI answers, runs intake, creates the lead, books the inspection, and writes the CRM notes."
        >
          <CallLauncher
            scenario="new_inbound_call"
            callerName="Unknown Caller"
            callerPhone="(262) 555-0114"
            direction="inbound"
            buttonLabel="Simulate inbound call"
            navigateTo="/app/leads/new"
          />
        </ScenarioCard>

        {/* 2b. You answer, AI is the customer */}
        <ScenarioCard
          icon={Headphones}
          title="You Answer (AI is the customer)"
          target="Creates or matches Jordan Avery"
          description="Flip it around: you're the rep and the AI plays the homeowner. The dashboard opens a live lead form that fills as you ask — and flags in red whatever you still need to get."
        >
          <CallLauncher
            scenario="new_inbound_call"
            persona="customer"
            direction="inbound"
            callerName="Jordan Avery"
            callerPhone="(414) 555-0123"
            seedFields={JORDAN_SEED}
            navigateTo="/app/leads/new"
            buttonLabel="Answer as the rep"
            buttonVariant="outline"
          />
        </ScenarioCard>

        {/* 3. Existing customer callback */}
        <ScenarioCard
          icon={Phone}
          title="Simulate Existing Customer Call"
          target={storylineLead ? `Uses ${storylineLead.first_name} ${storylineLead.last_name}` : "Seeds Jordan Avery first"}
          description={
            storylineLead
              ? `${storylineLead.first_name} ${storylineLead.last_name} calls back. The AI opens the same CRM record, uses its history, and logs a second touchpoint.`
              : "If the storyline has not started, this action creates its demo lead first and then logs the callback against that record."
          }
        >
          <Button
            variant="outline"
            onClick={runExistingCustomerCall}
            disabled={busy !== null || callActive}
          >
            {busy === "existing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            Simulate callback
          </Button>
        </ScenarioCard>

        {/* 4. Inbound text */}
        <ScenarioCard
          icon={MessageSquareText}
          title="Simulate Inbound Text"
          target={storylineLead ? `Uses ${storylineLead.first_name} ${storylineLead.last_name}` : "Seeds Jordan Avery first"}
          description="The storyline customer texts that the leak is getting worse. The CRM matches the number to the same lead, flags it urgent, creates a task, and finds Jess Romero's next same-day opening."
        >
          <Button variant="outline" onClick={runInboundText} disabled={busy !== null}>
            {busy === "text" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            Simulate inbound text
          </Button>
        </ScenarioCard>

        {/* 5. Inbound email */}
        <ScenarioCard
          icon={Mail}
          title="Simulate Inbound Email"
          target="Creates or matches Greg Tomlinson"
          description="A new prospect emails about replacing 12 windows. The AI creates the lead, classifies the service, and flags the Inbox conversation for a normal reply."
        >
          <Button variant="outline" onClick={runInboundEmail} disabled={busy !== null}>
            {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Simulate inbound email
          </Button>
        </ScenarioCard>

        {/* 6. HubSpot dry sync */}
        <ScenarioCard
          icon={Cable}
          title="Run HubSpot Dry Sync"
          target={storylineLead ? `Uses ${storylineLead.first_name} ${storylineLead.last_name}` : "Seeds Jordan Avery first"}
          description={
            storylineLead
              ? `Push ${storylineLead.first_name} ${storylineLead.last_name} to HubSpot as a contact + deal + AI note. Without a token this is a dry run — payload logged, nothing external touched.`
              : "Creates the storyline lead if needed, then prepares its contact, deal, and AI-note payload."
          }
        >
          <Button variant="outline" onClick={runHubSpotSync} disabled={busy !== null}>
            {busy === "hubspot" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cable className="h-4 w-4" />}
            Run dry sync
          </Button>
        </ScenarioCard>

        {/* 7. Quote tool */}
        <ScenarioCard
          icon={Calculator}
          title="Generate Quote Intelligence"
          description="Open the internal quote tool: simulated property research, storm context, and a deterministic ballpark estimate with assumptions and confidence."
        >
          <Button variant="outline" asChild>
            <Link href="/app/quote-tool">Open Quote Tool</Link>
          </Button>
        </ScenarioCard>

        {/* 8. Appointments */}
        <ScenarioCard
          icon={CalendarCheck}
          title="Book an Appointment"
          description="See the internal estimator calendar, set weekly availability per estimator, and book inspections from open slots."
        >
          <Button variant="outline" asChild>
            <Link href="/app/appointments">Open Appointments</Link>
          </Button>
        </ScenarioCard>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-primary" />
              AI voice status
            </CardTitle>
            <CardDescription>
              Check whether live AI voice is configured. If this fails, calls run in scripted mode
              and the exact OpenAI error is shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={testAiVoice} disabled={busy !== null}>
              {busy === "voice" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
              Test AI voice
            </Button>
          </CardContent>
        </Card>

        <DemoEventLog />

        <Card>
          <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo guardrails</p>
            <p>• No real phone calls are placed — calls run in the browser.</p>
            <p>• No real SMS or email is sent — outbound drafts require human approval, then “send” is simulated.</p>
            <p>• CRM sync runs in dry-run mode unless a HubSpot token is configured.</p>
            <p>• Live AI voice requires an OpenAI key; otherwise every scenario runs in scripted mode.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ScenarioCard({
  icon: Icon,
  title,
  tag,
  target,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tag?: string;
  target?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {tag && (
            <Badge className="w-fit bg-brand-gold/20 text-brand-dark border border-brand-gold/40">
              {tag}
            </Badge>
          )}
          {target && <Badge variant="outline">CRM target: {target}</Badge>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">{children}</CardContent>
    </Card>
  );
}
