# Home Service AI Command Center

A working AI-powered sales, operations, and customer service command center for a
residential home improvement company — built as a portfolio-grade prototype for the
fictional contractor **Northstar Exterior & Home**.

Homeowners submit service requests through a public landing page. The system
classifies each lead with AI (urgency, quality, estimated value, recommended next
action), creates tasks automatically, runs business-rule automations, generates
follow-up communication drafts, tracks the sales pipeline, analyzes customer
feedback, and surfaces KPI dashboards.

> **Demo mode:** this is a demonstration app. No real SMS, email, or service
> requests are sent. AI drafts are always labeled and editable before use.

## Why it exists

Home service companies lose revenue through slow lead response, inconsistent
follow-up, messy CRM data, and limited visibility into where deals stall. This
project demonstrates how AI fits into a real business workflow — not as a chatbot,
but as an operations layer that improves speed-to-lead, follow-up discipline, and
customer communication.

## Features

- **Public lead intake** — polished landing page and validated multi-section request form
- **AI lead analysis** — urgency, quality, value range, sales questions, objections, and next actions (Zod-validated structured output; deterministic fallback when AI is unavailable)
- **AI Priority Queue** — open leads ranked by urgency and quality on the dashboard
- **Pipeline board** — Kanban view across seven stages with logged stage changes
- **Task queue** — priorities, due dates, snoozing, per-rep views; tasks created manually, by AI recommendations, and by automations
- **Follow-up generator** — SMS, email, call scripts, voicemails, estimate follow-ups, and review responses in selectable tones
- **Feedback analyzer** — sentiment, risk level, operational category, suggested internal action and customer response; high-risk feedback creates manager tasks
- **Automation rules** — database-driven rules with plain-English descriptions, an auditable run log, and per-rule test runs
- **KPI reports** — booking rate, close rate, pipeline value, source performance, urgency mix, and computed business insights
- **Webhook integration** — structured lead events for Make/Zapier-style tools (simulated in demo mode)

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Recharts · React Hook Form + Zod · Supabase (Postgres, Auth, RLS) · OpenAI API
(provider-abstracted, server-side only) · Vercel

## Screenshots

| Page | Screenshot |
| --- | --- |
| Landing page | _placeholder_ |
| Overview dashboard | _placeholder_ |
| Lead detail with AI analysis | _placeholder_ |
| Pipeline board | _placeholder_ |
| Reports | _placeholder_ |

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the project URL, anon key, and service role key into `.env.local`.
3. Run the migrations in order in the Supabase SQL editor (or with `supabase db push`):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_data.sql` (company settings + default automation rules)

### 3. Seed demo data

Profiles must reference real Supabase Auth users, so demo users, leads, tasks,
feedback, and activity history are seeded by script:

```bash
npm run seed
```

This creates four demo users (password `demo-password`):

| Email | Role |
| --- | --- |
| `admin@northstar-demo.com` | Admin / Owner |
| `manager@northstar-demo.com` | Sales Manager |
| `sales@northstar-demo.com` | Sales Rep |
| `ops@northstar-demo.com` | Operations Manager |

…plus 25 leads (8 urgent/high), AI analyses, 15 tasks, 8 feedback records, and a
full activity history. The script is safe to re-run; it clears and re-seeds
operational tables.

### 4. AI (optional)

Set `OPENAI_API_KEY` in `.env.local` to enable live AI analysis and generation.
Without a key, the app uses deterministic rule-based fallbacks so every workflow
still functions end to end — fallback records are labeled in the UI.

### 5. Run

```bash
npm run dev
```

- Public site: `http://localhost:3000`
- Command center: `http://localhost:3000/app` (log in at `/login`)
- Case study: `http://localhost:3000/case-study`

## Environment variables

See `.env.example`. Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side code (public lead intake
  pipeline and the seed script). It is never exposed to the browser.
- `DEMO_MODE=true` keeps webhook sends simulated and demo banners visible.
- `MAKE_WEBHOOK_URL` / `ZAPIER_WEBHOOK_URL` + `DEMO_MODE=false` enable real webhook delivery.

## Deployment

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Add the environment variables from `.env.local` to the Vercel project.
3. Deploy. Supabase hosts the database/auth; no other services are required.

## Demo workflow (the hail-damage story)

1. Open `/request` and submit: **Storm Damage**, “We had hail last week and now I’m
   seeing missing shingles and water spots on the ceiling upstairs,” timeframe
   **Emergency**, active leak **Yes**, source **Google**.
2. The lead is created, AI classifies it (emergency / hot / call within 15 minutes),
   and the **Urgent Storm Damage Lead** automation creates an urgent call task.
3. Log in — the lead is at the top of the **AI Priority Queue**.
4. Open the lead: review the AI summary, urgency reasoning, and discovery questions.
5. Click **Generate SMS** — an editable, AI-labeled draft appears and is saved to
   the lead’s history.
6. The activity timeline shows every step, and **Reports** reflect the new lead.

## Future improvements

- Role-based permissions (role labels and schema are already in place)
- Drag-and-drop pipeline cards
- Photo upload with AI roof-damage triage
- Real SMS/email via Twilio/Resend behind approval gates
- Measured speed-to-lead from contact timestamps
- Duplicate lead detection and source ROI calculation
