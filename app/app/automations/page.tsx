import { AiAutomationsCenter } from "@/components/automations/AiAutomationsCenter";
import { AI_WORKFLOW_MODULES } from "@/lib/ai-workflows/modules";
import { getAutomationRules, getAutomationRuns } from "@/lib/db/queries";
import { getCrmSyncEvents } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { isLocalDemoMode } from "@/lib/demo/mode";
import {
  getLocalAutomationRuns,
  getLocalCrmSyncEvents,
  getLocalLeads,
} from "@/lib/demo/localData";
import { readDemoState } from "@/lib/demo/serverStore";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  if (isLocalDemoMode()) {
    const [state, localLeads, localRuns, localSyncEvents] = await Promise.all([
      readDemoState(),
      getLocalLeads(),
      getLocalAutomationRuns(),
      getLocalCrmSyncEvents(),
    ]);
    return (
      <AiAutomationsCenter
        modules={AI_WORKFLOW_MODULES}
        leads={localLeads.slice(0, 20).map(({ id, first_name, last_name, service_type, stage, urgency, lead_quality }) => ({
          id, first_name, last_name, service_type, stage, urgency, lead_quality,
        }))}
        rules={[]}
        runs={localRuns}
        scheduledReminderCount={state.communications.filter((communication) => communication.status === "approved" && Boolean(communication.scheduled_send_at)).length}
        dueReminderCount={state.communications.filter((communication) => communication.status === "approved" && Boolean(communication.scheduled_send_at) && new Date(communication.scheduled_send_at!).getTime() <= Date.now()).length}
        pendingApprovalCount={state.communications.filter((communication) => communication.status === "draft").length}
        dryRunSyncCount={localSyncEvents.filter((event) => event.status === "dry_run").length}
        syncEvents={localSyncEvents}
      />
    );
  }
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [rules, runs, leads, scheduledReminders, dueReminders, pendingApprovals, dryRunSyncs, syncEvents] =
    await Promise.all([
      getAutomationRules(supabase),
      getAutomationRuns(supabase),
      supabase
        .from("leads")
        .select("id, first_name, last_name, service_type, stage, urgency, lead_quality")
        .order("created_at", { ascending: false })
        .limit(20),
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
      supabase
        .from("communications")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outbound")
        .eq("status", "draft"),
      supabase
        .from("crm_sync_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "dry_run"),
      getCrmSyncEvents(supabase),
    ]);

  return (
    <AiAutomationsCenter
      modules={AI_WORKFLOW_MODULES}
      leads={leads.data ?? []}
      rules={rules}
      runs={runs}
      scheduledReminderCount={scheduledReminders.count ?? 0}
      dueReminderCount={dueReminders.count ?? 0}
      pendingApprovalCount={pendingApprovals.count ?? 0}
      dryRunSyncCount={dryRunSyncs.count ?? 0}
      syncEvents={syncEvents}
    />
  );
}
