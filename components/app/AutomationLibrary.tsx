"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type BusinessArea =
  | "Sales"
  | "Marketing"
  | "Customer Service"
  | "Operations"
  | "Administration"
  | "IT / Systems";

interface LibraryAutomation {
  area: BusinessArea;
  name: string;
  description: string;
  trigger: string;
  conditions: string;
  actions: string[];
  timesTriggered: number;
  lastRun: string;
  enabled: boolean;
}

const FILTERS: Array<"All" | BusinessArea> = [
  "All",
  "Sales",
  "Marketing",
  "Customer Service",
  "Operations",
  "Administration",
  "IT / Systems",
];

const AUTOMATION_LIBRARY: LibraryAutomation[] = [
  {
    area: "Sales",
    name: "Speed-to-lead SLA guardrail",
    description: "Protects the first response window after a new lead comes in.",
    trigger: "When a web, email, Facebook, or phone lead is created.",
    conditions: "No call, text, or assigned owner after 5 minutes.",
    actions: [
      "Ping the sales queue.",
      "Escalate to a manager at 10 minutes.",
      "Log the SLA miss for reporting.",
    ],
    timesTriggered: 18,
    lastRun: "2 hours ago",
    enabled: true,
  },
  {
    area: "Sales",
    name: "Missed-call rescue",
    description: "Turns missed calls and after-hours voicemail into tracked follow-up work.",
    trigger: "When a call is missed, abandoned, or lands after hours.",
    conditions: "Caller has a phone number and no open callback task.",
    actions: [
      "Transcribe voicemail.",
      "Match or create the lead.",
      "Text back and create a callback task.",
    ],
    timesTriggered: 7,
    lastRun: "Yesterday",
    enabled: true,
  },
  {
    area: "Sales",
    name: "Estimate follow-up sequence",
    description: "Keeps open estimates from going quiet after the rep sends pricing.",
    trigger: "When a lead moves to Estimate Sent.",
    conditions: "No customer response after 1, 3, and 7 business days.",
    actions: [
      "Draft SMS and email follow-ups.",
      "Rotate the message tone by touchpoint.",
      "Escalate high-value jobs to a rep.",
    ],
    timesTriggered: 12,
    lastRun: "3 days ago",
    enabled: true,
  },
  {
    area: "Sales",
    name: "Financing conversation starter",
    description: "Helps reps bring up monthly-payment options before price stalls the deal.",
    trigger: "When an estimate is above the financing threshold.",
    conditions: "Service is bath, windows, roofing, or siding.",
    actions: [
      "Draft financing-friendly follow-up language.",
      "Create a consult task for the rep.",
      "Tag the deal for financing reporting.",
    ],
    timesTriggered: 4,
    lastRun: "5 days ago",
    enabled: true,
  },
  {
    area: "Marketing",
    name: "Storm mode campaign switch",
    description: "Connects local weather events to faster, more relevant outreach.",
    trigger: "When hail, wind, or heavy rain hits a target ZIP code.",
    conditions: "Weather event is inside the service area.",
    actions: [
      "Flag new storm leads.",
      "Suggest ad copy and landing-page copy.",
      "Prepare a storm-damage call script.",
    ],
    timesTriggered: 3,
    lastRun: "Last week",
    enabled: true,
  },
  {
    area: "Marketing",
    name: "Lead source ROI digest",
    description: "Shows which channels are creating booked appointments and sold jobs.",
    trigger: "Every Monday morning.",
    conditions: "At least one lead was created in the prior week.",
    actions: [
      "Summarize leads by source.",
      "Compare booking rate, close rate, and value.",
      "Send a manager digest.",
    ],
    timesTriggered: 9,
    lastRun: "Monday",
    enabled: true,
  },
  {
    area: "Marketing",
    name: "Referral ask after a great review",
    description: "Turns happy customers into a repeatable referral channel.",
    trigger: "When a customer leaves a 5-star review or high survey score.",
    conditions: "Sentiment is positive and there is no open complaint.",
    actions: [
      "Draft a thank-you message.",
      "Ask for a neighbor or referral introduction.",
      "Tag the customer as a referral candidate.",
    ],
    timesTriggered: 6,
    lastRun: "4 days ago",
    enabled: true,
  },
  {
    area: "Customer Service",
    name: "Urgent leak escalation",
    description: "Keeps water-intrusion problems from sitting unnoticed.",
    trigger: "When a call, form, text, or email mentions active leaking.",
    conditions: "Message includes leak, water coming in, worse, ceiling, or storm damage.",
    actions: [
      "Mark the lead urgent.",
      "Create a same-day scheduling task.",
      "Notify a manager if no response happens.",
    ],
    timesTriggered: 14,
    lastRun: "Today",
    enabled: true,
  },
  {
    area: "Customer Service",
    name: "No-show recovery",
    description: "Saves appointments that would otherwise fall out of the pipeline.",
    trigger: "When an inspection is marked missed or customer not home.",
    conditions: "No reschedule is already booked.",
    actions: [
      "Draft apology and reschedule SMS.",
      "Create a follow-up task for the assigned rep.",
      "Keep the lead out of lost status for 48 hours.",
    ],
    timesTriggered: 5,
    lastRun: "6 days ago",
    enabled: true,
  },
  {
    area: "Customer Service",
    name: "Review risk triage",
    description: "Gets ahead of reputation damage from negative Google, Yelp, or Yellow Pages reviews.",
    trigger: "When a new review or survey has negative sentiment.",
    conditions: "Rating is 1 or 2 stars, or AI sentiment is negative.",
    actions: [
      "Summarize the issue.",
      "Assign a manager review task.",
      "Draft a calm public response.",
    ],
    timesTriggered: 8,
    lastRun: "Yesterday",
    enabled: true,
  },
  {
    area: "Operations",
    name: "Estimator prep packet",
    description: "Sends estimators into appointments with the context they need.",
    trigger: "When an inspection is booked.",
    conditions: "Lead has contact info and request notes.",
    actions: [
      "Compile call notes, property details, and service type.",
      "List objections and urgency signals.",
      "Send the prep packet before the visit.",
    ],
    timesTriggered: 21,
    lastRun: "1 hour ago",
    enabled: true,
  },
  {
    area: "Operations",
    name: "Weather-aware production reschedule",
    description: "Reduces last-minute chaos for roofing, siding, gutter, and exterior crews.",
    trigger: "When the forecast threatens an install day.",
    conditions: "Rain, wind, snow, or heat risk crosses the crew threshold.",
    actions: [
      "Flag affected jobs.",
      "Draft customer updates.",
      "Surface alternate crew windows.",
    ],
    timesTriggered: 2,
    lastRun: "Last month",
    enabled: true,
  },
  {
    area: "Operations",
    name: "Permit and HOA checklist",
    description: "Keeps admin details from blocking production after a sale.",
    trigger: "When a job is won in a city or subdivision with known requirements.",
    conditions: "Service type requires permit, HOA approval, or special paperwork.",
    actions: [
      "Create permit and HOA tasks.",
      "Ask for missing customer documents.",
      "Attach checklist to the job record.",
    ],
    timesTriggered: 10,
    lastRun: "2 days ago",
    enabled: true,
  },
  {
    area: "Operations",
    name: "Material readiness check",
    description: "Catches ordering gaps before the crew arrives on site.",
    trigger: "When a sold job moves to scheduled.",
    conditions: "Scope includes shingles, windows, gutters, siding, doors, or bath materials.",
    actions: [
      "Compare scope against ordered materials.",
      "Flag missing items.",
      "Notify production if a lead-time risk appears.",
    ],
    timesTriggered: 11,
    lastRun: "Yesterday",
    enabled: true,
  },
  {
    area: "Administration",
    name: "Aging pipeline manager digest",
    description: "Makes stale pipeline visible without daily manual CRM checking.",
    trigger: "Every weekday morning.",
    conditions: "Lead has sat in one stage longer than the target window.",
    actions: [
      "Group stale leads by rep, stage, and value.",
      "Recommend the next action.",
      "Send a manager digest.",
    ],
    timesTriggered: 16,
    lastRun: "Today",
    enabled: true,
  },
  {
    area: "Administration",
    name: "Duplicate and bad-data cleanup",
    description: "Keeps CRM data usable as lead volume grows.",
    trigger: "When a new lead matches an existing phone, email, or address.",
    conditions: "Match confidence is medium or high.",
    actions: [
      "Suggest a merge.",
      "Normalize phone and address fields.",
      "Warn before duplicate follow-up is sent.",
    ],
    timesTriggered: 13,
    lastRun: "Yesterday",
    enabled: true,
  },
  {
    area: "Administration",
    name: "Job-cost margin alert",
    description: "Connects sales promises to operational profitability.",
    trigger: "When actual material or labor cost exceeds the estimate plan.",
    conditions: "Variance is above the manager threshold.",
    actions: [
      "Notify owner or manager.",
      "Attach a variance note to the job.",
      "Include the issue in the weekly margin report.",
    ],
    timesTriggered: 1,
    lastRun: "Last month",
    enabled: false,
  },
  {
    area: "IT / Systems",
    name: "Integration health monitor",
    description: "Treats integrations like managed infrastructure, not a fragile demo.",
    trigger: "When CRM sync, phone, SMS, calendar, email, or webhook fails.",
    conditions: "Failure repeats or blocks customer-facing work.",
    actions: [
      "Log the failure.",
      "Retry with an audit trail.",
      "Notify the system admin if it still fails.",
    ],
    timesTriggered: 3,
    lastRun: "4 days ago",
    enabled: true,
  },
  {
    area: "IT / Systems",
    name: "Role-based AI guardrails",
    description: "Balances automation speed with customer safety and manager control.",
    trigger: "When AI drafts a message, task, summary, or sync payload.",
    conditions: "Risk level, channel, confidence, and department rules are checked.",
    actions: [
      "Auto-send low-risk confirmations.",
      "Require approval for high-risk replies.",
      "Block unsafe claims or data exposure.",
    ],
    timesTriggered: 29,
    lastRun: "Today",
    enabled: true,
  },
];

