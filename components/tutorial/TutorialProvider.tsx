"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Headphones,
  Loader2,
  Mail,
  MessageSquareText,
  MousePointerClick,
  PhoneOutgoing,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCall, useLiveCall } from "@/components/calls/CallProvider";
import { LeadForm } from "@/components/public/LeadForm";
import { Spotlight } from "@/components/tutorial/Spotlight";
import { simulateInboundEmail, simulateInboundText } from "@/lib/actions/inbox";
import { appendDemoEvent } from "@/lib/demo-log";

type Advance =
  | { kind: "manual" }
  | { kind: "action" }
  | { kind: "event"; event: string }
  | { kind: "navigate"; pathname: string }
  | { kind: "navigatePrefix"; prefix: string };

interface RunCtx {
  startCall: ReturnType<typeof useCall>["startCall"];
  simulateRepAssistedCall: ReturnType<typeof useCall>["simulateRepAssistedCall"];
  simulateCustomerCall: ReturnType<typeof useCall>["simulateCustomerCall"];
  router: ReturnType<typeof useRouter>;
}

interface Step {
  id: string;
  title: string;
  body: string;
  spotlight?: string;
  spotlightHint?: string;
  action?: { label: string; icon?: React.ComponentType<{ className?: string }>; run: (ctx: RunCtx) => Promise<void> | void };
  simulate?: { label: string };
  advance: Advance;
}

const INDEX_KEY = "northstar-tutorial-index";
const ACTIVE_KEY = "northstar-tutorial-active";
const COMPLETED_KEY = "northstar-tutorial-completed";

function readTourStorage(key: string) {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeTourStorage(key: string, value: string) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage can be disabled in embedded browsers; the tour still works in memory.
  }
}

