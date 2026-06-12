/**
 * Database row types for the Supabase schema in /supabase/migrations.
 *
 * The app-level interfaces in `types/app.ts` mirror these rows one-to-one;
 * data-access functions in `lib/db` cast query results to those interfaces.
 * If you later run `supabase gen types typescript`, the generated output can
 * replace this file without changing the rest of the app.
 */
import type {
  Activity,
  AutomationRule,
  AutomationRun,
  CompanySettings,
  Feedback,
  Followup,
  Lead,
  LeadAnalysis,
  Profile,
  Task,
} from "./app";

type TableOf<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableOf<Profile>;
      leads: TableOf<Lead>;
      lead_ai_analyses: TableOf<LeadAnalysis>;
      tasks: TableOf<Task>;
      followups: TableOf<Followup>;
      activities: TableOf<Activity>;
      feedback: TableOf<Feedback>;
      automation_rules: TableOf<AutomationRule>;
      automation_runs: TableOf<AutomationRun>;
      company_settings: TableOf<CompanySettings>;
    };
  };
};
