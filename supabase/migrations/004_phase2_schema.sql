-- Phase 2: calls, communications, appointments, CRM sync, property research,
-- and quote intelligence. Extends the existing schema — no existing data is
-- touched.

-- ── Contacts ─────────────────────────────────────────────────────────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  zip_code text,
  external_crm_id text,
  external_crm_provider text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index contacts_phone_idx on contacts (phone);
create index contacts_email_idx on contacts (email);

-- ── Calls ────────────────────────────────────────────────────────────────────
create table calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  scenario text not null check (scenario in (
    'new_inbound_call',
    'existing_customer_call',
    'speed_to_lead_outbound',
    'manual_call_note'
  )),
  direction text not null check (direction in ('inbound', 'outbound')),
  caller_name text,
  caller_phone text,
  callee_name text,
  callee_phone text,
  status text not null default 'created' check (status in (
    'created',
    'ringing',
    'connected',
    'completed',
    'missed',
    'failed',
    'scripted_fallback'
  )),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  ai_model text,
  ai_status text default 'pending' check (ai_status in ('pending', 'completed', 'failed', 'fallback')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index calls_lead_id_idx on calls (lead_id);
create index calls_created_at_idx on calls (created_at desc);

create table call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  transcript_text text not null,
  transcript_json jsonb default '[]'::jsonb,
  storage_visibility text default 'hidden' check (storage_visibility in ('hidden', 'visible')),
  created_at timestamptz default now()
);

create index call_transcripts_call_id_idx on call_transcripts (call_id);

create table call_summaries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  summary text not null,
  crm_note text not null,
  customer_intent text,
  service_type text,
  urgency text,
  lead_quality text,
  next_action text,
  appointment_requested boolean default false,
  appointment_time timestamptz,
  objections jsonb default '[]'::jsonb,
  extracted_fields jsonb default '{}'::jsonb,
  recommended_tasks jsonb default '[]'::jsonb,
  raw_output jsonb,
  created_at timestamptz default now()
);

create index call_summaries_call_id_idx on call_summaries (call_id);
create index call_summaries_lead_id_idx on call_summaries (lead_id);

-- ── Communications (omnichannel inbox) ───────────────────────────────────────
create table communications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  call_id uuid references calls(id) on delete set null,
  channel text not null check (channel in ('form', 'call', 'sms', 'email', 'crm_import', 'manual')),
  direction text not null check (direction in ('inbound', 'outbound')),
  status text default 'draft' check (status in ('draft', 'approved', 'simulated_sent', 'sent', 'received', 'failed', 'discarded')),
  from_value text,
  to_value text,
  subject text,
  body text,
  ai_summary text,
  suggested_next_action text,
  ai_generated boolean default false,
  human_approved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index communications_lead_id_idx on communications (lead_id);
create index communications_created_at_idx on communications (created_at desc);
create index communications_status_idx on communications (status);

-- ── Appointments ─────────────────────────────────────────────────────────────
create table appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text not null,
  appointment_type text default 'inspection',
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'scheduled' check (status in ('suggested', 'scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed')),
  location text,
  assigned_to uuid references profiles(id),
  source text default 'internal' check (source in ('internal', 'google_calendar', 'ai_call', 'manual')),
  external_calendar_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index appointments_lead_id_idx on appointments (lead_id);
create index appointments_start_time_idx on appointments (start_time);

create table availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  day_of_week int check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  appointment_type text default 'inspection',
  slot_minutes int default 60,
  active boolean default true,
  created_at timestamptz default now()
);