export function TutorialProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startCall, simulateRepAssistedCall, simulateCustomerCall } = useCall();
  const live = useLiveCall();

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [welcomeMorphing, setWelcomeMorphing] = useState(false);
  const [confirmSimulationOpen, setConfirmSimulationOpen] = useState(false);
  const [showManualNext, setShowManualNext] = useState(true);
  const [pulseNext, setPulseNext] = useState(false);
  const welcomeHandledRef = useRef<string | null>(null);

  // ── Step definitions ──────────────────────────────────────────────────────
  const steps: Step[] = [
    {
      id: "welcome",
      title: "Welcome. This is an AI-assisted CRM demo.",
      body: "This tour walks through the parts of the system that matter most: AI-assisted calls, live note taking, lead follow-up, message drafting, scheduling, tasks, reports, automations, and CRM sync.\n\nThe demo happens inside this CRM so you can see the work clearly. The same AI tools could also sit on top of an existing CRM, phone system, calendar, inbox, or workflow.\n\nReal demo records are created as you go. Calls, texts, emails, and CRM syncs are simulated, so nothing is sent to real customers.",
      advance: { kind: "manual" },
    },
    {
      id: "you-answer",
      title: "First, you are the sales rep.",
      body: "Act as the company rep and watch the AI help in real time.\n\nWhat to do:\n1. Click Start.\n2. Answer the fake call in the top-left.\n3. Have your audio on and talk out loud.\n4. Ask for the customer's name, phone, email, address, what happened, how urgent it is, and when they want an inspection.\n5. When you schedule, try asking about 5:30 tomorrow first.\n\nThe CRM starts blank because the system does not know who is calling yet. As the customer answers, the AI listens, fills the lead form, drafts CRM notes, and checks the schedule while you talk.",
      action: {
        label: "Start",
        icon: Headphones,
        run: (ctx) => {
          ctx.startCall({
            scenario: "new_inbound_call",
            persona: "customer",
            direction: "inbound",
            callerName: "Unknown Caller",
            callerPhone: "(414) 555-0123",
            navigateTo: "/app/leads/new",
            waitForManualLeadOpen: true,
          });
        },
      },
      simulate: {
        label: "Simulate call",
      },
      advance: { kind: "action" },
    },
    {
      id: "you-answer-watch",
      title: "Watch the AI help during the call.",
      body: "Stay on the call and keep acting as the sales rep.\n\nThe AI is listening for useful details. It fills the lead form as the homeowner talks and drafts notes while the call is still happening.\n\nWhen you ask about appointment times, watch the AI scheduling assist. It will flag a bad slot, suggest what to ask next, and select the real opening once the customer agrees.\n\nWhen you are done, hang up. After the call ends, click Save lead so the record opens in the CRM.",
      advance: { kind: "event", event: "northstar-call-done" },
    },
    {
      id: "save-first-lead",
      title: "Save the lead.",
      body: "The call is done. The AI captured the important details and prepared the CRM record.\n\nMake sure the AI scheduling assist says Booking ready, then click Save lead. This is the handoff from the call into the CRM: the rep reviews the record, then saves it.",
      spotlight: "lead-intake-save",
      spotlightHint: "Click Save lead",
      advance: { kind: "navigatePrefix", prefix: "/app/leads/" },
    },
    {
      id: "lead-detail-overview",
      title: "This is the lead detail page.",
      body: "This page shows the customer info, request details, activity timeline, open tasks, upcoming appointments, call notes, and AI analysis.\n\nThe key point: the call became a real CRM record. The system captured the details, booked the inspection, wrote the note, and created the next task.\n\nClick Next when you have looked it over.",
      advance: { kind: "manual" },
    },
    {
      id: "go-tasks-confirmation",
      title: "A task notification appeared. Check it.",
      body: "The AI booked the inspection and drafted a confirmation text.\n\nThis demo uses human approval for customer messages, so the next step is to review that SMS before it is sent.\n\nClick Tasks in the left menu.",
      spotlight: "nav-tasks",
      spotlightHint: "Click Tasks",
      advance: { kind: "navigate", pathname: "/app/tasks" },
    },
    {
      id: "open-confirmation-task",
      title: "Open the confirmation task.",
      body: "The task points you to the AI-written confirmation text.\n\nClick the message icon on the task to open the draft in the Inbox.",
      spotlight: "task-confirmation-link",
      spotlightHint: "Open the AI draft",
      advance: { kind: "navigate", pathname: "/app/inbox" },
    },
    {
      id: "open-approval-queue",
      title: "Open the Approval Queue.",
      body: "The confirmation is waiting in Approval Queue.\n\nIn a real company, messages like this could send automatically or wait for approval. Here, you get to inspect the AI draft first.\n\nClick Approval Queue.",
      spotlight: "inbox-approvals",
      spotlightHint: "Click Approval Queue",
      advance: { kind: "event", event: "northstar-inbox-approvals-opened" },
    },
    {
      id: "approve-1",
      title: "Review and send the confirmation.",
      body: "Read the confirmation SMS.\n\nIt should say the appointment date and time. It should also tell the customer they can reply if they need to reschedule.\n\nIf it looks good, click Approve & send. Nothing real is sent in demo mode.",
      spotlight: "inbox-thread",
      spotlightHint: "Review the SMS, then approve it",
      advance: { kind: "event", event: "northstar-comm-sent" },
    },
    {
      id: "go-leads-after-confirm",
      title: "The task is complete.",
      body: "Nice. The confirmation text is now logged, and the task badge should clear.\n\nNext, open Leads so you can see how the CRM record changed.",
      spotlight: "nav-leads",
      spotlightHint: "Click Leads",
      advance: { kind: "navigate", pathname: "/app/leads" },
    },
    {
      id: "open-jordan-after-confirm",
      title: "Open Jordan's lead.",
      body: "Open Jordan Avery's record.\n\nThis is where the team can see the full customer story after the text is sent.",
      spotlight: "leads-first-row",
      spotlightHint: "Open Jordan Avery",
      advance: { kind: "navigatePrefix", prefix: "/app/leads/" },
    },
    {
      id: "timeline-after-confirm",
      title: "The timeline updated.",
      body: "The sent confirmation is now part of the activity timeline.\n\nThis is the value of the AI layer: the customer touchpoint, the task, and the CRM history stay connected.",
      spotlight: "lead-timeline",
      spotlightHint: "Review the latest timeline item",
      advance: { kind: "manual" },
    },
    {
      id: "speed-to-lead",
      title: "Now meet the AI phone scheduler.",
      body: "This step shows the AI assistant handling a new website lead.\n\nA homeowner fills out the form. The AI calls back quickly, gathers details, checks the CRM, and books an inspection. Fast speed-to-lead is one benefit, but the bigger point is the AI phone person and scheduler doing real follow-up work.\n\nWhat to do:\n1. Click Open form.\n2. Put in your real first and last name.\n3. Use fake contact details if you want.\n4. Submit the request.\n5. Turn your audio up and answer the fake AI call.\n\nYou are now the customer.",
      action: {
        label: "Open form",
        icon: PhoneOutgoing,
        run: () => {
          setRequestFormOpen(true);
        },
      },
      advance: { kind: "event", event: "northstar-call-started" },
    },
    {
      id: "answer-call",
      title: "Answer the fake AI call.",
      body: "The phone should ring in the top-left.\n\nWhat to do:\n1. Answer the call.\n2. Keep acting like the homeowner.\n3. Tell the AI what happened.\n4. Let the AI book an inspection time.\n5. Hang up when the call is done.\n\nWatch what happens after the call: the app creates the lead, writes the CRM note, books the appointment, creates tasks, and drafts a confirmation text for a human to approve.",
      simulate: {
        label: "Simulate call",
      },
      advance: { kind: "event", event: "northstar-call-done" },
    },
    {
      id: "follow-form-notifications",
      title: "Follow the task notification.",
      body: "The AI phone assistant finished the web-lead call and updated the CRM.\n\nA task badge means there is work waiting for the team. In this case, the AI booked the inspection and wrote a confirmation text.\n\nClick Tasks and follow the notification.",
      spotlight: "nav-tasks",
      spotlightHint: "Click Tasks",
      advance: { kind: "navigate", pathname: "/app/tasks" },
    },
    {
      id: "open-form-confirmation-task",
      title: "Open the confirmation task.",
      body: "The task tells the team exactly what to review.\n\nClick the task or the message icon. It opens the AI-written confirmation in the Approval Queue.",
      spotlight: "task-confirmation-link",
      spotlightHint: "Open the AI draft",
      advance: { kind: "navigate", pathname: "/app/inbox" },
    },
    {
      id: "open-form-approval-queue",
      title: "Review the AI draft.",
      body: "The confirmation text is waiting in Approval Queue.\n\nThis demo asks a human to approve it. In a real rollout, simple appointment confirmations and reminders could also be sent automatically.",
      spotlight: "inbox-approvals",
      spotlightHint: "Open Approval Queue",
      advance: { kind: "event", event: "northstar-inbox-approvals-opened" },
    },
    {
      id: "approve-form-confirmation",
      title: "Send the confirmation.",
      body: "Read the SMS and make sure the appointment time matches the call.\n\nThen click Approve & send. Demo mode logs the message without sending anything to a real customer.",
      spotlight: "inbox-thread",
      spotlightHint: "Approve and send",
      advance: { kind: "event", event: "northstar-comm-sent" },
    },
    {
      id: "text",
      title: "Remember Jordan Avery? They text back.",
      body: "Jordan sends an urgent update: the leak is getting worse and they want someone there sooner.\n\nWatch the notification at the top of the screen. The AI matches the phone number, flags the message urgent, and looks for an earlier estimator opening.",
      action: {
        label: "Send text",
        icon: MessageSquareText,
        run: async () => {
          const r = await simulateInboundText();
          if (!r.success) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          r.data.events.forEach(appendDemoEvent);
          toast("Urgent", {
            description: r.data.headline,
            position: "top-center",
            duration: 9000,
            action: {
              label: "Open message",
              onClick: () => {
                router.push(`/app/inbox?tab=conversations&lead=${r.data.leadId ?? ""}`);
              },
            },
          });
        },
      },
      advance: { kind: "action" },
    },
    {
      id: "go-inbox-urgent-text",
      title: "Open the urgent text.",
      body: "The Inbox badge means a real customer message needs attention.\n\nIf you are already in Inbox, click Conversations. If you are somewhere else, open Inbox first, then click Conversations.\n\nReview Jordan's message with the AI scheduling note.",
      spotlight: "inbox-conversations",
      spotlightHint: "Click Conversations",
      advance: { kind: "event", event: "northstar-inbox-conversations-opened" },
    },
    {
      id: "check-jess-availability",
      title: "Check the estimator opening.",
      body: "The AI found an earlier opening with Jess Romero.\n\nBefore replying, check the calendar so the team can trust the suggested time.",
      spotlight: "inbox-ai-insight-check",
      spotlightHint: "Check Jess availability",
      advance: { kind: "navigate", pathname: "/app/appointments" },
    },
    {
      id: "jess-calendar",
      title: "Jess's availability is filtered.",
      body: "The AI has already filtered the calendar to Jess Romero and the suggested date.\n\nThe highlighted slot is the same opening the AI found in the customer text thread. You do not need to change anything here; this step shows how the AI verifies the schedule before it suggests a time.",
      spotlight: "appointments-suggested-slot",
      spotlightHint: "AI-found opening",
      advance: { kind: "manual" },
    },
    {
      id: "back-to-inbox-reschedule",
      title: "Go back to Jordan's text.",
      body: "Now that the opening is verified, go back to Jordan's text by clicking Inbox, or by following the Tasks/message notification if one is visible.\n\nThe AI can draft the message asking Jordan if that earlier time works.",
      spotlight: "nav-inbox",
      spotlightHint: "Click Inbox",
      advance: { kind: "navigate", pathname: "/app/inbox" },
    },
    {
      id: "draft-reschedule-offer",
      title: "Draft the reschedule text.",
      body: "Use the AI scheduling note to draft a short SMS asking if the earlier time works.\n\nThe customer message stays visible, so the team can judge the AI response in context.",
      spotlight: "inbox-ai-insight-draft",
      spotlightHint: "Draft the SMS",
      advance: { kind: "event", event: "northstar-reschedule-offer-drafted" },
    },
    {
      id: "approve-reschedule-offer",
      title: "Ask Jordan if the time works.",
      body: "The draft appears under the conversation.\n\nThis is still a human-approved step in the demo, but a company could make this fully automatic for low-risk scheduling messages.\n\nReview it, then approve and send it. Jordan will reply in the demo. The CRM will move the appointment and send the updated confirmation automatically.",
      spotlight: "inbox-approve",
      spotlightHint: "Approve the reschedule offer",
      advance: { kind: "event", event: "northstar-comm-sent" },
    },
    {
      id: "go-appointments-after-reschedule",
      title: "See the booking on the calendar.",
      body: "Jordan accepted the earlier time. The AI moved the appointment and sent the updated confirmation automatically.\n\nGo to Appointments. Jess Romero's schedule now includes the booked inspection, and in a real rollout Jess could get a dashboard notification as soon as the booking is made.",
      spotlight: "nav-appointments",
      spotlightHint: "Click Appointments",
      advance: { kind: "navigate", pathname: "/app/appointments" },
    },
    {
      id: "jess-booked-after-reschedule",
      title: "Jess has the new appointment.",
      body: "Jess Romero's calendar now shows the booked inspection.\n\nThis is the operational payoff: the customer text, availability check, reschedule, confirmation, and estimator calendar all stay connected.\n\nThe AI assistant booked the appointment, notified Jess, and blocked the time so it is no longer offered as open availability.",
      spotlight: "appointments-estimator-calendar",
      spotlightHint: "Review Jess's calendar",
      advance: { kind: "manual" },
    },
    {
      id: "email",
      title: "A brand-new lead emails in",
      body: "Now a brand-new person sends an email about replacing 12 windows.\n\nWatch how the AI turns that email into a CRM lead. It picks the service type, writes a summary, and flags the Inbox conversation.\n\nNew leads are time-sensitive, so the system treats this as urgent.",
      action: {
        label: "Receive email lead",
        icon: Mail,
        run: async (ctx) => {
          const r = await simulateInboundEmail();
          if (!r.success) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          r.data.events.forEach(appendDemoEvent);
          toast("New email", {
            description: r.data.headline,
            position: "top-center",
            duration: 12000,
            action: { label: "Open Inbox", onClick: () => ctx.router.push("/app/inbox") },
          });
        },
      },
      advance: { kind: "action" },
    },
    {
      id: "go-inbox-email",
      title: "Open the new email.",
      body: "The 12-window lead came in as an email, so the notification belongs on Inbox and Conversations.\n\nOpen Inbox. If you are already there, click Conversations. This is a normal customer email, not an automatic follow-up draft.",
      spotlight: "nav-inbox",
      spotlightHint: "Open Inbox",
      advance: { kind: "event", event: "northstar-inbox-conversations-opened" },
    },
    {
      id: "reply-email",
      title: "Reply like a normal email.",
      body: "The message looks like an email thread.\n\nClick Reply, then choose Draft a response. The AI writes a starting point, but the team stays in control before anything goes out.\n\nApproval Queue is for automatic follow-ups and reminders. This email stays in Conversations.",
      spotlight: "inbox-email-reply",
      spotlightHint: "Click Reply, then Draft a response",
      advance: { kind: "event", event: "northstar-email-draft-opened" },
    },
    {
      id: "send-email-reply",
      title: "Send the email reply.",
      body: "Review the AI-written email response.\n\nIf it looks good, click Send reply. In demo mode, sending is simulated, but the CRM still logs the conversation.",
      spotlight: "inbox-email-composer",
      spotlightHint: "Click Send reply",
      advance: { kind: "event", event: "northstar-comm-sent" },
    },
    {
      id: "pipeline",
      title: "Open Pipeline.",
      body: "Click Pipeline in the left menu.",
      spotlight: "nav-pipeline",
      spotlightHint: "Click Pipeline",
      advance: { kind: "navigate", pathname: "/app/pipeline" },
    },
    {
      id: "pipeline-view",
      title: "This is the Pipeline.",
      body: "The Pipeline shows where each lead is in the sales process.\n\nWhen Greg Tomlinson emailed in, he started as a new lead. After the email reply was sent, the AI moved him into Contacted and logged that the first touch happened by email.\n\nA person can still update stages manually. The AI can also move cards when calls finish, appointments are booked, estimates are sent, or follow-up is due.\n\nRemember: this AI workflow layer can be added to another CRM too. It does not only work inside this demo CRM.",
      advance: { kind: "manual" },
    },
    {
      id: "quote-tool",
      title: "Open Quote Tool.",
      body: "Click Quote Tool in the left menu. You can select any lead from the demo, generate a property profile, and get a saved internal range.",
      spotlight: "nav-quote-tool",
      spotlightHint: "Click Quote Tool",
      advance: { kind: "navigate", pathname: "/app/quote-tool" },
    },
    {
      id: "quote-tool-view",
      title: "This is the Quote Tool.",
      body: "This page helps the team create an internal ballpark before an inspection.\n\nTry this:\n1. Select a lead on the left.\n2. Click Generate demo property profile.\n3. Adjust the inputs if needed.\n4. Click Generate internal ballpark.\n\nThe AI value is speed and consistency: it gathers property context, applies assumptions, lists missing info, and saves the internal range to the lead timeline. It is not a customer-facing quote.",
      advance: { kind: "manual" },
    },
    {
      id: "feedback",
      title: "Open Feedback.",
      body: "Click Feedback in the left menu.",
      spotlight: "nav-feedback",
      spotlightHint: "Click Feedback",
      advance: { kind: "navigate", pathname: "/app/feedback" },
    },
    {
      id: "feedback-view",
      title: "This is Feedback.",
      body: "Review management is a major part of home-service operations.\n\nThis page brings Google, Yelp, Yellow Pages, and survey-style feedback into one place.\n\nThe AI reads each review, scores sentiment, flags reputation risk, finds repeated service issues, and suggests a manager response. That turns scattered public feedback into customer-service work the team can actually handle.",
      advance: { kind: "manual" },
    },
    {
      id: "automations",
      title: "Open Automations.",
      body: "Click Automations in the left menu.",
      spotlight: "nav-automations",
      spotlightHint: "Click Automations",
      advance: { kind: "navigate", pathname: "/app/automations" },
    },
    {
      id: "automations-view",
      title: "This is Automations.",
      body: "Automations show the business-systems side of the demo.\n\nFilter the library by business unit: sales, marketing, customer service, operations, administration, and IT.\n\nThese are workflow ideas a home-improvement company could actually use: speed-to-lead alerts, missed-call rescue, review-risk triage, estimator prep packets, weather-aware reschedules, duplicate cleanup, and integration health monitoring.\n\nThey could be built inside this custom CRM, or connected to an existing CRM with Zapier, Make, Power Automate, n8n, custom APIs, or native CRM automations.",
      advance: { kind: "manual" },
    },
    {
      id: "reports",
      title: "Open Reports.",
      body: "Click Reports in the left menu.",
      spotlight: "nav-reports",
      spotlightHint: "Click Reports",
      advance: { kind: "navigate", pathname: "/app/reports" },
    },
    {
      id: "reports-view",
      title: "This is Reports.",
      body: "Reports turn CRM activity into management insight.\n\nLeaders can see lead volume, booking rate, source performance, pipeline value, close rate, follow-up health, and operational bottlenecks.\n\nThe AI role is to summarize what changed, explain why it matters, surface risks, and point managers toward the few actions that deserve attention first.",
      advance: { kind: "manual" },
    },
    {
      id: "crm-sync",
      title: "Open CRM Sync.",
      body: "Click CRM Sync in the left menu.",
      spotlight: "nav-crm-sync",
      spotlightHint: "Click CRM Sync",
      advance: { kind: "navigate", pathname: "/app/crm-sync" },
    },
    {
      id: "crm-sync-view",
      title: "This is CRM Sync.",
      body: "This app is a custom CRM demo, but the most important part is the AI automation layer.\n\nThat layer can create and sync contacts, deals, notes, tasks, appointments, call summaries, message drafts, approval events, and audit logs.\n\nThose same AI workflows could connect to HubSpot, JobNimbus, ServiceTitan, Zapier, n8n, Make, Power Automate, or another system already used by the business.\n\nThat is the integration story: build useful AI workflows first, then connect them to the tools the company already trusts.",
      advance: { kind: "manual" },
    },
    {
      id: "settings",
      title: "Open Settings.",
      body: "Finally, open Settings.",
      spotlight: "nav-settings",
      spotlightHint: "Click Settings →",
      advance: { kind: "navigate", pathname: "/app/settings" },
    },
    {
      id: "settings-view",
      title: "This is Settings.",
      body: "Settings hold the company profile, team, AI controls, default tone, approval rules, and business rules.\n\nThis is where a manager would tune how the system behaves before a real rollout.",
      advance: { kind: "manual" },
    },
    {
      id: "done",
      title: "That is the full system.",
      body: "You just saw the whole loop.\n\nA lead came in. The AI helped with calls, notes, messages, appointments, tasks, reminders, reports, automations, and CRM sync.\n\nThe demo uses fake calls and fake sends, but the records are real. In production, these AI workflows could connect to phone, SMS, email, calendar, and the CRM or workflow tools a company already uses.",
      advance: { kind: "manual" },
    },
  ];

  const total = steps.length;
  const step = steps[index];
  // Don't allow Back into a phone-call step: the call already happened and the
  // call event can't re-fire, so returning there strands the tour waiting for a
  // call that already finished. (Other event steps — opening the inbox, etc. —
  // are re-triggerable, so Back stays available for them.)
  const prevAdvance = steps[index - 1]?.advance;
  const canGoBack =
    index > 0 &&
    !(
      prevAdvance?.kind === "event" &&
      (prevAdvance.event === "northstar-call-started" ||
        prevAdvance.event === "northstar-call-done")
    );
  const stepId = step?.id;
  const stepAdvanceKind = step?.advance.kind;
  const compactSpotlight = false;
  const tabClickStepIds = new Set([
    "pipeline",
    "quote-tool",
    "feedback",
    "automations",
    "reports",
    "crm-sync",
    "settings",
  ]);
  const requiredOverlayStepIds = new Set([
    "save-first-lead",
    "go-tasks-confirmation",
    "open-confirmation-task",
    "open-approval-queue",
    "approve-1",
    "go-leads-after-confirm",
    "open-jordan-after-confirm",
    "timeline-after-confirm",
    "follow-form-notifications",
    "open-form-confirmation-task",
    "open-form-approval-queue",
    "approve-form-confirmation",
  ]);
  const delayedNextStepIds = new Set([
    "pipeline-view",
    "quote-tool-view",
    "feedback-view",
    "automations-view",
    "reports-view",
    "crm-sync-view",
    "settings-view",
  ]);
  const highlightOnlyStepIds = new Set([
    "go-inbox-urgent-text",
    "check-jess-availability",
    "jess-calendar",
    "back-to-inbox-reschedule",
    "draft-reschedule-offer",
    "approve-reschedule-offer",
    "go-appointments-after-reschedule",
    "jess-booked-after-reschedule",
  ]);
  const showSpotlightOverlay = Boolean(
    step?.spotlight && (requiredOverlayStepIds.has(step.id) || tabClickStepIds.has(step.id))
  );
  const showSpotlightHighlight = Boolean(
    step?.spotlight && (showSpotlightOverlay || highlightOnlyStepIds.has(step.id))
  );

  // ── Persistence ─────────────────────────────────────────────────────────
  useEffect(() => {
    const hasWelcomeParam =
      searchParams.get("tour") === "welcome" ||
      (typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("tour") === "welcome");
    if (hasWelcomeParam) {
      welcomeHandledRef.current = typeof window !== "undefined" ? window.location.href : "initial";
      setActive(true);
      setIndex(0);
      writeTourStorage(COMPLETED_KEY, "0");
      writeTourStorage(ACTIVE_KEY, "1");
      writeTourStorage(INDEX_KEY, "0");
      router.replace("/app");
      return;
    }
    if (readTourStorage(ACTIVE_KEY) === "1") {
      setActive(true);
      setIndex(Number(readTourStorage(INDEX_KEY) ?? 0));
      return;
    }
    if (pathname.startsWith("/app")) {
      if (readTourStorage(COMPLETED_KEY) === "1") return;
      setActive(true);
      setIndex(0);
      writeTourStorage(ACTIVE_KEY, "1");
      writeTourStorage(INDEX_KEY, "0");
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const href = window.location.href;
    const hasWelcomeParam = new URLSearchParams(window.location.search).get("tour") === "welcome";
    if (!hasWelcomeParam || welcomeHandledRef.current === href) return;
    welcomeHandledRef.current = href;
    setActive(true);
    setIndex(0);
    setWelcomeMorphing(false);
    writeTourStorage(COMPLETED_KEY, "0");
    writeTourStorage(ACTIVE_KEY, "1");
    writeTourStorage(INDEX_KEY, "0");
    router.replace("/app");
  }, [pathname, router, searchParams]);

  useEffect(() => {
    document.body.classList.toggle(
      "tutorial-open",
      active && !compactSpotlight && (step?.id !== "welcome" || welcomeMorphing)
    );
    writeTourStorage(ACTIVE_KEY, active ? "1" : "0");
    return () => document.body.classList.remove("tutorial-open");
  }, [active, compactSpotlight, step?.id, welcomeMorphing]);

  useEffect(() => {
    writeTourStorage(INDEX_KEY, String(index));
  }, [index]);

  const go = useCallback(
    (next: number) => {
      setWelcomeMorphing(false);
      setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [total]
  );

  const start = useCallback(() => {
    const saved = Number(readTourStorage(INDEX_KEY) ?? index);
    setActive(true);
    writeTourStorage(COMPLETED_KEY, "0");
    setIndex(Math.max(0, Math.min(total - 1, Number.isFinite(saved) ? saved : 0)));
    router.push("/app");
  }, [index, router, total]);

  const stop = useCallback(() => {
    writeTourStorage(COMPLETED_KEY, "1");
    writeTourStorage(ACTIVE_KEY, "0");
    writeTourStorage(INDEX_KEY, String(index >= total - 1 ? total - 1 : index));
    setActive(false);
    setWelcomeMorphing(false);
    setRequestFormOpen(false);
  }, [index, total]);

  function startTourFromWelcome() {
    setWelcomeMorphing(true);
    writeTourStorage(COMPLETED_KEY, "0");
    window.setTimeout(() => {
      setWelcomeMorphing(false);
      go(1);
    }, 520);
  }

  useEffect(() => {
    setShowManualNext(!delayedNextStepIds.has(stepId ?? ""));
    if (!active || !stepId || !delayedNextStepIds.has(stepId)) return;
    const timer = window.setTimeout(() => setShowManualNext(true), 3000);
    return () => window.clearTimeout(timer);
  }, [active, index, stepId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPulseNext(false);
    if (!active || stepAdvanceKind !== "manual" || !showManualNext) return;
    if (stepId === "answer-call") return;
    const timer = window.setTimeout(() => setPulseNext(true), 5000);
    return () => window.clearTimeout(timer);
  }, [active, index, stepAdvanceKind, stepId, showManualNext]);

  // ── Auto-advance on navigation ──────────────────────────────────────────
  useEffect(() => {
    if (!active || !step) return;
    if (step.advance.kind === "navigate") {
      if (pathname === step.advance.pathname) {
        go(index + 1);
      }
    } else if (step.advance.kind === "navigatePrefix") {
      const { prefix } = step.advance;
      const suffix = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
      if (suffix && suffix !== "new") {
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
    if (
      ev === "northstar-inbox-conversations-opened" &&
      pathname === "/app/inbox" &&
      window.__northstarInboxTab === "conversations"
    ) {
      go(index + 1);
      return;
    }
    if (
      ev === "northstar-inbox-approvals-opened" &&
      pathname === "/app/inbox" &&
      window.__northstarInboxTab === "approvals"
    ) {
      go(index + 1);
      return;
    }
    const handler = () => go(index + 1);
    window.addEventListener(ev, handler);
    return () => window.removeEventListener(ev, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, pathname]);

  async function runAction() {
    if (!step.action) return;
    setRunning(true);
    try {
      await step.action.run({ startCall, simulateRepAssistedCall, simulateCustomerCall, router });
      // Only advance immediately for pure action steps. Steps that wait on a
      // real event (e.g. the call starting after a cross-tab form submit) keep
      // their button but advance via that event instead.
      if (step.advance.kind === "action") go(index + 1);
    } catch {
      // run() already surfaced the error via toast.
    } finally {
      setRunning(false);
    }
  }

  async function runSimulation() {
    if (!step.simulate) return;
    setConfirmSimulationOpen(true);
  }

  function confirmSimulation() {
    setConfirmSimulationOpen(false);
    if (step.id === "you-answer") {
      simulateRepAssistedCall();
      go(index + 2);
      return;
    }
    if (step.id === "answer-call") {
      void simulateCustomerCall();
    }
  }

  // While a call is live, spell out exactly which role the user is playing.
  function callRole(): string | null {
    if (!live || !["incoming", "dialing", "connecting", "connected"].includes(live.phase)) {
      return null;
    }
    if (live.scenario === "speed_to_lead_outbound") {
      return "You are the customer. Answer the fake call and act like the homeowner. Watch the AI take notes.";
    }
    if (live.scenario === "existing_customer_call") {
      return `You are the customer (${live.callerName}). The AI assistant already knows this CRM record. Ask to move the appointment.`;
    }
    if (live.persona === "customer") {
      return "You are the company sales rep. Answer the call and ask simple questions. Watch the form fill.";
    }
    return "You are the customer. The AI assistant is answering.";
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={start}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-dark px-4 py-2.5 text-sm font-medium text-white shadow-xl transition-transform hover:scale-105"
      >
        <GraduationCap className="h-4 w-4 text-brand-gold" />
        Start Tour
      </button>
    );
  }

  const requestFormOverlay = requestFormOpen ? (
    <RequestFormOverlay
      onClose={() => setRequestFormOpen(false)}
      onSubmit={(lead) => {
        setRequestFormOpen(false);
        startCall({
          scenario: "speed_to_lead_outbound",
          leadId: lead.leadId,
          callerName: "Northstar Exterior & Home",
          callerPhone: lead.phone,
          subtitle: "AI Scheduling Assistant",
          direction: "inbound",
          seedFields: { service_type: lead.serviceType },
          navigateTo: `/app/leads/${lead.leadId}`,
        });
      }}
    />
  ) : null;
  const simulationConfirm = confirmSimulationOpen ? (
    <SimulationConfirmDialog
      onCancel={() => setConfirmSimulationOpen(false)}
      onConfirm={confirmSimulation}
    />
  ) : null;

  if (step.id === "welcome") {
    return (
      <>
        {requestFormOverlay}
        {simulationConfirm}
        <WelcomeTourModal
          step={step}
          morphing={welcomeMorphing}
          onStart={startTourFromWelcome}
          onStop={stop}
        />
      </>
    );
  }

  if (!step.spotlight) {
    return (
      <>
        {requestFormOverlay}
        {simulationConfirm}
        <TutorialSidebar
          step={step}
          index={index}
          total={total}
          running={running}
          role={callRole()}
          onRunAction={runAction}
          onRunSimulation={runSimulation}
          onBack={() => go(index - 1)}
          onNext={() => go(index + 1)}
          onStop={stop}
          pulseNext={pulseNext}
          showManualNext={showManualNext}
          canGoBack={canGoBack}
        />
      </>
    );
  }

  return (
    <>
      {requestFormOverlay}
      {simulationConfirm}
      {showSpotlightHighlight && (
        <Spotlight target={step.spotlight} dim={showSpotlightOverlay} wiggle={false} />
      )}
      <TutorialTooltip
        step={step}
        running={running}
        role={callRole()}
        onRunAction={runAction}
        onRunSimulation={runSimulation}
      />
      <TutorialSidebar
        step={step}
        index={index}
        total={total}
        running={running}
        role={callRole()}
        onRunAction={runAction}
        onRunSimulation={runSimulation}
        onBack={() => go(index - 1)}
        onNext={() => go(index + 1)}
        onStop={stop}
        pulseNext={pulseNext}
        showManualNext={showManualNext}
        canGoBack={canGoBack}
      />
    </>
  );
}

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useAnchorRect(target?: string) {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    let raf = 0;
    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        setRect(null);
        return;
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    const interval = setInterval(measure, 250);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [target]);

  return rect;
}

function WelcomeTourModal({
  step,
  morphing,
  onStart,
  onStop,
}: {
  step: Step;
  morphing: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[2px] transition-colors duration-500 ${
        morphing ? "bg-transparent backdrop-blur-0" : ""
      }`}
    >
      <section
        className={`tour-welcome-card ${morphing ? "tour-welcome-card--morphing" : ""}`}
      >
        <div
          className={`transition-opacity duration-200 ${
            morphing ? "opacity-0" : "opacity-100 delay-75"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-gold">
                <GraduationCap className="h-4 w-4" />
                Guided tour
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{step.title}</h2>
            </div>
            <button
              type="button"
              onClick={onStop}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Exit tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {step.body}
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={onStart} disabled={morphing}>
              Start Tour
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            morphing ? "opacity-100 delay-150" : "opacity-0"
          }`}
        >
          <div>
            <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-gold">
              <GraduationCap className="h-4 w-4" />
              Guided tour
            </p>
            <div className="mx-auto mt-4 h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-2/3 rounded-full bg-brand-gold" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function RequestFormOverlay({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (lead: {
    leadId: string;
    name: string;
    phone: string;
    serviceType: string;
  }) => void;
}) {
  return (
    <div className="fixed inset-y-0 left-0 right-0 z-30 overflow-y-auto bg-zinc-950/70 p-4 backdrop-blur-sm lg:right-[340px]">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center gap-6">
        <div className="hidden max-w-sm rounded-lg border border-white/15 bg-zinc-900/95 p-5 text-white shadow-2xl md:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
            Speed-to-lead
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            The best lead is the one you call back right away.
          </h2>
          <p className="mt-3 text-sm text-white/75">
            Many sales teams see far better contact rates when a new web lead gets a call inside
            the first minute. This demo shows that handoff: form submit, instant AI callback, booked
            inspection, and CRM update.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-white/10 p-3">
              <p className="text-2xl font-bold text-brand-gold">60 sec</p>
              <p className="mt-1 text-xs text-white/70">target callback window</p>
            </div>
            <div className="rounded-md bg-white/10 p-3">
              <p className="text-2xl font-bold text-brand-gold">24/7</p>
              <p className="mt-1 text-xs text-white/70">AI intake coverage</p>
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-[390px] rounded-[2.25rem] border-[10px] border-zinc-900 bg-zinc-900 shadow-2xl">
          <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-zinc-950" />
          <div className="max-h-[86vh] overflow-y-auto rounded-[1.55rem] bg-background pt-8">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
                  Mobile lead form
                </p>
                <h2 className="text-sm font-semibold">Use your name, then submit.</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close form"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <LeadForm dashboardDemo showDemoFill={false} onDashboardSubmit={onSubmit} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulationConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
          Simulate call?
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          I recommend doing the live call.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The best version of this demo is hearing the AI and watching the notes fill in while you
          talk. Simulate call will skip the voice part and fill the form with a sample conversation.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Keep live call
          </Button>
          <Button type="button" onClick={onConfirm}>
            Simulate call
          </Button>
        </div>
      </section>
    </div>
  );
}

function TutorialSidebar({
  step,
  index,
  total,
  running,
  role,
  onRunAction,
  onRunSimulation,
  onBack,
  onNext,
  onStop,
  pulseNext,
  showManualNext,
  canGoBack,
}: {
  step: Step;
  index: number;
  total: number;
  running: boolean;
  role: string | null;
  onRunAction: () => void;
  onRunSimulation: () => void;
  onBack: () => void;
  onNext: () => void;
  onStop: () => void;
  pulseNext: boolean;
  showManualNext: boolean;
  canGoBack: boolean;
}) {
  const ActionIcon = step.action?.icon;

  return (
    <aside className="fixed bottom-3 right-3 top-3 z-40 flex w-[340px] max-w-[90vw] flex-col overflow-hidden rounded-l-2xl rounded-r-lg border bg-card shadow-2xl">
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
            onClick={onStop}
            className="rounded p-0.5 text-white/60 hover:text-white"
            aria-label="Exit tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="h-1 w-full bg-secondary">
        <div
          className="h-full bg-brand-gold transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {role && (
          <p className="mb-3 rounded-lg border-2 border-brand-gold bg-brand-gold/15 px-3 py-2 text-sm font-semibold text-brand-dark">
            {role}
          </p>
        )}

        <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{step.body}</p>

        {step.action && (
          <Button
            className="mt-4 w-full whitespace-normal text-center leading-snug"
            onClick={onRunAction}
            disabled={running}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : ActionIcon ? (
              <ActionIcon className="h-4 w-4" />
            ) : null}
            {step.action.label}
          </Button>
        )}
        {step.simulate && (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full whitespace-normal text-center leading-snug"
            onClick={onRunSimulation}
            disabled={running}
          >
            {step.simulate.label}
          </Button>
        )}

        {/* Primary Next sits right under the instructions so it's obvious where
            to click. Only shown for steps that advance manually (and aren't the
            last step, which shows Finish in the footer instead). */}
        {step.advance.kind === "manual" && index !== total - 1 && showManualNext && (
          <Button
            onClick={onNext}
            data-tour="tutorial-next-button"
            className={`mt-4 w-full ring-2 ring-brand-gold ring-offset-2 ring-offset-background ${
              pulseNext ? "tour-target-wiggle" : ""
            }`}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t p-3">
        {canGoBack ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        ) : (
          <span />
        )}

        {step.advance.kind === "manual" ? (
          index === total - 1 ? (
            <Button size="sm" onClick={onStop}>
              Finish
            </Button>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">Click Next above to continue</span>
          )
        ) : (
          <span className="px-2 text-xs text-muted-foreground">Waiting for the dashboard action…</span>
        )}
      </div>
    </aside>
  );
}

function TutorialTooltip({
  step,
  running,
  role,
  onRunAction,
  onRunSimulation,
}: {
  step: Step;
  running: boolean;
  role: string | null;
  onRunAction: () => void;
  onRunSimulation: () => void;
}) {
  const rect = useAnchorRect(step.spotlight);
  const ActionIcon = step.action?.icon;
  const width = Math.min(320, typeof window === "undefined" ? 320 : window.innerWidth - 32);
  const style = (() => {
    if (!rect || typeof window === "undefined") {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width,
      } as React.CSSProperties;
    }
    const margin = 12;
    const estimatedHeight = 130;
    const sidebarWidth = window.innerWidth >= 1024 ? 340 : 0;
    const availableRight = window.innerWidth - sidebarWidth - 16;
    const rightSideLeft = rect.left + rect.width + margin;
    const leftSideLeft = rect.left - width - margin;
    const centeredLeft = rect.left + rect.width / 2 - width / 2;
    const belowTop = rect.top + rect.height + margin;
    const aboveTop = rect.top - estimatedHeight - margin;
    const useVertical = belowTop + estimatedHeight <= window.innerHeight - 16 || aboveTop >= 16;
    const rawLeft = useVertical
      ? centeredLeft
      : rightSideLeft + width <= availableRight
        ? rightSideLeft
        : leftSideLeft >= 16
          ? leftSideLeft
          : centeredLeft;
    const left = Math.min(Math.max(16, rawLeft), Math.max(16, availableRight - width));
    const rawTop = useVertical
      ? belowTop + estimatedHeight <= window.innerHeight - 16
        ? belowTop
        : aboveTop
      : rect.top + rect.height / 2 - estimatedHeight / 2;
    const top = Math.min(Math.max(16, rawTop), window.innerHeight - estimatedHeight - 16);
    return { left, top, width } as React.CSSProperties;
  })();

  return (
    <section
      className="fixed z-50 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-white/15 bg-zinc-700 text-white shadow-2xl"
      style={style}
    >
      <div className="space-y-3 p-3">
        <h3 className="text-sm font-bold leading-snug">{step.title}</h3>
        {role && (
          <p className="rounded-md border border-white/20 bg-white/10 px-2.5 py-2 text-xs font-semibold text-white">
            {role}
          </p>
        )}
        {step.spotlightHint && (
          <p className="flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-2 text-xs font-medium text-white/90">
            <MousePointerClick className="h-4 w-4 shrink-0" />
            {step.spotlightHint}
          </p>
        )}
        {step.action && (
          <Button
            className="w-full whitespace-normal text-center leading-snug"
            onClick={onRunAction}
            disabled={running}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : ActionIcon ? (
              <ActionIcon className="h-4 w-4" />
            ) : null}
            {step.action.label}
          </Button>
        )}
        {step.simulate && (
          <Button
            type="button"
            variant="secondary"
            className="w-full whitespace-normal text-center leading-snug"
            onClick={onRunSimulation}
            disabled={running}
          >
            {step.simulate.label}
          </Button>
        )}
      </div>
    </section>
  );
}
