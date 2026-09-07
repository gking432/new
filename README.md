# Home Service AI Command Center

**An AI communications and operations layer for residential contractors.**

Built as a portfolio-grade prototype for the fictional contractor **Northstar
Exterior & Home**. The system can work as its own CRM, but it can also sit on
top of an existing CRM: it captures leads from forms, calls, texts, and emails;
uses AI to qualify customers; books appointments; summarizes calls; creates
CRM-ready notes; drafts follow-ups; generates quote intelligence; and syncs
clean updates into external systems (HubSpot dry-run or live).

> **Demo mode:** no real phone calls are placed, and no real SMS or email is
> sent. AI calls run in the browser (live voice or scripted), outbound drafts
> require human approval, and CRM sync defaults to dry-run.

## What it demonstrates

**Phase 1 — AI CRM core**

- Public lead intake (landing page + validated request form)
- AI lead analysis: urgency, quality, value range, sales questions, next actions
- AI Priority Queue, Kanban pipeline, task queue with snoozing
- Follow-up generator (SMS, email, call scripts, voicemails, review responses)
- Feedback analyzer with sentiment/risk and manager escalation
- Database-driven automation rules with an auditable run log
- KPI reports and webhook export

**Phase 2 — AI communications layer**

- **Realtime AI call sandbox** — browser-based "phone calls" with a polished
  mock phone UI. Live AI voice via OpenAI Realtime (WebRTC, ephemeral tokens)
  when a key is configured; a deterministic **scripted call mode** otherwise,
  so the demo never dies.
- **Three flagship call scenarios:**
  1. *Speed-to-lead:* submit the public form, and the AI scheduling assistant
     "calls" the homeowner seconds later, confirms details, and books the
     inspection.
  2. *New inbound call:* an unknown caller is intake-interviewed by the AI; a
     lead, tasks, CRM notes, and an appointment come out the other side.
  3. *Existing customer callback:* the AI matches the caller's number, pulls
     CRM context, references the prior request, and logs the second touchpoint.
- **Call intelligence** — short CRM-ready notes land on the lead timeline;
  full transcripts are stored separately behind "View Full Transcript."
- **Omnichannel inbox** — forms, calls, texts, and emails in one place, with
  simulated inbound text/email demos and a human **approval queue**: every
  AI-drafted outbound message must be approved, then "send" is simulated.
