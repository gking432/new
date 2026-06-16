import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AutomationLibrary } from "@/components/app/AutomationLibrary";
import { AutomationRuleCard } from "@/components/app/AutomationRuleCard";
import { ReminderAutomationCard } from "@/components/app/ReminderAutomationCard";
import { getAutomationRules, getAutomationRuns } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const RUN_STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-800 border-green-200",
  skipped: "bg-gray-100 text-gray-600 border-gray-200",
  failed: "bg-red-100 text-red-800 border-red-200",
};

export default async function AutomationsPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [rules, runs, scheduledReminders, dueReminders] = await Promise.all([
    getAutomationRules(supabase),
    getAutomationRuns(supabase),
    supabase
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "approved")
      .not("scheduled_send_at", "is", null),
    supabase
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "approved")
      .not("scheduled_send_at", "is", null)
      .lte("scheduled_send_at", now),
  ]);
  const ruleNames = new Map(rules.map((rule) => [rule.id, rule.name]));

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Automation rules translate business logic into actions: urgent storm leads get a
        15-minute call task, quiet estimates get follow-ups, and bad reviews reach a manager.
        Appointment reminders auto-schedule 24-hour and 1-hour texts after a booking.
        Rules run automatically on lead creation, stage changes, feedback submission, and
        automated reminder checks.
        &quot;Run test&quot; replays a rule against the most recent matching record.
      </p>

      <ReminderAutomationCard
        scheduledCount={scheduledReminders.count ?? 0}
        dueCount={dueReminders.count ?? 0}
      />

      <AutomationLibrary />

      <div className="space-y-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No automation rules found. Run the seed migration to install the default rules.
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => <AutomationRuleCard key={rule.id} rule={rule} />)
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run log</CardTitle>
          <CardDescription>
            Every rule evaluation is recorded — including skips — so automation behavior is auditable.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No automation runs yet. Submit a lead through the public form or use a test button.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions taken</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {run.rule_id ? ruleNames.get(run.rule_id) ?? "Deleted rule" : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {run.trigger_event.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={RUN_STATUS_STYLES[run.status]}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      {run.actions_taken.length > 0 ? (
                        <span className="line-clamp-2 text-sm text-muted-foreground">
                          {run.actions_taken.join(" · ")}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {run.error_message ?? "Conditions not met"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(run.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
