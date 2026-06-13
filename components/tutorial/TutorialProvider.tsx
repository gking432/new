"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Headphones,
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
import { useCall, useLiveCall } from "@/components/calls/CallProvider";
import { createDemoSpeedToLead, getDemoGuideContext } from "@/lib/actions/demo";
import { simulateInboundEmail, simulateInboundText } from "@/lib/actions/inbox";
import { appendDemoEvent } from "@/lib/demo-log";
import { Spotlight } from "./Spotlight";

type Advance =
  | { kind: "manual" }
  | { kind: "action" }
  | { kind: "event"; event: string }
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

export function TutorialProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const { startCall } = useCall();
  const live = useLiveCall();

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
      body: "Answer the phone in the top-left corner. You're the homeowner — talk to the assistant (or click through). Watch the live transcript and the details the AI captures. When the call ends it creates the lead, books the inspection, adds tasks, and drafts a confirmation text — then this advances automatically.",
      advance: { kind: "event", event: "northstar-call-done" },
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
      body: "Open the conversation, tweak the AI-drafted text if you like, then Approve & send. In demo mode the send is simulated and shows up in the thread — then this advances automatically.",
      spotlight: "inbox-draft",
      spotlightHint: "Find the AI-drafted reply and Approve & send",
      advance: { kind: "event", event: "northstar-comm-sent" },
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
      title: "6 · Open the new lead",
      body: "Your new lead is right at the top of the list. Click that top row to open the full record: contact info, AI analysis, call history, the timeline, quote, and CRM-sync status — all in one place. (Later you'll also see how to search and filter to find any lead.)",
      spotlight: "leads-first-row",
      spotlightHint: "Click the top row to open the lead",
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
      body: "Notice the matched CRM record before you pick up. This one's AI-to-AI: the assistant and Sarah both speak out loud (different voices), greeting her by name and referencing her storm-damage request — no re-asking what we know. It logs a second touchpoint on her timeline, then advances automatically.",
      advance: { kind: "event", event: "northstar-call-done" },
    },
    {
      id: "you-answer",
      title: "Bonus · Now YOU take a call",
      body: "Flip the roles: a new homeowner calls and you're the rep — the AI plays the customer. Click below, answer the phone in the top-left, and actually ask questions out loud.",
      action: {
        label: "A homeowner calls — you answer",
        icon: Headphones,
        run: (ctx) => {
          ctx.startCall({
            scenario: "new_inbound_call",
            persona: "customer",
            direction: "inbound",
            callerName: "Jordan Avery",
            callerPhone: "(414) 555-0123",
            seedFields: JORDAN_SEED,
            navigateTo: "/app/leads/new",
          });
        },
      },
      advance: { kind: "action" },
    },
    {
      id: "you-answer-watch",
      title: "Bonus · Watch the form fill as you ask",
      body: "The live intake form fills from what Jordan tells you and flags in RED anything you still need to ask for — so nothing slips on the call. Hang up when you're done; the AI writes the note and saves the lead, then this advances. (This mode needs your mic + an OpenAI key — if it can't connect, it says so instead of inventing answers.)",
      advance: { kind: "event", event: "northstar-call-done" },
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
      body: "Open her thread — you'll see her text and the AI's drafted response. Approve & send it; this advances automatically once it's sent.",
      spotlight: "inbox-draft",
      spotlightHint: "Review the AI reply and Approve & send",
      advance: { kind: "event", event: "northstar-comm-sent" },
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
      body: "That banner flagged the email URGENT — new leads are the most time-sensitive (speed-to-lead wins jobs), while existing customers are lower priority unless they report a problem with completed work. Open the new email thread here and approve the AI's reply, then click Next.",
      spotlight: "inbox-draft",
      spotlightHint: "Open the new email and review its AI reply",
      advance: { kind: "manual" },
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

  // Advance steps that wait for a real interaction (a call finishing, a message
  // being sent) — never via a button.
  useEffect(() => {
    if (!active || !step || step.advance.kind !== "event") return;
    const ev = step.advance.event;
    const handler = () => go(index + 1);
    window.addEventListener(ev, handler);
    return () => window.removeEventListener(ev, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index]);

  // Safety net: a quiet "skip" only appears if the user is stuck on an
  // interaction step for a while (so the tour is never a dead end).
  const [showSafetySkip, setShowSafetySkip] = useState(false);
  useEffect(() => {
    setShowSafetySkip(false);
    if (step?.advance.kind === "manual") return;
    const t = setTimeout(() => setShowSafetySkip(true), 30_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

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

  // While a call is live, spell out exactly which role the user is playing.
  function callRole(): string | null {
    if (!live || !["incoming", "dialing", "connecting", "connected"].includes(live.phase)) {
      return null;
    }
    if (live.scenario === "speed_to_lead_outbound") {
      return "📞 You are the CUSTOMER — answer and act as the homeowner. Watch the AI take notes.";
    }
    if (live.scenario === "existing_customer_call") {
      return "👀 Sit back and WATCH — this call is AI ↔ AI (our assistant and the customer, both out loud).";
    }
    if (live.persona === "customer") {
      return "🎧 You are the COMPANY REP — answer the call and ask the questions. Watch the form fill.";
    }
    return "📞 You are the CUSTOMER (the caller) — the AI assistant is answering.";
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
          {callRole() && (
            <p className="mb-3 rounded-lg border-2 border-brand-gold bg-brand-gold/15 px-3 py-2 text-sm font-semibold text-brand-dark">
              {callRole()}
            </p>
          )}

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
          ) : showSafetySkip ? (
            // Only appears if you've been stuck a while — keeps the tour from
            // ever dead-ending without putting a fake "next" on real steps.
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Stuck? Skip →
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {step.advance.kind === "event" ? "Waiting for you…" : "Do it in the app to continue"}
            </span>
          )}
        </div>
      </aside>
    </>
  );
}