- **Appointment booking** — internal availability calendar (no Google auth
  needed); set weekly availability in plain English ("Mon/Wed/Fri 10–4, 90
  minutes per appointment") and the AI converts it into structured windows the
  call assistant books against.
- **HubSpot connector** — dry-run by default: the exact contact/deal/note
  payloads are built, logged with mock IDs, and shown in the UI. Add a private
  app token to sync for real.
- **Quote intelligence** — internal ballpark estimates from deterministic
  calculators (roofing squares, siding area, windows, gutters, bath), demo
  property research by address, and storm/weather context. Always labeled
  "requires inspection before final quote."
- **Demo Center** — run every scenario from one page with a live event log.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Recharts · React Hook Form + Zod · isolated browser demo store + optional Supabase Postgres · OpenAI API
(Structured Outputs + Realtime over WebRTC, provider-abstracted, server-side keys only) ·
HubSpot CRM API · Vercel

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase (optional shared-data mode)

The portfolio demo uses its isolated browser store by default. To exercise the
shared Postgres implementation, set `DEMO_STORAGE=supabase`, then:

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the project URL, anon key, and service role key into `.env.local`.
3. Run the migrations in order in the Supabase SQL editor (or `supabase db push`):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_data.sql`
   - `supabase/migrations/004_phase2_schema.sql` (calls, inbox, appointments, CRM sync, quotes)
   - `supabase/migrations/005_evening_weekend_availability.sql`
   - `supabase/migrations/006_communication_lifecycle.sql` (scheduled reminder lifecycle)

### 3. Set up demo users (Supabase mode only)

```bash
npm run seed
```

Creates four demo users (password `demo-password`):

| Email | Role |
| --- | --- |
| `admin@northstar-demo.com` | Admin / Owner |
| `manager@northstar-demo.com` | Sales Manager |
| `sales@northstar-demo.com` | Sales Rep |
| `ops@northstar-demo.com` | Operations Manager |

The dashboard intentionally starts as a **blank slate** — no leads, customers,
tasks, or messages. The only records that appear are the ones created live
during the demo (form submissions, calls, texts, emails). The guided walkthrough
carries an explicit storyline lead ID through callbacks, texts, approvals, and
sync. Standalone scenarios resolve a displayed customer or seed one when needed;
they never attach activity to a record merely because it was created most recently.

Re-running `npm run seed` clears all customer/operational data back to a blank
slate (config — users, settings, automations, availability — is preserved). For
the old sample dataset during development, run `SEED_SAMPLE=1 npm run seed`.

For the hosted portfolio demo, the app also resets itself automatically once
per new browser tab/session on first load when `DEMO_AUTO_RESET_ON_LOAD` is not
set to `false`. This clears leads, calls, messages, appointments, tasks,
activities, quotes, CRM sync events, feedback, and contacts so every visitor
starts from a blank slate. It intentionally preserves demo users, settings,
automation rules, and availability windows.

### 4. AI (optional, recommended)

- `OPENAI_API_KEY` — enables AI lead analysis, call summaries, and **live AI
  voice calls** (OpenAI Realtime over WebRTC; no Redis setup required).
- Structured workflows use strict JSON Schema generated from the application's
  Zod contracts. Deterministic business rules and clearly labeled fallbacks
  keep the operational workflow running when a provider is unavailable.
- Without a key, everything still works: lead analysis falls back to rules,
  and calls run in **scripted demo mode** (click-through customer lines) that
  produces the same transcripts, notes, tasks, and appointments.

**Voice safeguards:** live voice is enabled with `OPENAI_API_KEY` unless
`ENABLE_REALTIME_CALLS=false`. Without Redis, a per-process burst limit allows
10 token-mint attempts per minute by default, with no application daily quota.
Optional `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` enable atomic
shared quotas (defaults: 5 attempts/minute and 30/day). Configure
`REALTIME_MINTS_PER_MINUTE` and, for Redis only, `REALTIME_MINTS_PER_DAY` as needed.
Retries consume quota too. An explicitly configured quota store still fails
closed on exhaustion or outage. Missing Redis does not disable live voice.
The voice configuration check is
read-only and does not mint tokens or claim to verify provider connectivity.

The browser ends normal calls at `REALTIME_MAX_CALL_SECONDS` (30–180 seconds).
GA client tokens expire for new connections after 30 seconds. These are mint
quotas and a browser time limit, **not a hard dollar cap or server-enforced call
lifetime**: OpenAI documents that a client token can start multiple sessions
before expiry and an established session can continue afterward. Configure
provider spending controls for the dedicated project before enabling public
paid voice. See [OpenAI’s client-secret reference](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/client_secrets/methods/create)
and [Upstash’s REST API](https://upstash.com/docs/redis/features/restapi).

### 5. HubSpot (optional)

Without configuration, every sync is a **dry run**: payloads are logged to the
sync event table with mock IDs and nothing external is touched. To sync for
real, create a HubSpot private app (scopes: `crm.objects.contacts`,
`crm.objects.deals`, `crm.objects.notes` read/write) and set:

```env
HUBSPOT_PRIVATE_APP_TOKEN=pat-...
ENABLE_HUBSPOT_LIVE_SYNC=true
```

Deal export uses explicit mappings from the local lead stage:
`appointment_scheduled` → `appointmentscheduled`, `won` → `closedwon`, and
`lost` → `closedlost`. For `new`, `contacted`, `estimate_sent`, or
`follow_up_needed` (and unknown stages), only the contact and note are exported;
the deal is logged as `skipped`, with a reason and no external or mock deal ID.
Offering appointment times does not qualify a `new` lead as scheduled.

These mappings target HubSpot's standard default pipeline. Before enabling live
sync for a customized portal, verify its internal pipeline/stage IDs and adapt
`HUBSPOT_DEAL_STAGES` in `lib/integrations/hubspot/client.ts` to the actual business
milestones; do not use a later milestone as a fallback for an unmapped stage.
See [HubSpot's pipeline documentation](https://developers.hubspot.com/docs/api-reference/latest/crm/pipelines/guide).
Existing audit records are not rewritten; rerun a dry sync to see the corrected export.

Run the connector regression tests with `npm run test:hubspot` (Node 22.6+).
They cover stage mapping, skipped-deal audit entries, and live request shapes
with a mocked network; they do not contact HubSpot.

### 6. Run

```bash
npm run dev
```

- Public site: `http://localhost:3000`
- Command center: `http://localhost:3000/app` (the portfolio build is intentionally no-login)
- Demo Center: `http://localhost:3000/app/demo-center`
- Case study: `http://localhost:3000/case-study`

## Demo walkthroughs

The chooser offers **Executive Tour** (about 7 minutes). The **Full Guided Tour
is not released**: it is hidden from the chooser and old full-tour sessions
cannot resume it. Its implementation remains in the repository for future work.
Starting the executive tour creates a fresh demo workspace.

Tour checkpoints save stable step IDs, the current route, and explicit customer
IDs in session storage. Exit/Start Tour resumes the same page. A hard reload
reopens disposable call/form/composer panels at a repeatable entry point while
retaining saved CRM records. Saved quotes are visible after reload. On mobile,
briefings explain each workflow before the action; working steps keep the guide
collapsed, and the callback form and call hide it entirely. Desktop retains its
sidebar and detailed instructions. See [mobile behavior and regression checks](docs/mobile-tour.md).

Run `npm run test:tour` for checkpoint and voice-quota regression checks.
The [historical verification report](docs/full-tour-verification.md) documents
the earlier full-tour run; its full-tour launch tests require that feature to
be explicitly re-enabled and are not current public-release checks.

### Speed-to-lead (the primary wow demo)

1. Open **Demo Center → Run Speed-to-Lead Demo** (or submit `/request` as a
   customer — the AI assistant "calls" right on the success page).
2. A lead is created through the real pipeline (AI analysis + automations).
3. The mock phone rings; answer it. With an OpenAI key it's a live voice
   conversation; without one, click through the scripted customer lines.
4. End the call (or let it wrap at the cap). The pipeline produces: hidden
   transcript, CRM note on the timeline, urgent task, booked inspection, stage
   change to Appointment Scheduled, and a confirmation SMS draft waiting for
   approval in the Inbox.

### Existing customer callback

1. Demo Center → **Simulate Existing Customer Call**. The card shows the exact
   CRM target; if the storyline is empty, it seeds Jordan Avery first.
2. The matched CRM record shows before you answer; the AI opens with the
   prior request context, handles rescheduling/insurance questions, moves the
   appointment if needed, and logs the second touchpoint to the timeline.

### Everything else

- **Simulate Inbound Text / Email** — AI matches or creates the lead, drafts a
  reply for approval, creates tasks.
- **Run HubSpot Dry Sync** — see the exact payload and the logged sync event.
- **Quote Tool** — pick a lead, generate the demo property profile, set storm
  context, and get a ballpark with line items, assumptions, and confidence.
- **Appointments** — type availability in plain English and watch it become
  bookable slots; booked appointments schedule 24-hour and 1-hour reminder
  texts that auto-send in demo mode when due.

## Safety / demo guardrails

- "Demo call — no real phone call placed" labels on every call surface
- Generative customer drafts are labeled and require human approval before
  simulated sending; routine reminder templates may be pre-approved by policy
- Quote outputs are always "internal ballpark — not a final quote"
- The AI never promises insurance approval, coverage, or pricing, and is
  transparent that it's an AI assistant on outbound calls
- Service-role and OpenAI keys never reach the browser (Realtime uses
  short-lived ephemeral tokens minted server-side)

## Environment variables

See `.env.example` for the full list with comments: Supabase keys, OpenAI
(`AI_MODEL`, `REALTIME_MODEL`, `REALTIME_MAX_CALL_SECONDS`,
`ENABLE_REALTIME_CALLS`), HubSpot (`HUBSPOT_PRIVATE_APP_TOKEN`,
`ENABLE_HUBSPOT_LIVE_SYNC`), webhook placeholders, and demo flags including
`DEMO_AUTO_RESET_ON_LOAD`.

## Deployment

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Add the environment variables from `.env.local`.
3. Deploy. The portfolio demo uses isolated browser data by default; set
   `DEMO_STORAGE=supabase` when you want the shared Postgres implementation.

## What I'd build next in production

- Real telephony (Twilio Voice + Media Streams) behind the same call pipeline
- Real SMS/email delivery (Twilio/Resend) behind the existing approval gates
- Google Calendar free/busy + event sync (the provider seam is in place)
- A live property-data provider behind `lib/property/provider.ts`
- Realtime tool-calling for mid-call CRM lookups and live booking
- Role-based permissions, identity-resolution monitoring, and source ROI reporting
