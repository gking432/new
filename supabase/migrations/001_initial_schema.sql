-- Home Service AI Command Center — initial schema
-- Northstar Exterior & Home (demo company)

create extension if not exists "pgcrypto";

-- Internal staff profiles, linked to Supabase Auth users.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'sales_manager', 'sales_rep', 'operations_manager')),
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Homeowner leads from the public intake form.
create table leads (
  id uuid primary key default gen_random_uuid(),

  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  preferred_contact_method text check (preferred_contact_method in ('phone', 'text', 'email')),
  best_time_to_contact text,

  street_address text,
  city text,
  state text,
  zip_code text,
  homeowner_status text,

  service_type text not null check (service_type in (
    'roofing',
    'siding',
    'windows',
    'doors',
    'bath',
    'gutters',
    'leaf_protection',
    'storm_damage',
    'not_sure'
  )),

  project_reason text,
  timeframe text,
  budget_range text,
  description text not null,
  insurance_started text,
  active_leak text,
  source text,

  stage text not null default 'new' check (stage in (
    'new',
    'contacted',
    'appointment_scheduled',
    'estimate_sent',
    'follow_up_needed',
    'won',
    'lost'
  )),

  urgency text default 'medium' check (urgency in ('emergency', 'high', 'medium', 'low')),
  lead_quality text default 'warm' check (lead_quality in ('hot', 'warm', 'cold')),

  estimated_value_min numeric,
  estimated_value_max numeric,

  assigned_to uuid references profiles(id),
  ai_status text default 'pending' check (ai_status in ('pending', 'completed', 'failed')),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index leads_stage_idx on leads (stage);
create index leads_created_at_idx on leads (created_at desc);
create index leads_assigned_to_idx on leads (assigned_to);

-- Structured AI analysis per lead (latest row wins).
create table lead_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,

  summary text not null,
  urgency text not null,
  urgency_reasoning text,
  lead_quality text not null,
  lead_quality_reasoning text,

  recommended_next_action text,
  recommended_contact_window text,
  recommended_service_angle text,

  sales_questions jsonb default '[]'::jsonb,
  potential_objections jsonb default '[]'::jsonb,
  tags jsonb default '[]'::jsonb,
  raw_output jsonb,

  created_at timestamptz default now()
);

create index lead_ai_analyses_lead_id_idx on lead_ai_analyses (lead_id, created_at desc);

-- Work queue, created manually, by AI recommendations, and by automations.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  assigned_to uuid references profiles(id),

  title text not null,
  description text,
  type text check (type in (
    'call',
    'sms',
    'email',
    'inspection',
    'estimate_followup',
    'review_response',
    'manager_review',
    'admin'
  )),
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'complete', 'cancelled')),

  due_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index tasks_status_due_idx on tasks (status, due_at);
create index tasks_lead_id_idx on tasks (lead_id);

-- Generated customer communication drafts.
create table followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  created_by uuid references profiles(id),

  type text not null,
  tone text,
  goal text,
  subject text,
  body text not null,
  call_opening text,
  discovery_questions jsonb default '[]'::jsonb,
  talking_points jsonb default '[]'::jsonb,
  closing_line text,
  internal_note text,

  raw_output jsonb,

  created_at timestamptz default now()
);

create index followups_lead_id_idx on followups (lead_id, created_at desc);

-- Chronological activity timeline per lead.
create table activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  user_id uuid references profiles(id),

  type text not null,
  title text not null,
  description text,
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create index activities_lead_id_idx on activities (lead_id, created_at desc);

-- Customer feedback with AI analysis fields.
create table feedback (
  id uuid primary key default gen_random_uuid(),

  customer_name text,
  source text,
  rating int,
  feedback_text text not null,

  sentiment text,
  risk_level text,
  summary text,
  key_praise jsonb default '[]'::jsonb,
  key_complaints jsonb default '[]'::jsonb,
  operational_category text,
  suggested_internal_action text,
  suggested_customer_response text,
  marketing_quote_opportunity text,
  tags jsonb default '[]'::jsonb,
  raw_output jsonb,

  created_at timestamptz default now()
);

create index feedback_created_at_idx on feedback (created_at desc);

-- Business rules evaluated by the automation runner.
create table automation_rules (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  description text,
  trigger_event text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  is_active boolean default true,
  times_triggered int default 0,
  last_triggered_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Audit log of every automation evaluation.
create table automation_runs (
  id uuid primary key default gen_random_uuid(),

  rule_id uuid references automation_rules(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  feedback_id uuid references feedback(id) on delete set null,

  trigger_event text not null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  actions_taken jsonb default '[]'::jsonb,
  error_message text,

  created_at timestamptz default now()
);

create index automation_runs_created_at_idx on automation_runs (created_at desc);

-- Single-row company configuration.
create table company_settings (
  id uuid primary key default gen_random_uuid(),

  company_name text not null default 'Northstar Exterior & Home',
  phone text,
  email text,
  service_area text,
  timezone text default 'America/Chicago',
  business_hours jsonb default '{}'::jsonb,

  ai_enabled boolean default true,
  automations_enabled boolean default true,
  default_ai_model text,
  default_tone text default 'professional',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
