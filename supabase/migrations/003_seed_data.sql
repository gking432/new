-- Baseline seed data that has no dependency on auth users:
-- company settings and the five default automation rules.
--
-- Leads, tasks, feedback, activities, and demo user profiles are seeded by
-- `npm run seed` (scripts/seed.mjs) because profiles must reference real
-- Supabase Auth users, which cannot be created from a SQL migration.

insert into company_settings (company_name, phone, email, service_area, timezone, business_hours, default_ai_model, default_tone)
values (
  'Northstar Exterior & Home',
  '(555) 014-2900',
  'office@northstar-demo.com',
  'Greater Twin Cities metro and surrounding counties',
  'America/Chicago',
  '{"monday_friday": "7:30 AM – 6:00 PM", "saturday": "9:00 AM – 1:00 PM", "sunday": "Closed (storm emergencies only)"}'::jsonb,
  'gpt-4.1-mini',
  'professional'
);

insert into automation_rules (name, description, trigger_event, conditions, actions) values
(
  'Urgent Storm Damage Lead',
  'When a storm damage lead arrives, or any lead reports an active leak or emergency timing, create an urgent call task and flag the lead hot so it tops the priority queue.',
  'lead_created',
  '{"any": [
    {"field": "service_type", "op": "eq", "value": "storm_damage"},
    {"field": "active_leak", "op": "eq", "value": "yes"},
    {"field": "timeframe", "op": "eq", "value": "emergency"}
  ]}'::jsonb,
  '[
    {"type": "create_task", "title": "Urgent: call storm/leak lead within 15 minutes", "description": "Speed-to-lead matters most on storm and leak calls. Confirm whether water is actively coming in and offer an inspection within 24–48 hours.", "task_type": "call", "priority": "urgent", "due_in_minutes": 15},
    {"type": "set_lead_quality", "value": "hot"},
    {"type": "log_note", "message": "Recommended contact window: within 15 minutes."}
  ]'::jsonb
),
(
  'Estimate Follow-Up',
  'When a lead moves to Estimate Sent, schedule a follow-up task three days out so estimates do not go quiet.',
  'stage_changed_to_estimate_sent',
  '{}'::jsonb,
  '[
    {"type": "create_task", "title": "Follow up on estimate", "description": "No response after 3 days. Check in, ask if they have questions on the estimate, and offer to walk through it.", "task_type": "estimate_followup", "priority": "high", "due_in_minutes": 4320}
  ]'::jsonb
),
(
  'Bad Review Alert',
  'When negative or low-rated feedback comes in, create a manager review task and flag the feedback high risk.',
  'feedback_submitted',
  '{"any": [
    {"field": "sentiment", "op": "eq", "value": "negative"},
    {"field": "rating", "op": "lte", "value": 2}
  ]}'::jsonb,
  '[
    {"type": "create_task", "title": "Manager review: negative customer feedback", "description": "Review the feedback, decide on outreach, and approve a response draft within one business day.", "task_type": "manager_review", "priority": "high", "due_in_minutes": 1440},
    {"type": "set_risk_level", "value": "high"}
  ]'::jsonb
),
(
  'High-Value Bath or Window Lead',
  'Bath and window projects with a $15,000+ budget go straight to the sales manager with a same-day call task.',
  'lead_created',
  '{"all": [
    {"field": "service_type", "op": "in", "value": ["bath", "windows"]},
    {"field": "budget_min", "op": "gte", "value": 15000}
  ]}'::jsonb,
  '[
    {"type": "assign_role", "role": "sales_manager"},
    {"type": "create_task", "title": "High-value lead: call today", "description": "Bath/window lead with a $15k+ budget. Call same day and aim to book an in-home consultation.", "task_type": "call", "priority": "high", "due_in_minutes": 240, "assign_role": "sales_manager"},
    {"type": "add_tag", "value": "high_value"}
  ]'::jsonb
),
(
  'Facebook Lead Quality Watch',
  'Tags every Facebook lead so source performance reporting can compare booking rates by channel.',
  'lead_created',
  '{"all": [
    {"field": "source", "op": "eq", "value": "facebook"}
  ]}'::jsonb,
  '[
    {"type": "add_tag", "value": "facebook_source"},
    {"type": "log_note", "message": "Included in source performance reporting. Facebook leads historically book at a lower rate — qualify early."}
  ]'::jsonb
);