-- ── CRM sync ─────────────────────────────────────────────────────────────────
create table crm_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('hubspot', 'generic_webhook', 'demo_mock')),
  name text not null,
  status text default 'disconnected' check (status in ('connected', 'disconnected', 'error', 'demo')),
  mode text default 'demo' check (mode in ('demo', 'live', 'dry_run')),
  access_token_encrypted text,
  portal_id text,
  base_url text,
  webhook_url text,
  sync_contacts boolean default true,
  sync_deals boolean default true,
  sync_notes boolean default true,
  sync_tasks boolean default false,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table crm_sync_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references crm_connections(id) on delete set null,
  provider text not null,
  entity_type text not null,
  entity_id uuid,
  external_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  action text not null,
  status text not null check (status in ('pending', 'success', 'failed', 'skipped', 'dry_run')),
  request_payload jsonb default '{}'::jsonb,
  response_payload jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamptz default now()
);

create index crm_sync_events_created_at_idx on crm_sync_events (created_at desc);

-- ── Property research + quotes ───────────────────────────────────────────────
create table property_research (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  address text not null,
  year_built int,
  finished_sqft int,
  stories numeric,
  lot_size_sqft int,
  roof_type text,
  roof_pitch text,
  siding_material text,
  estimated_roof_sqft int,
  estimated_siding_sqft int,
  estimated_window_count int,
  data_source text default 'demo',
  confidence text default 'medium' check (confidence in ('low', 'medium', 'high')),
  notes text,
  raw_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index property_research_lead_id_idx on property_research (lead_id);

create table quote_estimates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  created_by uuid references profiles(id),
  service_type text not null,
  estimate_low numeric,
  estimate_high numeric,
  confidence text default 'medium' check (confidence in ('low', 'medium', 'high')),
  assumptions jsonb default '[]'::jsonb,
  line_items jsonb default '[]'::jsonb,
  missing_info jsonb default '[]'::jsonb,
  inspection_questions jsonb default '[]'::jsonb,
  weather_adjustment jsonb default '{}'::jsonb,
  property_inputs jsonb default '{}'::jsonb,
  ai_summary text,
  internal_notes text,
  created_at timestamptz default now()
);

create index quote_estimates_lead_id_idx on quote_estimates (lead_id);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Same model as Phase 1: authenticated staff get full operational access;
-- privileged demo pipelines (public speed-to-lead call) run server-side with
-- the service role key and bypass RLS. Nothing here is anon-readable.

alter table contacts enable row level security;
alter table calls enable row level security;
alter table call_transcripts enable row level security;
alter table call_summaries enable row level security;
alter table communications enable row level security;
alter table appointments enable row level security;
alter table availability_windows enable row level security;
alter table crm_connections enable row level security;
alter table crm_sync_events enable row level security;
alter table property_research enable row level security;
alter table quote_estimates enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'contacts', 'calls', 'call_transcripts', 'call_summaries', 'communications',
    'appointments', 'availability_windows', 'crm_connections', 'crm_sync_events',
    'property_research', 'quote_estimates'
  ]
  loop
    execute format('create policy "Authenticated users can view %1$s" on %1$s for select to authenticated using (true)', t);
    execute format('create policy "Authenticated users can insert %1$s" on %1$s for insert to authenticated with check (true)', t);
    execute format('create policy "Authenticated users can update %1$s" on %1$s for update to authenticated using (true)', t);
    execute format('create policy "Authenticated users can delete %1$s" on %1$s for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ── Defaults ─────────────────────────────────────────────────────────────────
-- Default inspection availability: Monday–Friday, 9:00 AM – 5:00 PM, 60-minute
-- inspections. Editable from the Appointments page.
insert into availability_windows (day_of_week, start_time, end_time, appointment_type, slot_minutes)
values
  (1, '09:00', '17:00', 'inspection', 60),
  (2, '09:00', '17:00', 'inspection', 60),
  (3, '09:00', '17:00', 'inspection', 60),
  (4, '09:00', '17:00', 'inspection', 60),
  (5, '09:00', '17:00', 'inspection', 60);

-- A demo CRM connection so the CRM Sync page works out of the box.
insert into crm_connections (provider, name, status, mode)
values ('hubspot', 'HubSpot (demo)', 'demo', 'dry_run');
