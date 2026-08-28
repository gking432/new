"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Database,
  GraduationCap,
  Headphones,
  Loader2,
  Mail,
  MessageSquareText,
  MousePointerClick,
  PhoneOutgoing,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCall, useLiveCall } from "@/components/calls/CallProvider";
import { LeadForm } from "@/components/public/LeadForm";
import { Spotlight } from "@/components/tutorial/Spotlight";
import { ensureDemoStorylineLead } from "@/lib/actions/demo";
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
  nextLabel?: string;
  spotlight?: string;
  spotlightHint?: string;
  action?: { label: string; icon?: React.ComponentType<{ className?: string }>; run: (ctx: RunCtx) => Promise<void> | void };
  simulate?: { label: string };
  transition?: {
    eyebrow: string;
    summary: string;
    details: Array<{ label: string; value: string }>;
    tools: string[];
    productionNote: string;
    nextLabel: string;
    inspect?: {
      label: string;
      path?: string;
    };
  };
  advance: Advance;
}

type TourMode = "full" | "executive";

const INDEX_KEY = "northstar-tutorial-index";
const ACTIVE_KEY = "northstar-tutorial-active";
const COMPLETED_KEY = "northstar-tutorial-completed";
const EXECUTIVE_INDEX_KEY = "northstar-executive-tour-index";
const EXECUTIVE_ACTIVE_KEY = "northstar-executive-tour-active";
const EXECUTIVE_COMPLETED_KEY = "northstar-executive-tour-completed";
const SELECTED_MODE_KEY = "northstar-selected-tour-mode";
const CHOOSER_DISMISSED_KEY = "northstar-tour-chooser-dismissed";

