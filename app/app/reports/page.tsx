import {
  AlertTriangle,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Database,
  DollarSign,
  Flame,
  Inbox,
  Lightbulb,
  MessageSquareText,
  Percent,
  PhoneCall,
  ShieldCheck,
  TimerOff,
  TrendingUp,
  Trophy,
  Workflow,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/app/MetricCard";
import { ReportsCharts, type NamedCount } from "@/components/app/ReportsCharts";
import { getReportData } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { estimatedValueMidpoint, formatMoney, formatPercent } from "@/lib/utils/format";
import { SERVICE_LABELS, SOURCE_LABELS, STAGE_STYLES } from "@/lib/utils/statuses";
import type { Lead, LeadStage, TaskWithLead } from "@/types/app";

export const dynamic = "force-dynamic";

function countBy<T>(items: T[], key: (item: T) => string | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function toNamed(map: Map<string, number>, labels?: Record<string, string>): NamedCount[] {
  return [...map.entries()]
    .map(([name, value]) => ({ name: labels?.[name] ?? name, value }))
    .sort((a, b) => b.value - a.value);
}

function daysFrom(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function sampleLead(now: Date, index: number, lead: Partial<Lead>): Lead {
  return {
    id: `sample-lead-${index}`,
    first_name: "Sample",
    last_name: `Customer ${index}`,
    email: null,
    phone: null,
    preferred_contact_method: "phone",
    best_time_to_contact: null,
    street_address: null,
    city: "Sussex",
    state: "WI",
    zip_code: "53089",
    homeowner_status: "owner",
    service_type: "roofing",
    project_reason: null,
    timeframe: "this_month",
    budget_range: "15k_30k",
    description: "Sample operating record for the reports dashboard.",
    insurance_started: null,
    active_leak: "no",
    source: "google",
    stage: "new",
    urgency: "medium",
    lead_quality: "warm",
    estimated_value_min: 9000,
    estimated_value_max: 18000,
    assigned_to: null,
    ai_status: "completed",
    created_at: daysFrom(now, -index),
    updated_at: daysFrom(now, -index + 1),
    ...lead,
  };
}

function buildSampleLeads(now: Date): Lead[] {
  return [
    sampleLead(now, 1, {
      first_name: "Avery",
      last_name: "Peters",
      service_type: "storm_damage",
      source: "google",
      stage: "appointment_scheduled",
      urgency: "emergency",
      lead_quality: "hot",
      estimated_value_min: 14000,
      estimated_value_max: 32000,
      created_at: daysFrom(now, -1),
    }),
    sampleLead(now, 2, {
      first_name: "Marcus",
      last_name: "Hill",
      service_type: "windows",
      source: "referral",
      stage: "estimate_sent",
      urgency: "medium",
      lead_quality: "hot",
      estimated_value_min: 18000,
      estimated_value_max: 36000,
      created_at: daysFrom(now, -2),
    }),
    sampleLead(now, 3, {
      first_name: "Jenna",
      last_name: "Cook",
      service_type: "bath",
      source: "facebook",
      stage: "follow_up_needed",
      urgency: "low",
      lead_quality: "warm",
      estimated_value_min: 12000,
      estimated_value_max: 26000,
      created_at: daysFrom(now, -4),
    }),
    sampleLead(now, 4, {
      first_name: "Priya",
      last_name: "Shah",
      service_type: "siding",
      source: "yard_sign",
      stage: "won",
      urgency: "medium",
      lead_quality: "hot",
      estimated_value_min: 22000,
      estimated_value_max: 41000,
      created_at: daysFrom(now, -12),
      updated_at: daysFrom(now, -5),
    }),
    sampleLead(now, 5, {
      first_name: "Tom",
      last_name: "Wilson",
      service_type: "roofing",
      source: "google",
      stage: "won",
      urgency: "high",
      lead_quality: "hot",
      estimated_value_min: 15000,
      estimated_value_max: 28000,
      created_at: daysFrom(now, -16),
      updated_at: daysFrom(now, -6),
    }),
    sampleLead(now, 6, {
      first_name: "Elaine",
      last_name: "Foster",
      service_type: "gutters",
      source: "previous_customer",
      stage: "contacted",
      urgency: "medium",
      lead_quality: "warm",
      estimated_value_min: 2500,
      estimated_value_max: 6500,
      created_at: daysFrom(now, -7),
    }),
    sampleLead(now, 7, {
      first_name: "David",
      last_name: "Miller",
      service_type: "leaf_protection",
      source: "referral",
      stage: "appointment_scheduled",
      urgency: "low",
      lead_quality: "warm",
      estimated_value_min: 3000,
      estimated_value_max: 7800,
      created_at: daysFrom(now, -8),
    }),
    sampleLead(now, 8, {
      first_name: "Olivia",
      last_name: "Grant",
      service_type: "doors",
      source: "facebook",
      stage: "new",
      urgency: "low",
      lead_quality: "cold",
      estimated_value_min: 3200,
      estimated_value_max: 9200,
      created_at: daysFrom(now, -10),
    }),
    sampleLead(now, 9, {
      first_name: "Sam",
      last_name: "Brooks",
      service_type: "storm_damage",
      source: "google",
      stage: "appointment_scheduled",
      urgency: "high",
      lead_quality: "hot",
      estimated_value_min: 11000,
      estimated_value_max: 24000,
      created_at: daysFrom(now, -13),
    }),
    sampleLead(now, 10, {
      first_name: "Maya",
      last_name: "Reed",
      service_type: "windows",
      source: "event",
      stage: "lost",
      urgency: "medium",
      lead_quality: "cold",
      estimated_value_min: 9000,
      estimated_value_max: 17000,
      created_at: daysFrom(now, -18),
      updated_at: daysFrom(now, -12),
    }),
  ];
}

function buildSampleTasks(now: Date): TaskWithLead[] {
  return [
    {
      id: "sample-task-1",
      lead_id: "sample-lead-3",
      assigned_to: null,
      title: "Send bath remodel estimate follow-up",
      description: "Sample follow-up task for report fallback data.",
      type: "estimate_followup",
      priority: "high",
      status: "open",
      due_at: daysFrom(now, -2),
      completed_at: null,
      created_at: daysFrom(now, -5),
      updated_at: daysFrom(now, -5),
      assigned_profile: { id: "sample-profile-1", full_name: "Dana Whitfield", role: "admin" },
    } as TaskWithLead,
    {
      id: "sample-task-2",
      lead_id: "sample-lead-6",
      assigned_to: null,
      title: "Call gutter lead",
      description: "Sample callback task for report fallback data.",
      type: "call",
      priority: "medium",
      status: "open",
      due_at: daysFrom(now, 1),
      completed_at: null,
      created_at: daysFrom(now, -1),
      updated_at: daysFrom(now, -1),
      assigned_profile: { id: "sample-profile-2", full_name: "Mia Larson", role: "sales_rep" },
    } as TaskWithLead,
  ];
}

const AI_IMPACT = [
  {
    label: "Phone calls with clean CRM notes",
    value: 92,
    detail: "AI listens, separates transcript from CRM note, and writes the timeline summary.",
    icon: PhoneCall,
  },
  {
    label: "Appointment confirmations automated",
    value: 88,
    detail: "Safe confirmation and reminder texts can send automatically or wait for approval.",
    icon: MessageSquareText,
  },
  {
    label: "Lead records enriched before rep review",
    value: 84,
    detail: "Service type, urgency, source, tasks, and next action are filled before handoff.",
    icon: Bot,
  },
  {
    label: "CRM sync payloads ready",
    value: 96,
    detail: "Contact, deal, note, task, appointment, and message objects can map into another CRM.",
    icon: Database,
  },
];

const BUSINESS_UNITS = [
  {
    unit: "Sales",
    metric: "64 sec",
    label: "Sample median speed-to-lead",
    action: "Protect the first minute with instant AI callback and SMS fallback.",
    status: "Healthy",
  },
  {
    unit: "Marketing",
    metric: "3.1x",
    label: "Sample referral booking lift",
    action: "Shift spend toward sources with booked appointment and sold-job proof.",
    status: "Opportunity",
  },
  {
    unit: "Operations",
    metric: "11",
    label: "Sample jobs needing weather review",
    action: "Use weather-aware schedule checks before install day.",
    status: "Watch",
  },
  {
    unit: "Customer Service",
    metric: "97%",
    label: "Sample reply SLA coverage",
    action: "Escalate urgent texts and negative feedback before they age overnight.",
    status: "Healthy",
  },
  {
    unit: "Administration",
    metric: "92%",
    label: "Sample CRM hygiene score",
    action: "Merge duplicate contacts and normalize phone, address, and source fields.",
    status: "Healthy",
  },
  {
    unit: "IT / Systems",
    metric: "99.4%",
    label: "Sample integration uptime",
    action: "Monitor CRM, phone, SMS, calendar, email, and webhook failures.",
    status: "Healthy",
  },
];

const SOURCE_ROI = [
  { source: "Google Local Services", leads: 42, booked: "57%", sold: "21%", value: "$182k" },
  { source: "Referral", leads: 18, booked: "72%", sold: "39%", value: "$146k" },
  { source: "Facebook", leads: 31, booked: "29%", sold: "10%", value: "$48k" },
  { source: "Yard signs", leads: 12, booked: "50%", sold: "25%", value: "$61k" },
];

const WORKFLOW_HEALTH = [
  { name: "Call transcription", status: "Online", detail: "Realtime notes and post-call summary" },
  { name: "SMS reminders", status: "Online", detail: "24-hour and 1-hour appointment reminders" },
  { name: "Email intake", status: "Ready", detail: "Classifies new email leads into CRM records" },
  { name: "CRM dry-run sync", status: "Online", detail: "Payload logs without touching external systems" },
];

export default async function ReportsPage() {
  const supabase = await createClient();
  const { leads, tasks } = await getReportData(supabase);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const sampleMode = leads.length === 0;
  const reportLeads = sampleMode ? buildSampleLeads(now) : leads;
  const reportTasks = tasks.length === 0 ? buildSampleTasks(now) : tasks;

  // KPI cards
  const totalLeads = reportLeads.length;
  const newThisWeek = reportLeads.filter((l) => new Date(l.created_at) >= weekAgo).length;
  const hotLeads = reportLeads.filter((l) => l.lead_quality === "hot").length;
  const reachedAppointment = reportLeads.filter((l) =>
    ["appointment_scheduled", "estimate_sent", "follow_up_needed", "won"].includes(l.stage)
  ).length;
  const bookingRate = totalLeads > 0 ? reachedAppointment / totalLeads : 0;
  const estimateOrBeyond = reportLeads.filter((l) =>
    ["estimate_sent", "follow_up_needed", "won", "lost"].includes(l.stage)
  ).length;
  const won = reportLeads.filter((l) => l.stage === "won");
  const closeRate = estimateOrBeyond > 0 ? won.length / estimateOrBeyond : 0;
  const valued = reportLeads.filter((l) => l.estimated_value_min != null || l.estimated_value_max != null);
  const averageValue =
    valued.length > 0
      ? valued.reduce(
          (sum, l) => sum + estimatedValueMidpoint(l.estimated_value_min, l.estimated_value_max),
          0
        ) / valued.length
      : 0;
  const wonRevenue = won.reduce(
    (sum, l) => sum + estimatedValueMidpoint(l.estimated_value_min, l.estimated_value_max),
    0
  );
  const overdueTasks = reportTasks.filter(
    (t) =>
      (t.status === "open" || t.status === "in_progress") &&
      t.due_at &&
      new Date(t.due_at) < startOfToday
  );

  // Charts
  const leadsByService = toNamed(countBy(reportLeads, (l) => l.service_type), SERVICE_LABELS);
  const stageLabels = Object.fromEntries(
    Object.entries(STAGE_STYLES).map(([stage, style]) => [stage, style.label])
  );
  const pipelineByStage = (
    ["new", "contacted", "appointment_scheduled", "estimate_sent", "follow_up_needed", "won", "lost"] as LeadStage[]
  ).map((stage) => ({
    name: stageLabels[stage],
    value: reportLeads.filter((l) => l.stage === stage).length,
  }));
  const leadsBySource = toNamed(countBy(reportLeads, (l) => l.source), SOURCE_LABELS);

  const revenueByServiceMap = new Map<string, number>();
  for (const lead of won) {
    const label = SERVICE_LABELS[lead.service_type];
    revenueByServiceMap.set(
      label,
      (revenueByServiceMap.get(label) ?? 0) +
        estimatedValueMidpoint(lead.estimated_value_min, lead.estimated_value_max)
    );
  }
  const revenueByService = [...revenueByServiceMap.entries()]
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const bookingRateBySource: NamedCount[] = [...countBy(reportLeads, (l) => l.source).entries()]
    .map(([source, total]) => {
      const booked = reportLeads.filter(
        (l) =>
          l.source === source &&
          ["appointment_scheduled", "estimate_sent", "follow_up_needed", "won"].includes(l.stage)
      ).length;
      return { name: SOURCE_LABELS[source] ?? source, value: Math.round((booked / total) * 100) };
    })
    .sort((a, b) => b.value - a.value);

  const overdueByRep = toNamed(
    countBy(overdueTasks, (t) => t.assigned_profile?.full_name ?? "Unassigned")
  );

  const leadVolumeOverTime: NamedCount[] = [];
  for (let daysBack = 29; daysBack >= 0; daysBack -= 1) {
    const day = new Date(now.getTime() - daysBack * 24 * 3600_000);
    const label = `${day.getMonth() + 1}/${day.getDate()}`;
    const count = reportLeads.filter((l) => {
      const created = new Date(l.created_at);
      return created.toDateString() === day.toDateString();
    }).length;
    leadVolumeOverTime.push({ name: label, value: count });
  }

  const urgencyMix = toNamed(countBy(reportLeads, (l) => l.urgency), {
    emergency: "Emergency",
    high: "High",
    medium: "Medium",
    low: "Low",
  });

  // Computed business insights
  const stormLeads = reportLeads.filter((l) => l.service_type === "storm_damage");
  const stormUrgentShare =
    stormLeads.length > 0
      ? stormLeads.filter((l) => l.urgency === "emergency" || l.urgency === "high").length /
        stormLeads.length
      : 0;
  const otherLeads = reportLeads.filter((l) => l.service_type !== "storm_damage");
  const otherUrgentShare =
    otherLeads.length > 0
      ? otherLeads.filter((l) => l.urgency === "emergency" || l.urgency === "high").length /
        otherLeads.length
      : 0;
  const urgencyMultiple =
    otherUrgentShare > 0 ? (stormUrgentShare / otherUrgentShare).toFixed(1) : null;

  const stalledValue = reportLeads
    .filter((l) => l.stage === "follow_up_needed")
    .reduce((sum, l) => sum + estimatedValueMidpoint(l.estimated_value_min, l.estimated_value_max), 0);

  const insights = [
    urgencyMultiple
      ? `Storm damage leads are ${urgencyMultiple}x more likely to be classified urgent than other service lines — speed-to-lead matters most there.`
      : "Storm damage leads consistently classify as urgent — speed-to-lead matters most there.",
    bookingRateBySource[0]
      ? `${bookingRateBySource[0].name} leads have the highest appointment booking rate (${bookingRateBySource[0].value}%).`
      : null,
    stalledValue > 0
      ? `The follow-up-needed stage is holding ${formatMoney(stalledValue)} in stalled pipeline value — the cheapest revenue to recover.`
      : null,
    revenueByService[0]
      ? `${revenueByService[0].name} is the highest-revenue service line among won projects.`
      : null,
  ].filter((insight): insight is string => insight !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Reports and AI Operations</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            A manager view for sales, marketing, operations, customer service, administration,
            and IT. It mixes live demo CRM records with clearly labeled sample benchmarks so the
            dashboard still explains the operating model after the demo resets.
          </p>
        </div>
        <Badge variant="secondary" className="mt-1">
          {sampleMode ? "Sample operating data" : "Current demo records"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total Leads" value={totalLeads} icon={Inbox} />
        <MetricCard label="New This Week" value={newThisWeek} icon={TrendingUp} />
        <MetricCard label="Hot Leads" value={hotLeads} icon={Flame} />
        <MetricCard label="Booking Rate" value={formatPercent(bookingRate)} icon={CalendarCheck} />
        <MetricCard label="Estimate Close Rate" value={formatPercent(closeRate)} icon={Percent} />
        <MetricCard label="Avg. Est. Job Value" value={formatMoney(averageValue)} icon={DollarSign} />
        <MetricCard label="Revenue Won" value={formatMoney(wonRevenue)} icon={Trophy} tone="success" />
        <MetricCard
          label="Overdue Follow-Ups"
          value={overdueTasks.length}
          icon={TimerOff}
          tone={overdueTasks.length > 0 ? "urgent" : "default"}
        />
        <MetricCard label="Avg. Speed-to-Lead" value="18 min" icon={Zap} hint="Demo estimate" />
        <MetricCard
          label="Top Source"
          value={leadsBySource[0]?.name ?? "—"}
          icon={Lightbulb}
          hint={leadsBySource[0] ? `${leadsBySource[0].value} leads` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" />
              AI automation impact
            </CardTitle>
            <CardDescription>
              Sample readiness scores for the AI layer this demo is proving out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {AI_IMPACT.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_170px]">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                  <div className="self-center">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Sample score</span>
                      <span className="font-medium">{item.value}%</span>
                    </div>
                    <Progress value={item.value} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-brand-gold" />
              Workflow health
            </CardTitle>
            <CardDescription>
              Fake status checks for the systems a Business Systems and AI Manager would own.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {WORKFLOW_HEALTH.map((item) => (
              <div key={item.name} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    item.status === "Online"
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                  }
                >
                  {item.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {BUSINESS_UNITS.map((unit) => (
          <Card key={unit.unit}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {unit.unit}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{unit.metric}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    unit.status === "Healthy"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : unit.status === "Opportunity"
                        ? "border-blue-200 bg-blue-50 text-blue-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                  }
                >
                  {unit.status}
                </Badge>
              </div>
              <p className="text-sm font-medium">{unit.label}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{unit.action}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReportsCharts
        data={{
          leadsByService,
          pipelineByStage,
          leadsBySource,
          revenueByService,
          bookingRateBySource,
          overdueByRep,
          leadVolumeOverTime,
          urgencyMix,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lead source ROI sample</CardTitle>
          <CardDescription>
            Fake sample numbers that show how this dashboard would compare marketing sources
            once connected to real CRM and revenue data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {SOURCE_ROI.map((row) => (
              <div key={row.source} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{row.source}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Leads</p>
                    <p className="mt-0.5 font-medium">{row.leads}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Booked</p>
                    <p className="mt-0.5 font-medium">{row.booked}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sold</p>
                    <p className="mt-0.5 font-medium">{row.sold}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Value</p>
                    <p className="mt-0.5 font-medium">{row.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex gap-3 p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" />
            <div>
              <p className="font-medium">What is real here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Charts use live demo leads and tasks after the tour creates them.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">What is sample data</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Benchmarks, ROI cards, and health checks are demo examples for a future production dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex gap-3 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Why it matters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                It shows how AI, CRM data, automations, and manager decisions can live in one view.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Insights</CardTitle>
          <CardDescription>
            Computed from {sampleMode ? "sample operating data" : "current pipeline data"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {insights.map((insight) => (
              <li key={insight} className="flex gap-2.5 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
