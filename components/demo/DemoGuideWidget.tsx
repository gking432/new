"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ExternalLink,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PlayCircle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCall } from "@/components/calls/CallProvider";
import { createDemoSpeedToLead, getDemoGuideContext } from "@/lib/actions/demo";
import { simulateInboundEmail, simulateInboundText } from "@/lib/actions/inbox";
import { appendDemoEvent } from "@/lib/demo-log";

/**
 * Floating interactive demo guide (bottom-right, public and internal pages).
 * Every CUSTOMER-side action — submitting the form, calling in, calling back,
 * texting, emailing — has its real button right in the guide, so a portfolio
 * visitor can read a step and click it. Dashboard-user actions (approving
 * drafts, syncing, quoting) stay in the dashboard; the guide only points at
 * them.
 */
export function DemoGuideWidget({ audience }: { audience: "public" | "internal" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-dark px-4 py-2.5 text-sm font-medium text-white shadow-xl transition-transform hover:scale-105"
      >
        <PlayCircle className="h-4 w-4 text-brand-gold" />
        Demo guide
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-gold" />
              How to demo this project
            </SheetTitle>
            <SheetDescription>
              Read a step, click its button — the customer actions run right from here. No real
              calls, texts, or emails are ever sent.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {audience === "internal" ? (
              <InternalGuide close={() => setOpen(false)} />
            ) : (
              <PublicGuide close={() => setOpen(false)} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Step({
  number,
  title,
  body,
  children,
}: {
  number: number;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-start gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
          {number}
        </span>
        {title}
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      {children && <div className="mt-2.5 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// ── Internal (dashboard) guide ───────────────────────────────────────────────

interface SarahLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  stage: string;
  urgency: string;
  service_type: string;
}

function InternalGuide({ close }: { close: () => void }) {
  const router = useRouter();
  const { startCall, callActive } = useCall();
  const [busy, setBusy] = useState<string | null>(null);
  const [sarah, setSarah] = useState<SarahLead | null>(null);

  useEffect(() => {
    void getDemoGuideContext().then((ctx) => setSarah(ctx.latestLead));
  }, []);

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
    close();
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

  function runExistingCustomerCall() {
    if (!sarah) return;
    close();
    startCall({
      scenario: "existing_customer_call",
      leadId: sarah.id,
      callerName: `${sarah.first_name} ${sarah.last_name}`,
      callerPhone: sarah.phone,
      subtitle: `${sarah.service_type.replace(/_/g, " ")} lead`,
      direction: "inbound",
      navigateTo: "/app",
      crmContext: [
        { label: "Name", value: `${sarah.first_name} ${sarah.last_name}` },
        { label: "Stage", value: sarah.stage.replace(/_/g, " ") },
        { label: "Urgency", value: sarah.urgency },
        { label: "Service", value: sarah.service_type.replace(/_/g, " ") },
      ],
    });
  }

  function runNewInboundCall() {
    close();
    startCall({
      scenario: "new_inbound_call",
      callerName: "Unknown Caller",
      callerPhone: "(262) 555-0114",
      direction: "inbound",
      navigateTo: "/app",
    });
  }

  async function runInboundText() {
    setBusy("text");
    const result = await simulateInboundText();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    result.data.events.forEach(appendDemoEvent);
    toast.success("Sarah's text arrived — reply to it in the Inbox");
    close();
    router.push("/app/inbox");
  }

  async function runInboundEmail() {
    setBusy("email");
    const result = await simulateInboundEmail();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    result.data.events.forEach(appendDemoEvent);
    toast.success("New prospect email arrived — reply to it in the Inbox");
    close();
    router.push("/app/inbox");
  }

  const callsBlocked = callActive || busy !== null;

  return (
    <>
      <Step
        number={1}
        title="A homeowner requests service — and gets an instant AI callback"
        body="This submits a real lead through the public form pipeline, then the AI scheduling assistant calls the homeowner. Answer the call (you play the homeowner), and you'll land on the dashboard with the live call floating on top — click “Open lead” mid-call."
      >
        <Button size="sm" onClick={runSpeedToLead} disabled={callsBlocked}>
          {busy === "speed" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PhoneOutgoing className="h-3.5 w-3.5" />
          )}
          Submit lead &amp; ring the phone
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href="/request?fill=demo" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Or do it as the customer (new tab)
          </a>
        </Button>
        <span className="w-full text-[11px] text-muted-foreground">
          The customer site opens with its own demo guide and an auto-fill button — or type your
          own info; everything works.
        </span>
      </Step>

      <Step
        number={2}
        title="Approve the confirmation text"
        body="The call drafted a confirmation SMS that's waiting for human approval — that's a dashboard job, so it lives in the Inbox: open the conversation and hit “Approve & send (simulated).” If the customer's phone window is still open from step 1, the text arrives on it."
      >
        <Button size="sm" variant="outline" asChild>
          <Link href="/app/inbox" onClick={close}>
            Go to the Inbox
          </Link>
        </Button>
      </Step>

      <Step
        number={3}
        title="An existing customer calls back"
        body={
          sarah
            ? `${sarah.first_name} ${sarah.last_name} calls the office. The AI matches her number, shows her CRM record before you answer, and references her storm-damage request — no re-asking what we already know.`
            : "Requires the seeded Sarah Mitchell lead — run `npm run seed` first."
        }
      >
        <Button size="sm" onClick={runExistingCustomerCall} disabled={callsBlocked || !sarah}>
          <PhoneIncoming className="h-3.5 w-3.5" />
          Sarah calls the office
        </Button>
      </Step>

      <Step
        number={4}
        title="A brand-new caller rings the office"
        body="Someone who isn't in the CRM calls in. The AI runs intake — name, address, problem, urgency, insurance, appointment — and a new lead, tasks, and CRM notes come out the other side."
      >
        <Button size="sm" onClick={runNewInboundCall} disabled={callsBlocked}>
          <Phone className="h-3.5 w-3.5" />
          Unknown caller rings
        </Button>
      </Step>

      <Step
        number={5}
        title="The customer texts an update"
        body="Sarah texts that the ceiling stain grew overnight. The AI matches her number, flags it urgent, creates a task, and drafts a reply — you'll review it in a chat-style thread."
      >
        <Button size="sm" onClick={runInboundText} disabled={busy !== null}>
          {busy === "text" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquareText className="h-3.5 w-3.5" />
          )}
          Sarah sends the text
        </Button>
      </Step>

      <Step
        number={6}
        title="A new prospect emails"
        body="An email about replacing 12 windows comes in. The AI creates the lead, classifies the service, drafts the reply, and sets a follow-up task."
      >
        <Button size="sm" onClick={runInboundEmail} disabled={busy !== null}>
          {busy === "email" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          Send the email
        </Button>
      </Step>

      <Step
        number={7}
        title="Explore the dashboard side"
        body="The rest is what the team does in the dashboard: dry-run a HubSpot sync from CRM Sync, generate an internal ballpark in the Quote Tool, set estimator availability in Appointments, and watch the live event log in the Demo Center."
      >
        <Button size="sm" variant="outline" asChild>
          <Link href="/app/crm-sync" onClick={close}>
            CRM Sync
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/app/quote-tool" onClick={close}>
            Quote Tool
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/app/appointments" onClick={close}>
            Appointments
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/app/demo-center" onClick={close}>
            Demo Center
          </Link>
        </Button>
      </Step>

      <GuardrailsNote />
    </>
  );
}

// ── Public (customer site) guide ─────────────────────────────────────────────

function PublicGuide({ close }: { close: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  function fillForm() {
    close();
    if (pathname === "/request") {
      window.dispatchEvent(new CustomEvent("northstar-demo-fill"));
    } else {
      router.push("/request?fill=demo");
    }
  }

  return (
    <>
      <Step
        number={1}
        title="Fill out the request form as the homeowner"
        body="One click fills it with a realistic customer — or type your own info; everything you enter works in the demo."
      >
        <Button size="sm" onClick={fillForm}>
          <Wand2 className="h-3.5 w-3.5" />
          Auto-fill with demo customer
        </Button>
      </Step>

      <Step
        number={2}
        title="Submit, then answer the AI callback"
        body="Seconds after you submit, the company's AI scheduling assistant “calls” you right in the browser. Answer it, talk (or click through the script), and it books your inspection. Leave the phone window open afterwards — your confirmation text will arrive on it once the team approves it."
      />

      <Step
        number={3}
        title="Switch to the team's side"
        body="Log in to the Command Center to see what your call just created: CRM notes, tasks, a booked appointment, and the confirmation draft waiting for approval."
      >
        <Button size="sm" asChild>
          <Link href="/app" onClick={close}>
            Open the dashboard
          </Link>
        </Button>
      </Step>

      <div className="rounded-lg border bg-secondary/40 p-3 text-xs">
        <p className="font-medium">Demo login</p>
        <p className="mt-1 font-mono">admin@northstar-demo.com</p>
        <p className="font-mono">demo-password</p>
      </div>

      <GuardrailsNote />
    </>
  );
}

function GuardrailsNote() {
  return (
    <div className="space-y-1 rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Good to know</p>
      <p>
        • <Badge variant="secondary" className="text-[10px]">Live voice</Badge> needs an OpenAI
        key; without one, calls run as a click-through script with the same results.
      </p>
      <p>• Outbound messages always wait for human approval, then sending is simulated.</p>
      <p>• Property data in the quote tool is simulated and labeled as such.</p>
    </div>
  );
}
