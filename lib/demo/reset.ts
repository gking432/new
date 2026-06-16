import { createAdminClient } from "@/lib/supabase/admin";

const OPERATIONAL_TABLES = [
  "crm_sync_events",
  "communications",
  "call_summaries",
  "call_transcripts",
  "calls",
  "appointments",
  "quote_estimates",
  "property_research",
  "contacts",
  "automation_runs",
  "activities",
  "followups",
  "tasks",
  "lead_ai_analyses",
  "feedback",
  "leads",
];

/**
 * Clears demo-created operational data while preserving the reusable app
 * configuration: auth users, profiles, company settings, automation rules,
 * and availability windows.
 */
export async function resetOperationalDemoData() {
  const supabase = createAdminClient();
  const results: { table: string; ok: boolean; error?: string }[] = [];

  for (const table of OPERATIONAL_TABLES) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    results.push({ table, ok: !error, error: error?.message });
  }

  return results;
}
