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
import { createDemoSpeedToLead } from "@/lib/actions/demo";
import { simulateInboundEmail, simulateInboundText } from "@/lib/actions/inbox";
import { appendDemoEvent } from "@/lib/demo-log";
import { DemoEventLog } from "./DemoEventLog";

interface SarahLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  stage: string;
  urgency: string;
  service_type: string;
}

export function DemoCenterClient({
  sarahLead,
  latestLead,
}: {
  sarahLead: SarahLead | null;
  latestLead: { id: string; first_name: string; last_name: string } | null;
}) {
  const router = useRouter();
  const { startCall, callActive } = useCall();
  const [busy, setBusy] = useState<string | null>(null);

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
    startCall({
      scenario: "speed_to_lead_outbound",
      leadId: result.data.leadId,
      callerName: result.data.name,
      callerPhone: result.data.phone,
      subtitle: "Calling the homeowner",
      direction: "outbound",
      navigateTo: "/app",
    });
  }

  async function runInboundText() {
    setBusy("text");
    appendDemoEvent("Inbound text received from (414) 555-0188…");
    const result = await simulateInboundText();
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
    if (!latestLead) {
      toast.error("No leads available to sync");
      return;
    }
    setBusy("hubspot");
    appendDemoEvent(`Preparing HubSpot payload for ${latestLead.first_name} ${latestLead.last_name}…`);
    const result = await syncLeadToHubSpot(latestLead.id);
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

        {/* 2. New inbound call — AI answers */}
        <ScenarioCard
          icon={PhoneIncoming}
          title="Simulate New Inbound Call (AI answers)"
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
          description={
            sarahLead
              ? `${sarahLead.first_name} ${sarahLead.last_name} calls back — you play her. The AI matches her number, answers with her full history, and logs a second touchpoint. Real AI voice.`
              : "Requires the seeded Sarah Mitchell lead — run `npm run seed` first."
          }
        >
          {sarahLead ? (
            <CallLauncher
              scenario="existing_customer_call"
              leadId={sarahLead.id}
              callerName={`${sarahLead.first_name} ${sarahLead.last_name}`}
              callerPhone={sarahLead.phone}
              subtitle={`${sarahLead.service_type.replace(/_/g, " ")} lead`}
              direction="inbound"
              buttonLabel="Simulate callback"
              buttonVariant="outline"
              navigateTo="/app"
              crmContext={[
                { label: "Name", value: `${sarahLead.first_name} ${sarahLead.last_name}` },
                { label: "Stage", value: sarahLead.stage.replace(/_/g, " ") },
                { label: "Urgency", value: sarahLead.urgency },
                { label: "Service", value: sarahLead.service_type.replace(/_/g, " ") },
              ]}
            />
          ) : (
            <Button variant="outline" disabled>
              Seed data required
            </Button>
          )}
        </ScenarioCard>

        {/* 4. Inbound text */}
        <ScenarioCard
          icon={MessageSquareText}
          title="Simulate Inbound Text"
          description="Sarah texts an urgent update. The AI matches her number, flags the worsening leak, creates a task, and drafts a reply — review it in a real message thread."
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
          description="A new prospect emails about replacing 12 windows. The AI creates the lead, classifies the service, and drafts the reply for approval."
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
          description={
            latestLead
              ? `Push ${latestLead.first_name} ${latestLead.last_name} to HubSpot as a contact + deal + AI note. Without a token this is a dry run — payload logged, nothing external touched.`
              : "Requires at least one lead."
          }
        >
          <Button variant="outline" onClick={runHubSpotSync} disabled={busy !== null || !latestLead}>
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
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tag?: string;
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
        {tag && (
          <Badge className="w-fit bg-brand-gold/20 text-brand-dark border border-brand-gold/40">
            {tag}
          </Badge>
        )}
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">{children}</CardContent>
    </Card>
  );
}