function storageKeys(mode: TourMode) {
  return mode === "executive"
    ? {
        index: EXECUTIVE_INDEX_KEY,
        active: EXECUTIVE_ACTIVE_KEY,
        completed: EXECUTIVE_COMPLETED_KEY,
      }
    : { index: INDEX_KEY, active: ACTIVE_KEY, completed: COMPLETED_KEY };
}

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
  const [tourMode, setTourMode] = useState<TourMode | null>(null);
  const [running, setRunning] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [welcomeMorphing, setWelcomeMorphing] = useState(false);
  const [confirmSimulationOpen, setConfirmSimulationOpen] = useState(false);
  const [showManualNext, setShowManualNext] = useState(true);
  const [pulseNext, setPulseNext] = useState(false);
  const [storylineLeadId, setStorylineLeadId] = useState<string | null>(null);
  const [gregLeadId, setGregLeadId] = useState<string | null>(null);
  const welcomeHandledRef = useRef<string | null>(null);

  // ── Step definitions ──────────────────────────────────────────────────────
  const fullSteps: Step[] = [
    {
      id: "welcome",
      title: "Welcome. This is an AI-assisted CRM demo.",
      body: "This tour walks through the parts of the system that matter most: AI-assisted calls, live note taking, lead follow-up, message drafting, scheduling, tasks, reports, and automations.\n\nThe demo happens inside this CRM so you can see the work clearly. The same AI tools could also sit on top of an existing CRM, phone system, calendar, inbox, or workflow.\n\nReal demo records are created as you go. Customer-facing calls, texts, and emails are simulated, so nothing is sent to real customers.",
      advance: { kind: "manual" },
    },
    {
      id: "you-answer",
      title: "First, you are the sales rep.",
      body: "Act as the company rep and watch the AI help in real time.\n\nWhat to do:\n1. Click Start.\n2. Answer the browser call, or choose Simulate call for a silent walkthrough.\n3. In the live version, ask for the customer's name, phone, email, address, what happened, how urgent it is, and when they want an inspection.\n4. When you schedule, try asking about 5:30 tomorrow first.\n\nThe CRM starts blank because the system does not know who is calling yet. As the conversation progresses, the AI fills the lead form, drafts CRM notes, and checks the schedule.",
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
      body: "This step shows the AI assistant handling a new website lead.\n\nA homeowner fills out the form. The AI calls back quickly, gathers details, checks the CRM, and books an inspection. Fast speed-to-lead is one benefit, but the bigger point is the AI phone person and scheduler doing real follow-up work.\n\nWhat to do:\n1. Click Open form.\n2. Put in your real first and last name.\n3. Use fake contact details if you want.\n4. Submit the request.\n5. Answer the browser call, or choose Simulate call for a silent walkthrough.\n\nYou are now the customer.",
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
      title: "The same customer texts back.",
      body: "The lead created earlier sends an urgent update: the leak is getting worse and they want someone there sooner.\n\nWatch the notification at the top of the screen. The CRM resolves the exact lead, flags the message urgent, and looks for an earlier estimator opening.",
      action: {
        label: "Send text",
        icon: MessageSquareText,
        run: async () => {
          const context = await ensureDemoStorylineLead(storylineLeadId);
          if (!context.success) {
            toast.error(context.error);
            throw new Error(context.error);
          }
          setStorylineLeadId(context.data.lead.id);
          const r = await simulateInboundText({ leadId: context.data.lead.id });
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
          window.dispatchEvent(new CustomEvent("northstar-inbox-updated"));
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
      body: "You just saw the whole loop.\n\nA lead came in. The AI helped with calls, notes, messages, appointments, tasks, reminders, reports, and automations.\n\nThe customer-facing calls and sends are simulated, but the workflow records are real. In production, these AI capabilities could connect to phone, SMS, email, calendar, and the CRM or workflow tools a company already uses.",
      advance: { kind: "manual" },
    },
  ];

  const fullStep = (id: string) => fullSteps.find((candidate) => candidate.id === id)!;
  const executiveSteps: Step[] = [
    {
      ...fullStep("speed-to-lead"),
      title: "See the AI phone scheduler in action.",
      body: "A homeowner submits a request, and the AI calls back while the lead is still fresh.\n\nYou can answer and act as the homeowner, or simulate the call for a faster walkthrough. The AI gathers project details, checks real openings, books the inspection, writes the CRM note, and prepares the follow-up work.",
    },
    fullStep("answer-call"),
    fullStep("follow-form-notifications"),
    fullStep("open-form-confirmation-task"),
    fullStep("open-form-approval-queue"),
    {
      ...fullStep("approve-form-confirmation"),
      body: "Review the appointment details, then approve and send the confirmation.\n\nThis approval is a configurable guardrail. A company can require human review, or allow routine confirmations and reminders to send automatically.",
    },
    {
      id: "executive-lead-recap",
      title: "The homeowner workflow is complete.",
      body: "",
      transition: {
        eyebrow: "Technical workflow recap",
        summary:
          "A sparse website request became a qualified CRM record, a booked inspection, an auditable activity history, a follow-up task, and a human-approved confirmation.",
        details: [
          { label: "Trigger", value: "Website form submission created the identity-matched lead." },
          {
            label: "AI orchestration",
            value:
              "The voice workflow gathered the missing project context, applied qualification rules, and selected a real appointment opening.",
          },
          {
            label: "System writes",
            value:
              "The workflow updated the lead, created the appointment and task, appended CRM activity, and generated the confirmation draft.",
          },
          {
            label: "Human control",
            value: "An approval policy stopped the outbound SMS until a team member reviewed it.",
          },
        ],
        tools: [
          "lead.upsert",
          "availability.search",
          "appointment.create",
          "activity.append",
          "task.create",
          "message.draft",
        ],
        productionNote:
          "This demo executes through application tools and server actions. In production, those tool contracts can wrap HubSpot or Salesforce, Google or Microsoft calendars, Twilio, and MCP servers without changing the orchestration story.",
        nextLabel: "Alright—meet Greg's email",
        inspect: {
          label: "View the lead record first",
          path: storylineLeadId ? `/app/leads/${storylineLeadId}` : "/app/leads",
        },
      },
      advance: { kind: "manual" },
    },
    {
      id: "executive-lead-record-review",
      title: "Inspect the completed lead record.",
      body: "This started as only a name and phone number. The voice workflow turned it into a qualified CRM record with the homeowner's project details, appointment, AI analysis, follow-up task, communication, and an auditable activity history.\n\nExplore the record for as long as you like. When you are ready, use the button below to continue to Greg's email.",
      nextLabel: "Continue to Greg's email",
      advance: { kind: "manual" },
    },
    {
      id: "executive-email",
      title: "Now Greg sends an email about 12 windows.",
      body: "The first homeowner workflow is complete. Next, Greg Tomlinson emails about replacing 12 windows before winter. He says weekdays after 3 PM work best.\n\nClick Receive Greg's email. The Inbox notification appears immediately, just like it would for a real inbound message.",
      action: {
        label: "Receive Greg's email",
        icon: Mail,
        run: async (ctx) => {
          const r = await simulateInboundEmail({ executiveScheduling: true });
          if (!r.success) {
            toast.error(r.error);
            throw new Error(r.error);
          }
          setGregLeadId(r.data.leadId);
          r.data.events.forEach(appendDemoEvent);
          window.dispatchEvent(new CustomEvent("northstar-inbox-updated"));
          toast("New scheduling email", {
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
      id: "executive-open-email",
      title: "Greg sent an email about some windows.",
      body: "The notification is immediate. Greg's message is waiting in Inbox.\n\nOpen Inbox and read the customer's original email before asking the AI to do anything.",
      spotlight: "nav-inbox",
      spotlightHint: "Open Inbox to read Greg's email",
      advance: { kind: "event", event: "northstar-nav-inbox-clicked" },
    },
    {
      id: "executive-read-email",
      title: "Read Greg's request first.",
      body: "Greg wants to replace 12 original windows before winter. He asks for a measurement visit next week and says weekdays after 3 PM work best.\n\nThis is still the customer's raw email. Nothing has been sent, no appointment has moved, and the AI has not drafted the response yet. Take a moment to read it, then click Next.",
      spotlight: "inbox-executive-email",
      spotlightHint: "Read Greg's original email",
      advance: { kind: "manual" },
    },
    {
      ...fullStep("reply-email"),
      id: "executive-reply-email",
      title: "Now ask the AI to draft the reply.",
      body: "The AI action happens now. Click Reply, then Draft a response.\n\nThe AI will use Greg's project details and weekday-after-3 PM constraint, check available estimator times, and write a response that offers real openings. Nothing is sent until you review it.",
      spotlightHint: "Click Reply, then Draft a response",
    },
    {
      ...fullStep("send-email-reply"),
      id: "executive-send-email-reply",
      title: "Review the AI-drafted reply.",
      body: "Read the draft in context with Greg's email. It should acknowledge the 12-window project and offer real weekday openings after 3 PM.\n\nYou can edit it before sending. When it looks right, click Send reply. Demo mode logs the email without contacting anyone or booking an appointment before Greg responds.",
      spotlightHint: "Review the draft, then send the reply",
    },
    {
      id: "executive-email-recap",
      title: "Greg's email workflow is complete.",
      body: "",
      transition: {
        eyebrow: "Technical workflow recap",
        summary:
          "An unstructured inbound email became a matched CRM lead, structured scheduling constraints, a calendar-aware response, and a logged customer communication—with no premature booking.",
        details: [
          { label: "Trigger", value: "An inbound email webhook created the Greg conversation." },
          {
            label: "AI orchestration",
            value:
              "The workflow extracted the 12-window scope and weekday-after-3 PM constraint, queried availability, and composed a grounded reply.",
          },
          {
            label: "System writes",
            value:
              "Greg's lead and email thread were persisted, and the simulated outbound reply was appended to the same customer timeline.",
          },
          {
            label: "Human control",
            value:
              "The draft stayed editable and unsent until the user reviewed it. No appointment was created without a customer response.",
          },
        ],
        tools: [
          "email.ingest",
          "contact.match",
          "lead.upsert",
          "availability.search",
          "reply.generate",
          "communication.append",
        ],
        productionNote:
          "In a real deployment, Gmail or Microsoft Graph could provide the mailbox event, the CRM could be exposed through direct APIs or MCP, and calendar availability could be another typed tool available to the model.",
        nextLabel: "Alright—test reputation triage",
        inspect: {
          label: "View Greg's CRM record first",
          path: gregLeadId ? `/app/leads/${gregLeadId}` : "/app/leads",
        },
      },
      advance: { kind: "manual" },
    },
    {
      id: "executive-greg-record-review",
      title: "Inspect Greg's completed CRM record.",
      body: "Greg's unstructured email is now attached to a real lead with structured project scope, scheduling constraints, the original message, the AI-assisted response, and a customer activity trail. No appointment was invented or booked before Greg agreed.\n\nExplore the record, then continue when you are ready to see reputation triage.",
      nextLabel: "Continue to reputation triage",
      advance: { kind: "manual" },
    },
    {
      id: "executive-feedback",
      title: "Now test AI reputation triage.",
      body: "A scheduling workflow protects revenue before the job. Review management protects the customer relationship after the work.\n\nOpen Feedback to test a new public review. You will provide the input and run the analysis yourself.",
      spotlight: "nav-feedback",
      spotlightHint: "Open Feedback",
      advance: { kind: "navigate", pathname: "/app/feedback" },
    },
    {
      id: "executive-load-review",
      title: "Load a real customer-service problem.",
      body: "Load the 2-star review. It describes a completed repair, repeated scheduling problems, missed callbacks, and a customer asking for a manager.\n\nNothing has been classified yet. Click the button to put that raw review into the analyzer.",
      spotlight: "feedback-load-demo",
      spotlightHint: "Load the 2-star review",
      advance: { kind: "event", event: "northstar-feedback-loaded" },
    },
    {
      id: "executive-analyze-review",
      title: "Turn the review into work.",
      body: "Click Analyze Feedback. The AI will score sentiment and risk, identify the operating problem, recommend a manager action, draft a public response, and create a review task when the risk is high.",
      spotlight: "feedback-analyze",
      spotlightHint: "Analyze the review",
      advance: { kind: "event", event: "northstar-feedback-analyzed" },
    },
    {
      id: "executive-review-result",
      title: "The AI created actionable work.",
      body: "The review is no longer just a star rating. The system turned it into a risk level, complaint themes, an internal recovery action, an editable public-response draft, and a manager task.\n\nThe Tasks badge is the operational handoff. Click Next, then follow that notification so the complaint is actually resolved instead of merely analyzed.",
      spotlight: "feedback-analysis-result",
      spotlightHint: "Review the AI analysis",
      advance: { kind: "manual" },
    },
    {
      id: "executive-open-review-task",
      title: "Follow the reputation-risk task.",
      body: "The high-risk review created due-now work for the manager. Open Tasks to see the complaint, recommended recovery action, priority, and response handoff in the same queue as the rest of the business's work.",
      spotlight: "nav-tasks",
      spotlightHint: "Open Tasks",
      advance: { kind: "navigate", pathname: "/app/tasks" },
    },
    {
      id: "executive-review-task",
      title: "Open the review response task.",
      body: "This is the accountability layer: the complaint has an owner, priority, due time, and recommended action. Click Review & respond to return to the stored analysis and public-response draft.",
      spotlight: "task-review-response-link",
      spotlightHint: "Open Review & respond",
      advance: { kind: "navigate", pathname: "/app/feedback" },
    },
    {
      id: "executive-post-review-response",
      title: "Review and post the public response.",
      body: "The AI draft is editable. Read it, make any change you want, then approve the simulated Google response. Posting records the response and automatically completes the manager task, clearing the Tasks notification.",
      spotlight: "feedback-post-response",
      spotlightHint: "Approve the response and complete the task",
      advance: { kind: "event", event: "northstar-feedback-response-posted" },
    },
    {
      id: "executive-feedback-recap",
      title: "The customer-risk workflow is complete.",
      body: "",
      transition: {
        eyebrow: "Technical workflow recap",
        summary:
          "A raw two-star review became structured risk data, complaint themes, a recovery recommendation, trackable manager work, and a human-approved public response.",
        details: [
          { label: "Trigger", value: "A new review entered the feedback analyzer." },
          {
            label: "AI orchestration",
            value:
              "Structured output classified sentiment, escalation risk, operational themes, and the recommended next action.",
          },
          {
            label: "System writes",
            value:
              "The analysis and response draft were stored, business rules created a due-now manager task, and posting the response completed that task and cleared the notification.",
          },
          {
            label: "Human control",
            value:
              "The system routed and drafted the work; a manager reviewed, edited, and approved the public response before it was posted.",
          },
        ],
        tools: [
          "feedback.analyze",
          "risk.classify",
          "response.draft",
          "task.create",
          "review.publish",
          "task.complete",
          "audit.append",
        ],
        productionNote:
          "The same pattern can start from Google Business Profile, Yelp, survey software, or a support platform. API adapters or MCP servers normalize those sources into one typed workflow.",
        nextLabel: "Alright—wrap up the executive tour",
        inspect: {
          label: "View the completed resolution first",
        },
      },
      advance: { kind: "manual" },
    },
    {
      id: "executive-feedback-analysis-review",
      title: "Inspect the completed customer-recovery workflow.",
      body: "The original review is now structured risk data, complaint themes, an internal recovery recommendation, a posted public response, and a completed manager task.\n\nLook over the entire page without any additional highlight. Finish the guided tour whenever you are ready.",
      nextLabel: "Finish the executive tour",
      advance: { kind: "manual" },
    },
    {
      id: "executive-done",
      title: "The guided story is complete. The CRM is yours to explore.",
      body: "You saw AI voice qualify a lead and schedule an inspection, configurable approval controls, email understanding, calendar-aware reply drafting, and a reputation workflow that ended with completed human work.\n\nClick Finish to remove the tour sidebar. Then feel free to click through every tab, inspect the leads and timelines you created, open calls and messages, change stages, use the quote tool, and experiment with the rest of the CRM. The demo remains fully interactive after the tour ends.",
      advance: { kind: "manual" },
    },
  ];

  const steps = tourMode === "executive" ? executiveSteps : fullSteps;

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
    "settings-view",
    "executive-read-email",
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
    "executive-open-email",
  ]);
  const showRequiredSpotlight = Boolean(
    step?.spotlight && (requiredOverlayStepIds.has(step.id) || tabClickStepIds.has(step.id))
  );
  const showSpotlightHighlight = Boolean(
    step?.spotlight &&
      (tourMode === "executive" || showRequiredSpotlight || highlightOnlyStepIds.has(step.id))
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
      setTourMode(null);
      writeTourStorage(CHOOSER_DISMISSED_KEY, "0");
      router.replace("/app");
      return;
    }

    const selected = readTourStorage(SELECTED_MODE_KEY);
    const savedMode: TourMode | null =
      selected === "executive" || selected === "full" ? selected : null;
    if (savedMode && readTourStorage(storageKeys(savedMode).active) === "1") {
      const keys = storageKeys(savedMode);
      setTourMode(savedMode);
      setActive(true);
      setIndex(Number(readTourStorage(keys.index) ?? 0));
      return;
    }
    // Preserve sessions created before the executive tour existed.
    if (readTourStorage(ACTIVE_KEY) === "1") {
      setTourMode("full");
      writeTourStorage(SELECTED_MODE_KEY, "full");
      setActive(true);
      setIndex(Number(readTourStorage(INDEX_KEY) ?? 0));
      return;
    }
    if (pathname.startsWith("/app")) {
      const completedSelected =
        savedMode && readTourStorage(storageKeys(savedMode).completed) === "1";
      if (completedSelected || readTourStorage(CHOOSER_DISMISSED_KEY) === "1") return;
      setActive(true);
      setIndex(0);
      setTourMode(null);
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const match = pathname.match(/^\/app\/leads\/([^/]+)$/);
    if (match?.[1] && match[1] !== "new") setStorylineLeadId(match[1]);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const href = window.location.href;
    const hasWelcomeParam = new URLSearchParams(window.location.search).get("tour") === "welcome";
    if (!hasWelcomeParam || welcomeHandledRef.current === href) return;
    welcomeHandledRef.current = href;
    setActive(true);
    setIndex(0);
    setTourMode(null);
    setWelcomeMorphing(false);
    writeTourStorage(CHOOSER_DISMISSED_KEY, "0");
    router.replace("/app");
  }, [pathname, router, searchParams]);

  const showTourDock =
    active && !compactSpotlight && Boolean(tourMode) && (step?.id !== "welcome" || welcomeMorphing);

  useEffect(() => {
    document.body.classList.toggle("tutorial-open", showTourDock);
    if (tourMode) {
      writeTourStorage(storageKeys(tourMode).active, active ? "1" : "0");
    }
    return () => document.body.classList.remove("tutorial-open");
  }, [active, showTourDock, tourMode]);

  useEffect(() => {
    if (tourMode) writeTourStorage(storageKeys(tourMode).index, String(index));
  }, [index, tourMode]);

  const go = useCallback(
    (next: number) => {
      setWelcomeMorphing(false);
      setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [total]
  );

  const start = useCallback(() => {
    const selected = readTourStorage(SELECTED_MODE_KEY);
    const savedMode: TourMode | null =
      selected === "executive" || selected === "full" ? selected : null;
    setActive(true);
    writeTourStorage(CHOOSER_DISMISSED_KEY, "0");
    if (!savedMode || readTourStorage(storageKeys(savedMode).completed) === "1") {
      setTourMode(null);
      setIndex(0);
    } else {
      const saved = Number(readTourStorage(storageKeys(savedMode).index) ?? 0);
      setTourMode(savedMode);
      setIndex(Math.max(0, Number.isFinite(saved) ? saved : 0));
      writeTourStorage(storageKeys(savedMode).active, "1");
    }
    router.push("/app");
  }, [router]);

  const stop = useCallback(() => {
    if (tourMode) {
      const keys = storageKeys(tourMode);
      writeTourStorage(keys.completed, index >= total - 1 ? "1" : "0");
      writeTourStorage(keys.active, "0");
      writeTourStorage(keys.index, String(index >= total - 1 ? total - 1 : index));
    } else {
      writeTourStorage(CHOOSER_DISMISSED_KEY, "1");
    }
    setActive(false);
    setWelcomeMorphing(false);
    setRequestFormOpen(false);
  }, [index, tourMode, total]);

  function startTourFromWelcome(mode: TourMode) {
    setWelcomeMorphing(true);
    const keys = storageKeys(mode);
    writeTourStorage(SELECTED_MODE_KEY, mode);
    writeTourStorage(CHOOSER_DISMISSED_KEY, "0");
    writeTourStorage(keys.completed, "0");
    writeTourStorage(keys.active, "1");
    writeTourStorage(keys.index, mode === "full" ? "1" : "0");
    window.setTimeout(() => {
      setTourMode(mode);
      setWelcomeMorphing(false);
      setIndex(mode === "full" ? 1 : 0);
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
  }, [pathname, active, index, tourMode]);

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
  }, [active, index, pathname, tourMode]);

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
        setStorylineLeadId(lead.leadId);
        startCall({
          scenario: "speed_to_lead_outbound",
          leadId: lead.leadId,
          callerName: "Northstar Exterior & Home",
          callerPhone: lead.phone,
          subtitle: "AI Scheduling Assistant",
          direction: "inbound",
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

  if (step.transition) {
    const inspect = step.transition.inspect;
    return (
      <>
        {requestFormOverlay}
        {simulationConfirm}
        <TechnicalTransitionModal
          step={step}
          index={index}
          total={total}
          onNext={() => go(index + (inspect ? 2 : 1))}
          onInspect={
            inspect
              ? () => {
                  if (inspect.path) router.push(inspect.path);
                  go(index + 1);
                }
              : undefined
          }
          onStop={stop}
        />
      </>
    );
  }

  if (!tourMode || step.id === "welcome") {
    return (
      <>
        {requestFormOverlay}
        {simulationConfirm}
        <WelcomeTourModal
          step={fullSteps[0]}
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
          mode={tourMode}
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
        <Spotlight target={step.spotlight} stepKey={step.id} wiggle={false} />
      )}
      <TutorialTooltip
        stepKey={step.id}
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
        mode={tourMode}
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
  target: string;
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
    const anchorTarget = target;
    let raf = 0;
    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${anchorTarget}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        setRect(null);
        return;
      }
      setRect({ target: anchorTarget, top: r.top, left: r.left, width: r.width, height: r.height });
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

  return rect?.target === target ? rect : null;
}

function WelcomeTourModal({
  step,
  morphing,
  onStart,
  onStop,
}: {
  step: Step;
  morphing: boolean;
  onStart: (mode: TourMode) => void;
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
                Choose your tour
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
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            See how AI voice, scheduling, messaging, and CRM workflow completion work together.
            Customer-facing calls and sends are simulated, so nothing reaches a real customer.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onStart("executive")}
              disabled={morphing}
              className="rounded-lg border-2 border-brand-gold bg-brand-gold/10 p-4 text-left transition-colors hover:bg-brand-gold/15 disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold">Executive Tour</span>
                <Badge className="bg-brand-gold text-brand-dark">Recommended</Badge>
              </span>
              <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-brand-dark/70">
                About 8 minutes
              </span>
              <span className="mt-2 block text-sm leading-5 text-muted-foreground">
                Live or silent call simulation, calendar-aware scheduling, AI-drafted email
                replies, approval controls, and reputation-risk triage.
              </span>
              <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                Start executive tour <ChevronRight className="h-4 w-4" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onStart("full")}
              disabled={morphing}
              className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-secondary/50 disabled:opacity-60"
            >
              <span className="font-semibold">Full Guided Tour</span>
              <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Complete guided walkthrough
              </span>
              <span className="mt-2 block text-sm leading-5 text-muted-foreground">
                Explore every scenario, including rep-assisted calls, rescheduling, quoting,
                feedback, settings, and the full CRM workflow.
              </span>
              <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                Start full tour <ChevronRight className="h-4 w-4" />
              </span>
            </button>
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
  }) => void;
}) {
  return (
    <div className="fixed inset-y-0 left-0 right-0 z-30 overflow-y-auto bg-zinc-950/70 p-6 backdrop-blur-sm lg:right-[340px]">
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-xl border bg-background shadow-2xl md:grid-cols-[0.8fr_1.2fr]">
          <div className="border-b bg-zinc-900 p-7 text-white md:border-b-0 md:border-r">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
                Speed-to-lead workflow
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close form"
                className="h-8 w-8 text-white hover:bg-white/10 hover:text-white md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              One request becomes a complete CRM workflow.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/75">
              Submit this desktop website form. The demo creates or matches the lead, starts the
              callback, captures the conversation, books an inspection, and prepares the next
              customer message for approval.
            </p>
            <div className="mt-5 rounded-lg border border-brand-gold/40 bg-brand-gold/10 p-3">
              <p className="text-sm font-semibold text-brand-gold">You are the customer.</p>
              <p className="mt-1 text-sm leading-5 text-white/75">
                Enter a name and phone number, then answer the callback. Riley must discover the
                project, urgency, and scheduling needs during the conversation.
              </p>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              {["Identity-matched CRM record", "Calendar-aware scheduling", "Human-approved follow-up"].map(
                (item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-md bg-white/10 p-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-xs font-bold text-zinc-950">
                      {index + 1}
                    </span>
                    {item}
                  </div>
                )
              )}
            </div>
          </div>
          <div className="max-h-[88vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-background/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
                  Customer request
                </p>
                <h2 className="text-base font-semibold">Create the storyline lead</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close form"
                className="hidden h-8 w-8 md:inline-flex"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6">
              <LeadForm dashboardDemo showDemoFill onDashboardSubmit={onSubmit} />
            </div>
          </div>
        </section>
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
        <h2 className="mt-2 text-lg font-semibold tracking-tight">Choose the right pace for the room.</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The live call demonstrates the voice experience. Simulate call runs the same downstream
          CRM, scheduling, task, and approval workflow without using audio.
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

function TechnicalTransitionModal({
  step,
  index,
  total,
  onNext,
  onInspect,
  onStop,
}: {
  step: Step;
  index: number;
  total: number;
  onNext: () => void;
  onInspect?: () => void;
  onStop: () => void;
}) {
  const recap = step.transition!;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-blue-950/10 p-4 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="technical-recap-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-blue-200 bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 rounded-t-2xl bg-brand-dark px-5 py-4 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20 text-blue-200">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
                {recap.eyebrow}
              </p>
              <p className="mt-0.5 text-xs text-white/60">
                Executive tour · {index + 1} / {total}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onStop}
            className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Exit tour"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              What just happened
            </p>
            <h2 id="technical-recap-title" className="mt-2 text-2xl font-semibold tracking-tight">
              {step.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{recap.summary}</p>

            <div className="mt-6 space-y-3">
              {recap.details.map((detail) => (
                <div key={detail.label} className="grid gap-1 rounded-lg border bg-card p-3 sm:grid-cols-[130px_1fr] sm:gap-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {detail.label}
                  </p>
                  <p className="text-sm leading-5 text-muted-foreground">{detail.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t bg-blue-50/60 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-blue-900">
              <Workflow className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Tool-oriented architecture</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-blue-950/70">
              The orchestration layer works through narrow, auditable tool contracts rather than
              giving the model unrestricted system access.
            </p>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Workflow tools">
              {recap.tools.map((tool) => (
                <code
                  key={tool}
                  className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-900 shadow-sm"
                >
                  {tool}
                </code>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-blue-200 bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                <Database className="h-4 w-4" />
                Production integration
              </p>
              <p className="mt-2 text-sm leading-6 text-blue-950/70">{recap.productionNote}</p>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-900 px-3 py-3 text-blue-50">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs leading-5">
                Each tool can enforce authentication, schema validation, permissions, retries,
                idempotency, and audit logging outside the model.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
          {recap.inspect && onInspect && (
            <Button
              variant="outline"
              onClick={onInspect}
              className="min-w-64 border-stone-300 bg-[#fffaf0] text-brand-dark hover:bg-[#f7efdf]"
            >
              <Database className="h-4 w-4" />
              {recap.inspect.label}
            </Button>
          )}
          <Button onClick={onNext} className="min-w-64">
            {recap.nextLabel}
            <ArrowRight className="h-4 w-4" />
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
  mode,
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
  mode: TourMode;
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
          {mode === "executive" ? "Executive tour" : "Guided tour"}
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
            {step.nextLabel ?? "Next"}
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
            <span className="px-2 text-xs text-muted-foreground">
              Use the button above when you are ready
            </span>
          )
        ) : (
          <span className="px-2 text-xs text-muted-foreground">Waiting for the dashboard action…</span>
        )}
      </div>
    </aside>
  );
}

function TutorialTooltip({
  stepKey,
  step,
  running,
  role,
  onRunAction,
  onRunSimulation,
}: {
  stepKey: string;
  step: Step;
  running: boolean;
  role: string | null;
  onRunAction: () => void;
  onRunSimulation: () => void;
}) {
  const rect = useAnchorRect(step.spotlight);
  const [visible, setVisible] = useState(false);
  const hasAnchor = rect !== null;
  const ActionIcon = step.action?.icon;
  const width = Math.min(320, typeof window === "undefined" ? 320 : window.innerWidth - 32);

  useEffect(() => {
    setVisible(false);
    if (!hasAnchor) {
      return;
    }
    const revealTimer = window.setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(revealTimer);
  }, [hasAnchor, stepKey]);

  const style = (() => {
    if (!rect || typeof window === "undefined") return { width } as React.CSSProperties;
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
      data-testid="tour-tooltip"
      className={`fixed z-50 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-white/15 bg-zinc-700 text-white shadow-2xl transition-opacity duration-500 ease-out motion-reduce:transition-none ${
        hasAnchor && visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
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
