-- Row Level Security policies
--
-- Model for this MVP:
--   * Anonymous visitors may INSERT leads (public intake form) and nothing else.
--   * Authenticated internal users may read and write operational records.
--   * Privileged pipeline work (AI writes triggered by public intake) uses the
--     service role key from server-only code and bypasses RLS.

alter table profiles enable row level security;
alter table leads enable row level security;
alter table lead_ai_analyses enable row level security;
alter table tasks enable row level security;
alter table followups enable row level security;
alter table activities enable row level security;
alter table feedback enable row level security;
alter table automation_rules enable row level security;
alter table automation_runs enable row level security;
alter table company_settings enable row level security;

-- profiles: internal users can see the team; users manage their own row.
create policy "Authenticated users can view profiles"
  on profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- leads: anonymous insert only (public form); full read/write for staff.
create policy "Anyone can submit a lead"
  on leads for insert to anon with check (true);

create policy "Authenticated users can view leads"
  on leads for select to authenticated using (true);

create policy "Authenticated users can insert leads"
  on leads for insert to authenticated with check (true);

create policy "Authenticated users can update leads"
  on leads for update to authenticated using (true);

-- lead_ai_analyses
create policy "Authenticated users can view analyses"
  on lead_ai_analyses for select to authenticated using (true);

create policy "Authenticated users can insert analyses"
  on lead_ai_analyses for insert to authenticated with check (true);

-- tasks
create policy "Authenticated users can view tasks"
  on tasks for select to authenticated using (true);

create policy "Authenticated users can insert tasks"
  on tasks for insert to authenticated with check (true);

create policy "Authenticated users can update tasks"
  on tasks for update to authenticated using (true);

-- followups
create policy "Authenticated users can view followups"
  on followups for select to authenticated using (true);

create policy "Authenticated users can insert followups"
  on followups for insert to authenticated with check (true);

-- activities
create policy "Authenticated users can view activities"
  on activities for select to authenticated using (true);

create policy "Authenticated users can insert activities"
  on activities for insert to authenticated with check (true);

-- feedback
create policy "Authenticated users can view feedback"
  on feedback for select to authenticated using (true);

create policy "Authenticated users can insert feedback"
  on feedback for insert to authenticated with check (true);

create policy "Authenticated users can update feedback"
  on feedback for update to authenticated using (true);

-- automation_rules
create policy "Authenticated users can view automation rules"
  on automation_rules for select to authenticated using (true);

create policy "Authenticated users can update automation rules"
  on automation_rules for update to authenticated using (true);

create policy "Authenticated users can insert automation rules"
  on automation_rules for insert to authenticated with check (true);

-- automation_runs
create policy "Authenticated users can view automation runs"
  on automation_runs for select to authenticated using (true);

create policy "Authenticated users can insert automation runs"
  on automation_runs for insert to authenticated with check (true);

-- company_settings
create policy "Authenticated users can view settings"
  on company_settings for select to authenticated using (true);

create policy "Authenticated users can update settings"
  on company_settings for update to authenticated using (true);
