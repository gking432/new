"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Calculator,
  Cable,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CallLauncher } from "@/components/calls/CallLauncher";
import { RealtimeCallSimulator } from "@/components/calls/RealtimeCallSimulator";
import { syncLeadToHubSpot } from "@/lib/actions/crm";
import { createDemoSpeedToLead } from "@/lib/actions/demo";
import { simulateInboundEmail, simulateInboundText } from "@/lib/actions/inbox";
import { DemoEventLog, type DemoEvent } from "./DemoEventLog";

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
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [speedToLead, setSpeedToLead] = useState<{
    leadId: string;
    name: string;
    phone: string;
  } | null>(null);

  const log = (label: string) => setEvents((prev) => [...prev, { at: new Date(), label }]);

  async function runSpeedToLead() {
    setBusy("speed");
    log("Submitting website lead through the public pipeline…");
    const result = await createDemoSpeedToLead();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    log(`Website lead submitted: ${result.data.name}`);
    log("AI classified the lead and automation rules fired");
    log("Speed-to-lead AI call starting…");
    setSpeedToLead(result.data);
  }

  async function runInboundText() {
    setBusy("text");
    log("Inbound text received from (414) 555-0188…");
    const result = await simulateInboundText();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    result.data.events.forEach(log);
    toast.success("Inbound text processed — check the Inbox");
    router.refresh();
  }

  async function runInboundEmail() {
    setBusy("email");
    log("Inbound email received: “Window estimate”…");
    const result = await simulateInboundEmail();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    result.data.events.forEach(log);
    toast.success("Inbound email processed — check the Inbox");
    router.refresh();
  }

  async function runHubSpotSync() {
    if (!latestLead) {
      toast.error("No leads available to sync");
      return;
    }
    setBusy("hubspot");
    log(`Preparing HubSpot payload for ${latestLead.first_name} ${latestLead.last_name}…`);
    const result = await syncLeadToHubSpot(latestLead.id);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      log(`HubSpot sync failed: ${result.error}`);
      return;
    }
    log(
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

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
        {/* 1. Speed to lead */}
        <ScenarioCard
          icon={Zap}
          title="Run Speed-to-Lead Demo"
          tag="Primary wow demo"
          description="A homeowner submits the website form — and the AI scheduling assistant calls them back within seconds, confirms details, and books the inspection."
        >
          <Button onClick={runSpeedToLead} disabled={busy !== null}>
            {busy === "speed" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PhoneOutgoing className="h-4 w-4" />
            )}
            Submit lead & start AI call
          </Button>
        </ScenarioCard>

        {/* 2. New inbound call */}
        <ScenarioCard
          icon={PhoneIncoming}
          title="Simulate New Inbound Call"
          description="An unknown homeowner calls the office. The AI answers, runs intake, creates the lead, books the inspection, and writes the CRM notes."
        >
          <CallLauncher
            scenario="new_inbound_call"
            callerName="Unknown Caller"
            callerPhone="(414) 555-0188"
            direction="inbound"
            buttonLabel="Simulate inbound call"
            onEvent={log}
            onFinished={() => router.refresh()}
          />
        </ScenarioCard>

        {/* 3. Existing customer callback */}
        <ScenarioCard
          icon={Phone}
          title="Simulate Existing Customer Call"
          description={
            sarahLead
              ? `${sarahLead.first_name} ${sarahLead.last_name} calls back. The AI matches her number, pulls the CRM record, and logs the second touchpoint.`
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
              crmContext={[
                { label: "Name", value: `${sarahLead.first_name} ${sarahLead.last_name}` },
                { label: "Stage", value: sarahLead.stage.replace(/_/g, " ") },
                { label: "Urgency", value: sarahLead.urgency },
                { label: "Service", value: sarahLead.service_type.replace(/_/g, " ") },
              ]}
              onEvent={log}
              onFinished={() => router.refresh()}
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
          description="Sarah texts an urgent update. The AI matches her number, flags the worsening leak, creates a task, and drafts a reply for approval."
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
          description="A new prospect emails about replacing 12 windows. The AI creates the lead, classifies the service, and drafts the reply."
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
              ? `Push ${latestLead.first_name} ${latestLead.last_name} to HubSpot as a contact + deal + AI note. Without a token this is a dry run — the exact payload is logged, nothing external is touched.`
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
          description="Open the internal quote tool: demo property research, storm context, and a deterministic ballpark estimate with assumptions and confidence."
        >
          <Button variant="outline" asChild>
            <Link href="/app/quote-tool">Open Quote Tool</Link>
          </Button>
        </ScenarioCard>

        {/* 8. Appointments */}
        <ScenarioCard
          icon={CalendarCheck}
          title="Book an Appointment"
          description="See the internal availability calendar, edit this week's schedule in plain English, and book inspections from open slots."
        >
          <Button variant="outline" asChild>
            <Link href="/app/appointments">Open Appointments</Link>
          </Button>
        </ScenarioCard>
      </div>

      <div className="space-y-4">
        <DemoEventLog events={events} />
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

      {/* Speed-to-lead call dialog */}
      <Dialog
        open={speedToLead !== null}
        onOpenChange={(open) => {
          if (!open) setSpeedToLead(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneOutgoing className="h-4 w-4 text-primary" />
              Speed-to-lead AI call
              <Badge variant="secondary" className="text-[10px]">
                Demo — no real phone call placed
              </Badge>
            </DialogTitle>
            <DialogDescription>
              You&apos;re seeing the homeowner&apos;s side: the AI assistant is calling them moments
              after they submitted the form. Answer the call to play it out.
            </DialogDescription>
          </DialogHeader>
          {speedToLead && (
            <RealtimeCallSimulator
              key={speedToLead.leadId}
              scenario="speed_to_lead_outbound"
              leadId={speedToLead.leadId}
              callerName={speedToLead.name}
              callerPhone={speedToLead.phone}
              subtitle="Calling the homeowner"
              direction="outbound"
              onEvent={log}
              onFinished={() => router.refresh()}
            />
          )}
        </DialogContent>
      </Dialog>
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
