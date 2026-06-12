import {
  CalendarCheck,
  DollarSign,
  Flame,
  Inbox,
  Lightbulb,
  Percent,
  TimerOff,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/app/MetricCard";
import { ReportsCharts, type NamedCount } from "@/components/app/ReportsCharts";
import { getReportData } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { estimatedValueMidpoint, formatMoney, formatPercent } from "@/lib/utils/format";
import { SERVICE_LABELS, SOURCE_LABELS, STAGE_STYLES } from "@/lib/utils/statuses";
import type { LeadStage } from "@/types/app";

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

export default async function ReportsPage() {
  const supabase = await createClient();
  const { leads, tasks } = await getReportData(supabase);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);

  // KPI cards
  const totalLeads = leads.length;
  const newThisWeek = leads.filter((l) => new Date(l.created_at) >= weekAgo).length;
  const hotLeads = leads.filter((l) => l.lead_quality === "hot").length;
  const reachedAppointment = leads.filter((l) =>
    ["appointment_scheduled", "estimate_sent", "follow_up_needed", "won"].includes(l.stage)
  ).length;
  const bookingRate = totalLeads > 0 ? reachedAppointment / totalLeads : 0;
  const estimateOrBeyond = leads.filter((l) =>
    ["estimate_sent", "follow_up_needed", "won", "lost"].includes(l.stage)
  ).length;
  const won = leads.filter((l) => l.stage === "won");
  const closeRate = estimateOrBeyond > 0 ? won.length / estimateOrBeyond : 0;
  const valued = leads.filter((l) => l.estimated_value_min != null || l.estimated_value_max != null);
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
  const overdueTasks = tasks.filter(
    (t) =>
      (t.status === "open" || t.status === "in_progress") && t.due_at && new Date(t.due_at) < now
  );

  // Charts
  const leadsByService = toNamed(countBy(leads, (l) => l.service_type), SERVICE_LABELS);
  const stageLabels = Object.fromEntries(
    Object.entries(STAGE_STYLES).map(([stage, style]) => [stage, style.label])
  );
  const pipelineByStage = (
    ["new", "contacted", "appointment_scheduled", "estimate_sent", "follow_up_needed", "won", "lost"] as LeadStage[]
  ).map((stage) => ({
    name: stageLabels[stage],
    value: leads.filter((l) => l.stage === stage).length,
  }));
  const leadsBySource = toNamed(countBy(leads, (l) => l.source), SOURCE_LABELS);

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

  const bookingRateBySource: NamedCount[] = [...countBy(leads, (l) => l.source).entries()]
    .map(([source, total]) => {
      const booked = leads.filter(
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
    const count = leads.filter((l) => {
      const created = new Date(l.created_at);
      return created.toDateString() === day.toDateString();
    }).length;
    leadVolumeOverTime.push({ name: label, value: count });
  }

  const urgencyMix = toNamed(countBy(leads, (l) => l.urgency), {
    emergency: "Emergency",
    high: "High",
    medium: "Medium",
    low: "Low",
  });

  // Computed business insights
  const stormLeads = leads.filter((l) => l.service_type === "storm_damage");
  const stormUrgentShare =
    stormLeads.length > 0
      ? stormLeads.filter((l) => l.urgency === "emergency" || l.urgency === "high").length /
        stormLeads.length
      : 0;
  const otherLeads = leads.filter((l) => l.service_type !== "storm_damage");
  const otherUrgentShare =
    otherLeads.length > 0
      ? otherLeads.filter((l) => l.urgency === "emergency" || l.urgency === "high").length /
        otherLeads.length
      : 0;
  const urgencyMultiple =
    otherUrgentShare > 0 ? (stormUrgentShare / otherUrgentShare).toFixed(1) : null;

  const stalledValue = leads
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
          <CardTitle>Business Insights</CardTitle>
          <CardDescription>Computed from current pipeline and feedback data.</CardDescription>
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
