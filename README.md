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
  voice calls** (OpenAI Realtime over WebRTC).
- Structured workflows use strict JSON Schema generated from the application's
  Zod contracts. Deterministic business rules and clearly labeled fallbacks
  keep the operational workflow running when a provider is unavailable.
- Without a key, everything still works: lead analysis falls back to rules,
  and calls run in **scripted demo mode** (click-through customer lines) that
  produces the same transcripts, notes, tasks, and appointments.

**Cost control:** Realtime sessions are capped at `REALTIME_MAX_CALL_SECONDS`
(default 180s), session creation is rate-limited, ephemeral tokens are minted
server-side, and silent scripted mode makes it possible to run the full workflow
without a live voice session.

### 5. HubSpot (optional)

Without configuration, every sync is a **dry run**: payloads are logged to the
sync event table with mock IDs and nothing external is touched. To sync for
real, create a HubSpot private app (scopes: `crm.objects.contacts`,
`crm.objects.deals`, `crm.objects.notes` read/write) and set:

```env
HUBSPOT_PRIVATE_APP_TOKEN=pat-...
ENABLE_HUBSPOT_LIVE_SYNC=true
```

### 6. Run

```bash
npm run dev
```

- Public site: `http://localhost:3000`
- Command center: `http://localhost:3000/app` (the portfolio build is intentionally no-login)
- Demo Center: `http://localhost:3000/app/demo-center`
- Case study: `http://localhost:3000/case-study`

## Demo walkthroughs

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
