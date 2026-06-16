-- Communication lifecycle metadata for scheduled AI reminders.
-- Outbound reminders can be approved automatically, shown in the Inbox as
-- scheduled, and later marked simulated_sent by the automation runner.

alter table communications
  add column if not exists scheduled_send_at timestamptz,
  add column if not exists automation_key text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create unique index if not exists communications_automation_key_idx
  on communications (automation_key)
  where automation_key is not null;

create index if not exists communications_scheduled_send_at_idx
  on communications (scheduled_send_at)
  where scheduled_send_at is not null;
