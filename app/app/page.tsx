import Link from "next/link";
import {
  CalendarCheck,
  DollarSign,
  Flame,
  Inbox,
  Lightbulb,
  TimerOff,
  Trophy,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeadPriorityQueue } from "@/components/app/LeadPriorityQueue";
import { MetricCard } from "@/components/app/MetricCard";
import { TaskList } from "@/components/app/TaskList";
import { getDashboardData } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils/format";
import { STAGE_STYLES, LEAD_STAGES } from "@/lib/utils/statuses";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalDashboardData } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

const AI_INSIGHTS = [
  "Storm damage leads convert faster when the first response happens immediately — keep urgent follow-up moving.",
  "Three recent feedback items mention appointment communication delays. Worth a process check before it shows up in reviews.",
  "Window leads from Facebook are high volume but book at a lower rate — qualify budget early in the first call.",
  "Bath and window projects carry the highest average estimated value in the current pipeline.",
];

export default async function OverviewPage() {
  const data = isLocalDemoMode()
    ? await getLocalDashboardData()
    : await getDashboardData(await createClient());

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="New Leads Today" value={data.newLeadsToday} icon={Inbox} />
        <MetricCard label="Hot Leads" value={data.hotLeads} icon={Flame} />
        <MetricCard
          label="Overdue Follow-Ups"
          value={data.overdueTasks}
          icon={TimerOff}
          tone={data.overdueTasks > 0 ? "urgent" : "default"}
        />
        <MetricCard
          label="Appointments Scheduled"
          value={data.appointmentsScheduled}
          icon={CalendarCheck}
        />
        <MetricCard
          label="Pipeline Value"
          value={formatMoney(data.pipelineValue)}
          icon={DollarSign}
          hint="Estimated, open stages"
        />
        <MetricCard
          label="Won This Month"
          value={formatMoney(data.wonRevenueThisMonth)}
          icon={Trophy}
          tone="success"
        />
      </div>

      {/* Priority queue + today's tasks */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI Priority Queue</CardTitle>
            <CardDescription>
              Open leads ranked by urgency and quality, with the recommended next action.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadPriorityQueue leads={data.priorityQueue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Tasks</CardTitle>
            <CardDescription>Due today or overdue.</CardDescription>
          </CardHeader>
          <CardContent>
            <TaskList
              tasks={data.todaysTasks}
              compact
              emptyMessage="Nothing due today."
            />
          </CardContent>
        </Card>
      </div>

      {/* Pipeline snapshot + insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline Snapshot</CardTitle>
            <CardDescription>Lead count by stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {LEAD_STAGES.map((stage) => (
                <Link
                  key={stage}
                  href={`/app/leads?stage=${stage}`}
                  className="rounded-lg border p-3 text-center transition-colors hover:bg-accent"
                >
                  <p className="text-2xl font-semibold">{data.pipelineCounts[stage] ?? 0}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {STAGE_STYLES[stage].label}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent AI Insights</CardTitle>
            <CardDescription>Patterns worth acting on.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {AI_INSIGHTS.map((insight) => (
                <li key={insight} className="flex gap-2.5 text-sm">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                  <span className="text-muted-foreground">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