export function AutomationLibrary() {
  const [selectedArea, setSelectedArea] = useState<"All" | BusinessArea>("All");
  const [enabledByName, setEnabledByName] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AUTOMATION_LIBRARY.map((item) => [item.name, item.enabled]))
  );

  const filteredAutomations = useMemo(
    () =>
      selectedArea === "All"
        ? AUTOMATION_LIBRARY
        : AUTOMATION_LIBRARY.filter((item) => item.area === selectedArea),
    [selectedArea]
  );

  function runTest(item: LibraryAutomation) {
    toast.success(`${item.name} test completed`, {
      description: "Demo mode only: no real workflow was triggered.",
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Automation library for a home-improvement operator
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Sample workflows across sales, marketing, customer service, operations,
            administration, and IT. These could run inside this CRM or connect to HubSpot,
            JobNimbus, ServiceTitan, Zapier, Make, Power Automate, n8n, or custom APIs.
          </p>
        </div>
        <Badge variant="secondary">{filteredAutomations.length} workflows</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const count =
            filter === "All"
              ? AUTOMATION_LIBRARY.length
              : AUTOMATION_LIBRARY.filter((item) => item.area === filter).length;
          return (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={selectedArea === filter ? "default" : "outline"}
              onClick={() => setSelectedArea(filter)}
              className="gap-2"
            >
              {filter}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px]",
                  selectedArea === filter
                    ? "bg-white/20 text-white"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="space-y-4">
        {filteredAutomations.map((item) => {
          const active = enabledByName[item.name] ?? item.enabled;
          return (
            <Card key={item.name} className={!active ? "opacity-70" : undefined}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="h-4 w-4 text-brand-gold" />
                      {item.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={active}
                    onCheckedChange={(next) =>
                      setEnabledByName((current) => ({ ...current, [item.name]: next }))
                    }
                    aria-label={`Toggle ${item.name}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 text-sm lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Trigger
                    </p>
                    <p className="mt-1">{item.trigger}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Conditions
                    </p>
                    <p className="mt-1">{item.conditions}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Actions
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {item.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      Triggered {item.timesTriggered}×
                    </Badge>
                    <span>Last run {item.lastRun}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.area}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runTest(item)}
                    disabled={!active}
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Run test
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
