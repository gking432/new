"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Mail,
  MessageSquareText,
  MousePointerClick,
  PhoneIncoming,
  PhoneOutgoing,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCall } from "@/components/calls/CallProvider";
import { createDemoSpeedToLead, getDemoGuideContext } from "@/lib/actions/demo";
import { simulateInboundEmail, simulateInboundText } from "@/lib/actions/inbox";
import { appendDemoEvent } from "@/lib/demo-log";
import { Spotlight } from "./Spotlight";

type Advance =
  | { kind: "manual" }
  | { kind: "action" }
  | { kind: "navigate"; pathname: string }
  | { kind: "navigatePrefix"; prefix: string };

interface RunCtx {
  startCall: ReturnType<typeof useCall>["startCall"];
  router: ReturnType<typeof useRouter>;
  sarahId: string | null;
  sarahPhone: string | null;
}

interface Step {
  id: string;
  title: string;
  body: string;
  spotlight?: string;
  spotlightHint?: string;
  action?: { label: string; icon?: React.ComponentType<{ className?: string }>; run: (ctx: RunCtx) => Promise<void> | void };
  advance: Advance;
}

const INDEX_KEY = "northstar-tutorial-index";
const ACTIVE_KEY = "northstar-tutorial-active";

export function TutorialProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const { startCall } = useCall();

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [sarahId, setSarahId] = useState<string | null>(null);
  const [sarahPhone, setSarahPhone] = useState<string | null>(null);
  const enteredAtPath = useRef<string>("");

  // ── Step definitions ──────────────────────────────────────────────────────
  const steps: Step[] = [
    {
      id: "welcome",
      title: "Welcome — you're the team at Northstar",
      body: "This guided tour walks the whole system the way you'd actually use it. Real records get created as you go; only outward calls, texts, and emails are simulated. The guide stays open on the right — do each step in the real dashboard, and it advances automatically.",
      advance: { kind: "manual" },
    },
    {
      id: "speed-to-lead",
      title: "1 · A homeowner requests service — and the AI calls them back",
      body: "Click below: a website lead is created through the real pipeline (AI analysis + automations), and the AI scheduling assistant rings the homeowner. You'll play the homeowner.",
      action: {
        label: "Submit lead & ring the phone",
        icon: PhoneOutgoing,
        run: async (ctx) => {
          appendDemoEvent("Submitting website lead through the public pipeline…");
          const res = await createDemoSpeedToLead();
          if (!res.success) {
            toast.error(res.error);
            throw new Error(res.error);
          }
          appendDemoEvent(
            res.data.reused
              ? `Repeat submission matched to existing lead: ${res.data.name}`
              : `Website lead submitted: ${res.data.name} — AI classified it and automations fired`
          );
          ctx.startCall({
            scenario: "speed_to_lead_outbound",
            leadId: res.data.leadId,
            callerName: res.data.name,
            callerPhone: res.data.phone,
            subtitle: "Calling the homeowner",
            direction: "outbound",
            navigateTo: `/app/leads/${res.data.leadId}`,
          });
        },
      },
      advance: { kind: "action" },
    },
    {
      id: "answer-call",
      title: "2 · Answer the call & watch the CRM fill itself",
      body: "Answer the phone in the top-left corner. As you talk (or click through), watch the live transcript and the details the AI captures. When the call ends it creates the lead record, books the inspection, adds tasks, and drafts a confirmation text. Click Next once the call wraps up.",
      advance: { kind: "manual" },
    },
    {
      id: "go-inbox-1",
      title: "3 · The confirmation text needs your OK",
      body: "Nothing goes to a customer without a human approving it first. Head to the Inbox — click it in the sidebar.",
      spotlight: "nav-inbox",
      spotlightHint: "Click Inbox in the sidebar →",
      advance: { kind: "navigate", pathname: "/app/inbox" },
    },
    {
      id: "approve-1",
      title: "4 · Review & approve the AI draft",
      body: "Open the conversation, tweak the AI-drafted text if you like, then Approve & send. In demo mode the send is simulated — and it shows up in the thread. Click Next when you've sent it.",
      spotlight: "inbox-draft",
      spotlightHint: "Find the AI-drafted reply and Approve & send",
      advance: { kind: "manual" },
    },
    {
      id: "go-leads",
      title: "5 · The heart of a CRM: the customer's info in front of you",
      body: "A CRM only earns its keep when everything about a customer is one click away. Open the Leads list.",
      spotlight: "nav-leads",
      spotlightHint: "Click Leads in the sidebar →",
      advance: { kind: "navigate", pathname: "/app/leads" },
    },
    {
      id: "open-lead",
      title: "6 · Open a lead by searching",
      body: "Type a name in the search box and click the row to open the full record: contact info, AI analysis, call history, the timeline, quote, and CRM-sync status — all in one place.",
      spotlight: "leads-search",
      spotlightHint: "Search a customer, then click their row",
      advance: { kind: "navigatePrefix", prefix: "/app/leads/" },
    },
    {
      id: "existing-call",
      title: "7 · A known customer calls back",
      body: "Now the magic of having a CRM: when an existing customer calls, the AI recognizes the number and pulls their whole history. Simulate Sarah Mitchell calling the office.",
      action: {
        label: "Sarah calls the office",
        icon: PhoneIncoming,
        run: (ctx) => {
          if (!ctx.sarahId) {
            toast.error("Run `npm run seed` to load Sarah Mitchell first");
            throw new Error("missing sarah");
          }
          ctx.startCall({
            scenario: "existing_customer_call",
            leadId: ctx.sarahId,
            callerName: "Sarah Mitchell",
            callerPhone: ctx.sarahPhone,
            subtitle: "storm damage lead",
            direction: "inbound",
            navigateTo: `/app/leads/${ctx.sarahId}`,
            crmContext: [
              { label: "Name", value: "Sarah Mitchell" },
              { label: "Service", value: "storm damage" },
              { label: "Status", value: "active leak reported" },
            ],
          });
        },
      },
      advance: { kind: "action" },
    },
    {
      id: "existing-answer",
      title: "8 · Answer — the AI already knows her",
      body: "Notice the matched CRM record before you even pick up. The assistant greets Sarah by name and references her storm-damage request — no re-asking what we already know. The call logs a second touchpoint on her timeline. Click Next when it wraps.",
      advance: { kind: "manual" },
    },
    {
      id: "text",
      title: "9 · Customers text, too",
      body: "Sarah sends an urgent text update. The AI matches her number, reviews the message, scores its importance, creates a task, and drafts a reply.",
      action: {
        label: "Sarah sends a text",
        icon: MessageSquareText,
        run: async () => {
          const r = await simulateInboundText();
          if (!r.success) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          r.data.events.forEach(appendDemoEvent);
          toast(`📱 ${r.data.headline}`, { position: "top-center", duration: 9000 });
        },
      },
      advance: { kind: "action" },
    },
    {
      id: "text-inbox",
      title: "10 · Handle the text",
      body: "See the banner that popped up top-center? The AI scored this High priority — an existing customer reporting a worsening leak. Open the Inbox to reply.",
      spotlight: "nav-inbox",
      spotlightHint: "Click Inbox (or the notification) →",
      advance: { kind: "navigate", pathname: "/app/inbox" },
    },
    {
      id: "text-approve",
      title: "11 · Approve Sarah's reply",
      body: "Open her thread — you'll see her text and the AI's drafted response. Approve & send it. Click Next when done.",
      spotlight: "inbox-draft",
      spotlightHint: "Review the AI reply and Approve & send",
      advance: { kind: "manual" },
    },
    {
      id: "email",
      title: "12 · A brand-new lead emails in",
      body: "A prospect emails about replacing 12 windows. The AI reads it, creates the lead, classifies the service, and — because new leads are the most time-sensitive — scores it URGENT.",
      action: {
        label: "New prospect emails in",
        icon: Mail,
        run: async (ctx) => {
          const r = await simulateInboundEmail();
          if (!r.success) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          r.data.events.forEach(appendDemoEvent);
          toast(`📧 ${r.data.headline}`, {
            position: "top-center",
            duration: 12000,
            action: { label: "Open Inbox", onClick: () => ctx.router.push("/app/inbox") },
          });
        },
      },
      advance: { kind: "action" },
    },
    {
      id: "email-inbox",
      title: "13 · Why urgency scoring matters",
      body: "New leads get flagged URGENT because speed-to-lead wins jobs; existing customers are lower priority unless they report a problem with completed work. You can click the notification or the Inbox to jump to the new lead's reply.",
      spotlight: "nav-inbox",
      spotlightHint: "Click Inbox (or the notification) →",
      advance: { kind: "navigate", pathname: "/app/inbox" },
    },
    {
      id: "pipeline",
      title: "14 · Pipeline",
      body: "Every lead organized by stage, from New to Won. Drag-style stage changes, per-column collapse to focus, and the dollar value sitting in each stage. Open Pipeline.",
      spotlight: "nav-pipeline",
      spotlightHint: "Click Pipeline →",
      advance: { kind: "navigate", pathname: "/app/pipeline" },
    },
    {
      id: "tasks",
      title: "15 · Tasks",
      body: "The team's to-do list — call-backs, follow-ups, inspections — created by you, by the AI, and by automations, sorted by urgency and due date. Open Tasks.",
      spotlight: "nav-tasks",
      spotlightHint: "Click Tasks →",
      advance: { kind: "navigate", pathname: "/app/tasks" },
    },
    {
      id: "appointments",
      title: "16 · Appointments",
      body: "The estimator calendar the AI books against — and notice it includes evenings and weekends, because that's when most homeowners are actually available. Open Appointments.",
      spotlight: "nav-appointments",
      spotlightHint: "Click Appointments →",
      advance: { kind: "navigate", pathname: "/app/appointments" },
    },
    {
      id: "follow-up",
      title: "17 · Follow-Up generator",
      body: "Generate an AI draft for any lead — SMS, email, call script, voicemail, review response — in whatever tone you pick. Everything stays a draft until a human approves it. Open Follow-Up.",
      spotlight: "nav-follow-up",
      spotlightHint: "Click Follow-Up →",
      advance: { kind: "navigate", pathname: "/app/follow-up" },
    },
    {
      id: "quote-tool",
      title: "18 · Quote Intelligence",
      body: "An internal ballpark estimator from property details + storm context. It's always labeled 'requires inspection before a final quote' and never customer-facing. Open Quote Tool.",
      spotlight: "nav-quote-tool",
      spotlightHint: "Click Quote Tool →",
      advance: { kind: "navigate", pathname: "/app/quote-tool" },
    },
    {
      id: "feedback",
      title: "19 · Feedback analyzer",
      body: "Paste a review or survey reply — the AI scores sentiment and risk, categorizes it, and routes anything negative to a manager within a business day. Open Feedback.",
      spotlight: "nav-feedback",
      spotlightHint: "Click Feedback →",
      advance: { kind: "navigate", pathname: "/app/feedback" },
    },
    {
      id: "automations",
      title: "20 · Automations",
      body: "Plain-English business rules — 'urgent storm lead → create a 15-minute call task' — with an audit log of every time they fire. Open Automations.",
      spotlight: "nav-automations",
      spotlightHint: "Click Automations →",
      advance: { kind: "navigate", pathname: "/app/automations" },
    },
    {
      id: "reports",
      title: "21 · Reports",
      body: "The numbers that run the business: booking rate, pipeline value, lead-source ROI, urgency mix, and response times. Open Reports.",
      spotlight: "nav-reports",
      spotlightHint: "Click Reports →",
      advance: { kind: "navigate", pathname: "/app/reports" },
    },
    {
      id: "crm-sync",
      title: "22 · CRM Sync",
      body: "Use this as your CRM, or as an AI layer on top of an existing one: push clean contacts, deals, and AI notes to HubSpot — or dry-run to see the exact payload without touching anything. Open CRM Sync.",
      spotlight: "nav-crm-sync",
      spotlightHint: "Click CRM Sync →",
      advance: { kind: "navigate", pathname: "/app/crm-sync" },
    },
    {
      id: "settings",
      title: "23 · Settings",
      body: "Company profile, AI on/off toggles, default tone, and the team roster. Open Settings.",
      spotlight: "nav-settings",
      spotlightHint: "Click Settings →",
      advance: { kind: "navigate", pathname: "/app/settings" },
    },
    {
      id: "done",
      title: "🎉 That's the full system",
      body: "Every call, text, email, lead, task, appointment, and note you just saw is a real record. Only the outward communication is simulated. Wire up Twilio (voice/SMS), Resend (email), and a HubSpot token and the exact same workflow goes live. Thanks for taking the tour!",
      advance: { kind: "manual" },
    },
  ];

  const total = steps.length;
  const step = steps[index];

  // ── Persistence ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStorage.getItem(ACTIVE_KEY) === "1") {
      setActive(true);
      setIndex(Number(sessionStorage.getItem(INDEX_KEY) ?? 0));
    }
    void getDemoGuideContext().then((ctx) => {
      setSarahId(ctx.sarah?.id ?? null);
      setSarahPhone(ctx.sarah?.phone ?? null);
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("tutorial-open", active);
    sessionStorage.setItem(ACTIVE_KEY, active ? "1" : "0");
    return () => document.body.classList.remove("tutorial-open");
  }, [active]);

  useEffect(() => {
    sessionStorage.setItem(INDEX_KEY, String(index));
    enteredAtPath.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const go = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(total - 1, next))),
    [total]
  );

  const start = useCallback(() => {
    setActive(true);
    setIndex(0);
    router.push("/app");
  }, [router]);

  const stop = useCallback(() => {
    setActive(false);
    setIndex(0);
  }, []);

  // ── Auto-advance on navigation ──────────────────────────────────────────
  useEffect(() => {
    if (!active || !step) return;
    if (step.advance.kind === "navigate") {
      if (pathname === step.advance.pathname && pathname !== enteredAtPath.current) {
        go(index + 1);
      }
    } else if (step.advance.kind === "navigatePrefix") {
      const { prefix } = step.advance;
      if (pathname.startsWith(prefix) && pathname.length > prefix.length && pathname !== enteredAtPath.current) {
        go(index + 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, active, index]);

  async function runAction() {
    if (!step.action) return;
    setRunning(true);
    try {
      await step.action.run({ startCall, router, sarahId, sarahPhone });
      go(index + 1);
    } catch {
      // run() already surfaced the error via toast.
    } finally {
      setRunning(false);
    }
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={start}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-dark px-4 py-2.5 text-sm font-medium text-white shadow-xl transition-transform hover:scale-105"
      >
        <GraduationCap className="h-4 w-4 text-brand-gold" />
        Start guided tour
      </button>
    );
  }

  const ActionIcon = step.action?.icon;

  return (
    <>
      {step.spotlight && <Spotlight target={step.spotlight} />}

      <aside className="fixed right-0 top-0 z-40 flex h-screen w-[340px] max-w-[90vw] flex-col border-l bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b bg-brand-dark px-4 py-3 text-white">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 text-brand-gold" />
            Guided tour
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/15 text-[10px] text-white">
              {index + 1} / {total}
            </Badge>
            <button
              type="button"
              onClick={stop}
              className="rounded p-0.5 text-white/60 hover:text-white"
              aria-label="Exit tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full bg-brand-gold transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>

          {step.spotlightHint && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-sm font-medium text-brand-dark">
              <MousePointerClick className="h-4 w-4 shrink-0" />
              {step.spotlightHint}
            </p>
          )}

          {step.action && (
            <Button className="mt-4 w-full" onClick={runAction} disabled={running}>
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : ActionIcon ? (
                <ActionIcon className="h-4 w-4" />
              ) : null}
              {step.action.label}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go(index - 1)}
            disabled={index === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>

          {step.advance.kind === "manual" ? (
            index === total - 1 ? (
              <Button size="sm" onClick={stop}>
                Finish
              </Button>
            ) : (
              <Button size="sm" onClick={() => go(index + 1)}>
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )
          ) : (
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Skip this step →
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
