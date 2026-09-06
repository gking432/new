# PROJECT AI IMPLEMENTATION EXAMPLE PACK — HOME SERVICE AI COMMAND CENTER

> **Repository audited:** `/Users/gkn/new`  
> **Audit date:** September 2, 2026  
> **Verification standard:** Claims below are based on executable code, schemas, configuration, or clearly identified design documents in this repository. A passing lint/build proves that the code compiles; it does not prove deployment, external-service connectivity, customer use, security, scale, or business results.

Status terms used throughout:

- **ACTUALLY IMPLEMENTED** — executable code exists in the repository.
- **PARTIALLY IMPLEMENTED** — a real portion exists, but an important part is simulated, conditional, inactive by default, or incomplete.
- **DESIGNED / DOCUMENTED BUT NOT IMPLEMENTED** — described in repository documents or UI copy, without the corresponding runtime capability.
- **NOT PRESENT** — no qualifying implementation was found.

## SECTION 1 — PROJECT SNAPSHOT

The Home Service AI Command Center is an independent portfolio prototype for a fictional contractor, Northstar Exterior & Home. It combines a public lead form with an internal CRM-style interface for leads, pipeline stages, tasks, calls, inbox messages, appointments, feedback, quote preparation, automation demonstrations, reports, and CRM sync previews. Its primary user is a contractor owner, manager, salesperson, or operations employee. The flagship workflow is speed-to-lead: a homeowner submits a request; the browser presents a simulated phone experience; OpenAI Realtime can conduct the conversation when configured, or a deterministic script can stand in; the post-call pipeline stores a transcript and summary, updates the lead, resolves an appointment against internal availability, creates tasks, and puts a confirmation draft into a human approval queue.

The verified AI provider is OpenAI. Structured text workflows use `AI_MODEL`, defaulting to `gpt-4.1-mini`, through `chat.completions.parse`. Voice uses `REALTIME_MODEL`, defaulting to `gpt-realtime`, with `gpt-4o-mini-transcribe` for input transcription. The Realtime compatibility path can fall back to `gpt-4o-realtime-preview` and `whisper-1`. The inspected `.env.local` contains OpenAI and Supabase credential variables, but this audit did not send test traffic to either service; successful external connectivity is therefore **NOT VERIFIED FROM THIS REPOSITORY**.

The front end is Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, shadcn/Radix components, and Recharts. Server-side behavior is implemented with Next.js Server Actions and route handlers. The default storage path is not a database: unless `DEMO_STORAGE=supabase` is set, operational state is compressed into chunked, HTTP-only cookies with an eight-hour lifetime (`lib/demo/mode.ts`, `lib/demo/serverStore.ts`). An optional Supabase/Postgres implementation and migrations exist for leads, analyses, tasks, activities, communications, calls, transcripts, appointments, quotes, automation runs, and sync events. The app is deliberately no-login; `/login` redirects to the dashboard and server code commonly uses a service-role client in Supabase mode.

External-system code includes OpenAI APIs, an internal calendar implementation, an optional live HubSpot REST connector, outbound webhook code, and an importable n8n workflow definition. HubSpot is dry-run by default. SMS and email sends are simulated. The phone UI is a browser WebRTC/simulation experience, not telephony: no telephone network is connected. Property data and weather context are demo inputs generated or entered inside the app, not retrieved from a live property or weather provider.

What is verified as live in code is the locally runnable web application and its route/action logic. On September 2, 2026, `npm run lint` and `npm run build` both passed, and Next built the application and API route manifest. A public deployment URL, production deployment, real client usage, live HubSpot records, real messages, real calls, and production operating history are **NOT VERIFIED FROM THIS REPOSITORY**.

### Actual default architecture

```text
USER
  → NEXT.JS / REACT INTERFACE
  → SERVER ACTION OR API ROUTE
  → COOKIE-BACKED DEMO STATE (default)
       ↘ optional OPENAI structured or Realtime call
       ↘ deterministic rules, validation, scheduling, and calculators
  → UPDATED CRM-STYLE UI / HUMAN APPROVAL QUEUE
  → USER
```

### Optional Supabase/live-integration architecture

```text
USER
  → NEXT.JS / REACT INTERFACE
  → SERVER ACTION OR API ROUTE
  → OPENAI MODEL when configured
  → DETERMINISTIC APPLICATION VALIDATION / ORCHESTRATION
  → SUPABASE POSTGRES
  → optional HUBSPOT OR HTTPS WEBHOOK when explicitly enabled
  → APPLICATION UI
  → USER
```

The second flow is implemented as a conditional code path, but its external operation was not exercised during this audit.

## SECTION 2 — VERIFIED CONCEPT MAP

| CONCEPT | STATUS | REAL FEATURE / WORKFLOW | WHY THIS IS AN EXAMPLE | CODE EVIDENCE |
|---|---|---|---|---|
| Deterministic software | **ACTUALLY IMPLEMENTED** | Quote arithmetic, slot generation/resolution, lead heuristics, scripted calls, and automation rules | Identical inputs are handled by explicit formulas, regexes, conditions, and state transitions rather than model judgment | `lib/property/quoteCalculator.ts:41-255`; `lib/integrations/calendar/internalCalendar.ts:23-242`; `lib/ai/fallbacks.ts:17-150`; `lib/automations/runner.ts:31-251` |
| LLM/model calls | **ACTUALLY IMPLEMENTED** | Lead, follow-up, feedback, call-summary, availability, quote-narrative, and Realtime voice paths | The code invokes OpenAI structured chat completions and Realtime session APIs | `lib/ai/client.ts:31-80`; `app/api/realtime/session/route.ts:66-214`; callers in `lib/ai/` and `lib/actions/` |
| Prompts | **ACTUALLY IMPLEMENTED** | System/user prompts for lead analysis, follow-up, feedback, call summaries, and voice conversations | Prompts contain roles, output instructions, business boundaries, and conversation behavior | `lib/ai/prompts.ts`; `lib/ai/callSchemas.ts:48-88`; `lib/realtime/prompts.ts` |
| Context engineering | **ACTUALLY IMPLEMENTED** | Selected lead fields, latest analysis, CRM history, transcript, current time, and available slots are assembled for specific calls | The application narrows operational data into task-specific prompt payloads instead of dumping the entire store | `lib/ai/analyzeLead.ts:14-30`; `lib/ai/generateFollowup.ts:26-83`; `lib/ai/summarizeCall.ts:27-57`; `lib/realtime/prompts.ts:12-50` |
| Structured outputs | **ACTUALLY IMPLEMENTED** | Typed lead analyses, follow-up drafts, feedback analyses, call summaries, availability windows, and quote narratives | Model responses are requested through OpenAI Structured Outputs and returned as typed objects | `lib/ai/client.ts:46-58`; `lib/ai/schemas.ts`; `lib/ai/callSchemas.ts`; `lib/actions/appointments.ts:268-278`; `lib/actions/quotes.ts:162-165` |
| JSON/schema validation | **ACTUALLY IMPLEMENTED** | Zod validates user/API inputs and re-validates parsed model output | Invalid input is rejected and nonconforming model output becomes an error/fallback | `lib/ai/client.ts:60-78`; `lib/validations/*.ts`; `lib/actions/calls.ts:14-56`; API route `safeParse` calls |
| Tool/function calling | **NOT PRESENT** | None | Models do not receive callable tool definitions and do not choose/execute functions. Post-model actions are hard-coded application logic | No model request contains `tools`, `tool_choice`, or function-call handling; `lib/ai/client.ts:46-58`; `app/api/realtime/session/route.ts:75-98` |
| APIs | **ACTUALLY IMPLEMENTED** | Next.js JSON routes plus outbound OpenAI, HubSpot, and webhook requests | Route handlers validate requests and application code calls external HTTP APIs | `app/api/**/route.ts`; `lib/integrations/hubspot/client.ts:79-165`; `app/api/realtime/session/route.ts:94-159` |
| Webhooks | **ACTUALLY IMPLEMENTED** | Inbound demo `lead.created`, test echo endpoint, and conditional outbound lead export | The app receives JSON events and can generate/send structured HTTPS payloads | `app/api/demo/webhook/lead-created/route.ts`; `app/api/webhooks/test/route.ts`; `lib/actions.ts:657-723`, `725-895` |
| Connectors | **PARTIALLY IMPLEMENTED** | HubSpot payload builder, dry-run logging, and conditional live REST sync | A concrete adapter exists, but dry-run is the default and live operation is unverified | `lib/integrations/hubspot/client.ts`; `lib/actions/crm.ts` |
| MCP | **NOT PRESENT** | None | Tutorial/spec copy mentions MCP as a possible future boundary, but there is no MCP server, client, manifest, transport, or invocation | Mentions only in `components/tutorial/TutorialProvider.tsx` and design docs; no MCP dependency or implementation |
| Retrieval | **PARTIALLY IMPLEMENTED** | Exact database/store lookup of a lead, latest analysis, caller match, and availability | This is conventional record retrieval used to build context, not semantic knowledge retrieval | `lib/ai/generateFollowup.ts:26-42`; `lib/calls/completeCall.ts:601-625`; `lib/integrations/calendar/internalCalendar.ts:72-142` |
| Grounding | **PARTIALLY IMPLEMENTED** | Realtime prompts include known CRM facts and actual open-slot labels; post-call code resolves requested times against slots | Model behavior is constrained by application records, but there are no citations, provenance checks, or a general grounding layer | `lib/realtime/prompts.ts:12-50`; `app/api/realtime/session/route.ts:308-348`; `lib/calls/completeCall.ts:738-752`, `930-1013` |
| RAG | **NOT PRESENT** | None | There is no document ingestion, chunking, semantic retrieval, or retrieved knowledge supplied to generation | No qualifying files or dependencies found |
| Embeddings/vector search | **NOT PRESENT** | None | No embedding model calls, vector columns, vector database, or similarity query exists | No qualifying files or dependencies found |
| Agents | **NOT PRESENT** | None under a strict implementation definition | “AI assistant” UI language does not create an agent: there is no model-directed iterative plan/tool/action loop | Voice is a conversational model in `lib/realtime/prompts.ts`; workflows are hard-coded in `lib/calls/completeCall.ts` and `lib/ai-workflows/runModule.ts` |
| Workflows | **ACTUALLY IMPLEMENTED** | Lead creation, post-call processing, feedback escalation, appointment reminders, and CRM sync | Multi-step business sequences read/write operational state and create downstream work | `lib/calls/completeCall.ts:628-1191`; `lib/ai/analyzeFeedback.ts`; `lib/communications/reminders.ts`; `lib/actions/crm.ts` |
| Orchestration | **ACTUALLY IMPLEMENTED** | Application code sequences model output, deterministic checks, database writes, tasks, appointments, and drafts | Responsibility is coordinated by ordinary TypeScript code, not an agent framework | `lib/calls/completeCall.ts`; `lib/ai/analyzeLead.ts`; `lib/automations/runner.ts` |
| State | **ACTUALLY IMPLEMENTED** | React call state, cookie-backed demo state, optional database state, and activity/status transitions | Calls and business records move through explicit states and persist between requests | `components/calls/useCallEngine.ts:64-225`; `lib/demo/serverStore.ts`; Supabase migrations |
| Memory | **NOT PRESENT** | No model memory subsystem | Persisted CRM records and transcripts are application data; only selected records are manually reused as prompt context | `lib/realtime/prompts.ts:12-29`; `lib/ai/generateFollowup.ts:26-83` |
| Database/system of record | **PARTIALLY IMPLEMENTED** | Optional Supabase/Postgres schema; cookie store is default | A real relational implementation exists, but the inspected default demo operates on per-browser cookies rather than a durable shared system of record | `lib/demo/mode.ts`; `lib/demo/serverStore.ts`; `supabase/migrations/001_initial_schema.sql`, `004_phase2_schema.sql` |
| Background jobs | **NOT PRESENT** | None | AI analysis is awaited inline; due reminders run only when an endpoint/action is invoked | `lib/actions/leads.ts:306-315`; `app/api/automations/reminders/route.ts` |
| Scheduled processes | **PARTIALLY IMPLEMENTED** | Reminder records have due times and a due-item runner | Scheduling logic exists, but no cron/worker configuration invokes it automatically | `lib/communications/reminders.ts`; `supabase/migrations/006_communication_lifecycle.sql`; no `vercel.json` or worker |
| Human approval | **ACTUALLY IMPLEMENTED** | Draft messages can be edited, approved/simulated-sent, or discarded | Customer-facing drafts are held in `draft` state and require an explicit UI action; routine reminder policy is pre-approved | `lib/actions/inbox.ts:924-1179`; `lib/demo/localInbox.ts:592-619`; `lib/communications/reminders.ts:63-76` |
| Deterministic validation | **ACTUALLY IMPLEMENTED** | Input schemas, slot overlap checks, permitted status transitions, appointment resolution, and quote rules | Code—not a model—enforces types and operational constraints | `lib/validations/*.ts`; `lib/actions/appointments.ts:163-238`; `lib/integrations/calendar/internalCalendar.ts`; `lib/property/quoteCalculator.ts` |
| Authentication | **NOT PRESENT** | Current app deliberately has no login | `/login` redirects to the app and internal actions choose the first profile rather than authenticate a user | `app/(auth)/login/page.tsx`; `app/app/layout.tsx:21-40`; repeated `requireUser` helpers in `lib/actions/` |
| Authorization | **PARTIALLY IMPLEMENTED** | Broad Supabase RLS policies exist, but current server paths use service-role access | Database policy scaffolding exists; current no-login execution does not enforce user/role decision rights and bypasses RLS | `supabase/migrations/002_rls_policies.sql`; `supabase/migrations/004_phase2_schema.sql:238-269`; `lib/supabase/server.ts:9-23` |
| Failure handling | **ACTUALLY IMPLEMENTED** | Validation errors, failed-contact workflow, external API error propagation, and fallback states | Many failures produce explicit status/error records or human follow-up instead of silently succeeding | `lib/ai/client.ts`; `lib/calls/completeCall.ts:1194-1295`; `lib/actions/crm.ts:229-242`; API routes |
| Fallbacks | **ACTUALLY IMPLEMENTED** | Deterministic lead/follow-up/feedback/call summaries and scripted voice mode | The core demo can continue when OpenAI is absent or returns invalid output | `lib/ai/fallbacks.ts`; `lib/ai/summarizeCall.ts:198-221`; `components/calls/useCallEngine.ts:227-251` |
| Retries | **PARTIALLY IMPLEMENTED** | Realtime mint tries GA full configuration, GA minimal configuration, then beta | One integration has a compatibility retry chain; there is no general retry policy, backoff, durable retry queue, or idempotent replay framework | `app/api/realtime/session/route.ts:168-214` |
| Logging | **ACTUALLY IMPLEMENTED** | Activities, automation runs, CRM sync events, demo event log, and console errors | Important workflow outcomes and failures are recorded for inspection | `lib/automations/runner.ts:185-248`; `lib/actions/crm.ts:116-139`; `lib/demo-log.ts`; `console.error` call sites |
| Observability | **PARTIALLY IMPLEMENTED** | UI-visible activity/run/sync history and a Realtime diagnostic endpoint | Useful demo diagnostics exist, but no centralized telemetry, tracing, metrics, alerting, SLOs, or production dashboards were found | `app/api/realtime/session/route.ts:216-238`; `automation_runs` and `crm_sync_events` migrations |
| Automated tests | **NOT PRESENT** | None | No test script, framework, unit/integration/e2e files, or CI test workflow exists | `package.json`; repository-wide test-file search |
| AI evals | **NOT PRESENT** | None | Schema checks validate shape, not semantic quality; no datasets, graders, thresholds, or evaluation runs exist | `lib/ai/client.ts` is validation, not evaluation |
| Regression testing | **NOT PRESENT** | None | Scripted demo scenarios are runtime fallbacks, not assertions in a repeatable test harness | `lib/calls/scriptedScenarios.ts`; `package.json` |
| Model selection | **PARTIALLY IMPLEMENTED** | Environment-selectable structured and Realtime models, plus Realtime compatibility fallback | Operators can choose model identifiers, but there is no task router, benchmark-driven selection, A/B testing, or provider abstraction beyond one wrapper/provider | `.env.example`; `lib/ai/client.ts:43-46`; `app/api/realtime/session/route.ts:207-208`, `343-356` |
| Cost/latency controls | **PARTIALLY IMPLEMENTED** | Token caps, 180-second voice cap, in-memory request limits, and webhook timeout | These bound some spend and runaway operations, but usage/cost tracking, budgets, caching, latency metrics, and robust distributed rate limiting are absent | `lib/ai/client.ts:36-57`; `components/calls/useCallEngine.ts:208-225`; `app/api/realtime/session/route.ts:41-52`; `lib/actions.ts:766-785` |
| Voice | **ACTUALLY IMPLEMENTED** | Browser microphone/audio over WebRTC with OpenAI Realtime and transcript events | The app captures microphone audio, negotiates SDP, plays model audio, and consumes transcription events | `components/calls/useCallEngine.ts:254-360`; `app/api/realtime/session/route.ts` |
| Multimodal inputs | **PARTIALLY IMPLEMENTED** | Audio plus text/transcript data | Audio is a genuine non-text input modality; images, video, documents, and computer vision are not implemented | `components/calls/useCallEngine.ts:254-327`; no image/document model input code |
| Low-code/no-code components | **PARTIALLY IMPLEMENTED** | Downloadable n8n workflow JSON and Zapier/Make-style webhook payloads | A low-code workflow artifact and integration contract exist, but the repository does not run n8n, Make, Zapier, or Power Automate | `app/api/demo/n8n-workflow/route.ts`; `lib/actions.ts:657-723`; `docs/automation-hub-fable5-review-spec.md` |

## SECTION 3 — CURRICULUM EXAMPLES

### MODULE 1 — AI vs Automation vs Deterministic Software

**Example title:** Deterministic quote numbers with an optional AI narrative

**What the user experiences:** A staff user chooses quote inputs and receives a low/high internal ballpark, line items, assumptions, missing information, inspection questions, and talking points.

**What is actually happening:** `calculateQuote` computes every dollar amount with fixed multipliers and formulas. In Supabase mode, a structured model call can write only the internal summary and talking points. In default local-demo mode, even that narrative is a fixed template.

**Why this illustrates the module:** The project deliberately assigns arithmetic and pricing boundaries to deterministic code while reserving language generation for explanatory prose.

**Exact project evidence:** `lib/property/quoteCalculator.ts:41-255`; `lib/actions/quotes.ts:167-278`.

**Important boundary or tradeoff:** These are demo price assumptions, not validated estimating models. AI is not calculating the price, and the output is not a customer-ready final quote.

**Interview-safe claim:** “In my Home Service AI Command Center prototype, quote amounts are calculated deterministically, while AI is optionally used for the internal narrative. That keeps financial arithmetic out of the model.”

**Do NOT claim:** AI pricing; production estimating accuracy; insurer acceptance; real property data; financial ROI.

### MODULE 3 — Software Literacy for Non-Engineers

**Example title:** A visible front end, server boundary, model boundary, and storage boundary

**What the user experiences:** The user works in a single CRM-style browser application.

**What is actually happening:** React components submit to Next.js Server Actions or API routes. Server code validates input, optionally calls OpenAI, applies business rules, and stores state in HTTP-only cookies by default or Supabase when selected.

**Why this illustrates the module:** It gives a concrete way to distinguish interface code, server logic, external APIs, and persistence in one real prototype.

**Exact project evidence:** `app/app/layout.tsx`; `components/**`; `lib/actions/**`; `app/api/**`; `lib/demo/serverStore.ts`; `lib/supabase/server.ts`.

**Important boundary or tradeoff:** The repository is a monolithic Next.js application, not evidence that this is the only or best production architecture.

**Interview-safe claim:** “I can trace a user action from the React interface through a server action, validation, optional model call, deterministic business logic, and persistence.”

**Do NOT claim:** microservices; distributed architecture; event-driven production infrastructure; high-scale deployment.

### MODULE 4 — Prompting and Context Engineering

**Example title:** Building a call prompt from known CRM facts and real schedule options

**What the user experiences:** The voice assistant recognizes an existing lead, avoids re-asking known details, discusses the project, and offers appointment times.

**What is actually happening:** `knownFacts` selects name, contact, address, service, description, leak, and insurance fields. `scheduling` adds allowed start times and the soonest computed openings. Scenario-specific prompt branches determine how the assistant opens and what it should collect.

**Why this illustrates the module:** The prompt is dynamically constructed from task-relevant operational context plus policy boundaries and conversation instructions.

**Exact project evidence:** `lib/realtime/prompts.ts:12-128`; `app/api/realtime/session/route.ts:308-356`.

**Important boundary or tradeoff:** Supplying slots in a prompt helps but does not guarantee compliance. The later deterministic resolver is what controls whether a database appointment is actually written.

**Interview-safe claim:** “For voice calls, I construct scenario-specific context from the CRM and computed availability, then separately validate booking state in application code.”

**Do NOT claim:** RAG; semantic search; perfect grounding; live mid-call calendar tool calls.

### MODULE 5 — Structured Outputs, Tool Calling, APIs, Connectors, Plugins, MCP

**Example title:** Schema-constrained model output without tool calling

**What the user experiences:** AI results appear as typed fields—urgency, lead quality, tasks, sentiment, call fields, or availability windows—rather than an unstructured chat response.

**What is actually happening:** `callStructuredAI` uses the OpenAI SDK’s `zodResponseFormat`, checks refusals/missing parsed content, and runs a final `safeParse`. The application then performs hard-coded writes. No callable tools are exposed to the model.

**Why this illustrates the module:** It cleanly separates structured output from tool/function calling, two concepts that are often incorrectly conflated.

**Exact project evidence:** `lib/ai/client.ts:31-80`; `lib/ai/schemas.ts`; `lib/ai/callSchemas.ts`; `lib/integrations/hubspot/client.ts`.

**Important boundary or tradeoff:** HubSpot live-sync code is conditional and unverified. There are no plugins or MCP components.

**Interview-safe claim:** “I implemented OpenAI Structured Outputs validated with Zod and then let deterministic application code decide what to persist. I did not implement model tool calling or MCP.”

**Do NOT claim:** MCP; function calling; agent tools; production connector reliability; installed low-code integrations.

### MODULE 6 — RAG, Search, Grounding, Enterprise Knowledge

**Example title:** Operational context grounding, not RAG

**What the user experiences:** An existing-customer call can reference the customer’s known request, and appointment discussion uses current internal availability.

**What is actually happening:** Exact record queries retrieve a known lead and scheduled appointments. Selected fields and slot labels are inserted into the prompt; post-call logic resolves a requested time against computed availability.

**Why this illustrates the module:** It demonstrates a narrow form of grounding with authoritative application state while showing why ordinary database lookup is not automatically RAG.

**Exact project evidence:** `lib/calls/completeCall.ts:601-625`, `738-752`, `930-1013`; `lib/realtime/prompts.ts:12-50`; `lib/integrations/calendar/internalCalendar.ts:72-242`.

**Important boundary or tradeoff:** There is no document corpus, embeddings, semantic retrieval, citations, or enterprise knowledge connector.

**Interview-safe claim:** “I ground parts of the voice workflow with exact CRM and calendar records, but I would not describe this project as RAG.”

**Do NOT claim:** RAG; vector search; enterprise search; citation-backed answers; knowledge-base ingestion.

### MODULE 7 — Agents, Workflows, Orchestration, State, Memory

**Example title:** Application-orchestrated post-call workflow, not an agent

**What the user experiences:** Ending a call can produce a transcript, CRM note, lead update, appointment, task, and confirmation draft.

**What is actually happening:** A fixed TypeScript sequence obtains a structured summary, normalizes fields, matches/creates a lead, resolves a slot, writes records, creates tasks, and creates a draft. The model does not plan or choose tools.

**Why this illustrates the module:** It is a strong example of workflow orchestration and persistent state, and an equally strong counterexample to casually calling every AI workflow an “agent.”

**Exact project evidence:** `components/calls/useCallEngine.ts:142-189`; `lib/calls/completeCall.ts:628-1191`; default equivalent in `lib/demo/localWorkflows.ts:536-627`.

**Important boundary or tradeoff:** The default local and Supabase paths do not have identical safeguards; for example, local post-call code can choose the first slot when a summary says an appointment was requested.

**Interview-safe claim:** “I built a multi-step AI-enabled workflow orchestrated by application code. I do not claim it is an autonomous agent or memory system.”

**Do NOT claim:** agent loop; planning; autonomous tool use; durable agent memory; agent framework.

### MODULE 8 — Building AI-Enabled Applications and AI-Assisted Prototyping

**Example title:** Provider seams and deterministic demo modes

**What the user experiences:** The same product story remains demonstrable with or without a working AI voice session.

**What is actually happening:** Structured tasks call a shared OpenAI wrapper and fall back to heuristics. Voice session failures switch to scripted scenarios for the assistant persona. Property lookup has a provider interface with only a deterministic demo provider today.

**Why this illustrates the module:** The prototype separates product workflows from provider availability and labels simulated behavior, allowing iterative AI-assisted development without pretending every integration is live.

**Exact project evidence:** `lib/ai/client.ts`; `lib/ai/fallbacks.ts`; `components/calls/useCallEngine.ts:227-251`; `lib/property/provider.ts`; `lib/property/demoProvider.ts`.

**Important boundary or tradeoff:** A resilient sales demo is not the same as a production-grade degraded mode; the two storage paths also introduce behavior drift.

**Interview-safe claim:** “I used AI-assisted development to build an independent prototype with explicit provider seams and deterministic fallbacks, then verified that it compiles and runs as a Next.js application.”

**Do NOT claim:** personally hand-built infrastructure; production readiness; customer deployment; battle-tested resilience.

### MODULE 9 — Data Foundations

**Example title:** Typed operational records and separated transcript/summary storage

**What the user experiences:** The CRM timeline shows short actionable call notes, while a full transcript is stored separately and opened only when needed.

**What is actually happening:** Relational schemas separate leads, calls, transcripts, summaries, communications, appointments, tasks, activities, and sync events. `call_transcripts.storage_visibility` is written as `hidden`; `call_summaries` stores action-oriented fields.

**Why this illustrates the module:** AI output becomes useful only after it is mapped into domain records with identifiers, statuses, timestamps, and relationships.

**Exact project evidence:** `supabase/migrations/001_initial_schema.sql`; `supabase/migrations/004_phase2_schema.sql`; `lib/calls/completeCall.ts:675-680`, `1066-1097`.

**Important boundary or tradeoff:** Default cookie storage is size-limited and session-scoped; the schema does not prove data quality, retention compliance, backup, tenancy, or production stewardship.

**Interview-safe claim:** “I modeled transcripts, summaries, CRM activities, tasks, messages, and appointments as separate operational records instead of treating the model response as the system of record.”

**Do NOT claim:** enterprise data platform; governed data lineage; durable default storage; production retention controls.

### MODULE 11 — Reliability, Failure Handling, Observability, Production Operations

**Example title:** Explicit failure paths and degraded modes

**What the user experiences:** If structured AI fails, the workflow still returns an editable result; if Realtime cannot start, the demo can explain the reason and switch modes; unsuccessful live contact becomes manual follow-up in the Supabase path.

**What is actually happening:** Exceptions trigger deterministic fallbacks, Realtime minting tries several compatible API configurations, and failed-contact logic marks state and creates an urgent task without fabricating conversation facts.

**Why this illustrates the module:** It demonstrates practical failure containment and transparent degraded status in a prototype.

**Exact project evidence:** `lib/ai/analyzeLead.ts:59-78`; `lib/ai/generateFollowup.ts:47-94`; `app/api/realtime/session/route.ts:168-214`, `329-369`; `lib/calls/completeCall.ts:1194-1295`.

**Important boundary or tradeoff:** There are no durable queues, distributed idempotency, backoff policies, telemetry, alerts, runbooks, SLOs, or incident processes.

**Interview-safe claim:** “I implemented deterministic fallbacks and explicit failed-contact handling, while recognizing that production reliability and observability would require much more infrastructure.”

**Do NOT claim:** production operations; high availability; comprehensive monitoring; automatic recovery; proven failure rates.

### MODULE 12 — Security, Privacy, Prompt Injection, Governance

**Example title:** Server-side secrets with deliberately weak demo identity controls

**What the user experiences:** Browser voice sessions work without exposing the permanent OpenAI API key.

**What is actually happening:** The server mints short-lived Realtime client secrets, and service-role/OpenAI keys stay in server modules. However, the application has no login; many mutation endpoints are reachable without user authentication, and Supabase mode uses service-role access that bypasses RLS.

**Why this illustrates the module:** It provides both a valid credential-handling pattern and a concrete prototype-to-production security gap.

**Exact project evidence:** `app/api/realtime/session/route.ts:16-23`, `94-159`; `lib/supabase/admin.ts`; `lib/supabase/server.ts:9-23`; `app/(auth)/login/page.tsx`; unauthenticated routes under `app/api/`.

**Important boundary or tradeoff:** Prompt boundaries such as “do not promise insurance approval” are behavioral instructions, not a prompt-injection defense. No threat model, content isolation, DLP, audit identity, tenant isolation, or governance workflow exists.

**Interview-safe claim:** “I kept permanent provider credentials server-side and used ephemeral Realtime secrets, but the current no-login demo is not an example of production authentication or authorization.”

**Do NOT claim:** secure enterprise deployment; RBAC; tenant isolation; prompt-injection protection; privacy compliance; governance program.

### MODULE 13 — Human Control, Autonomy, Decision Rights

**Example title:** Editable approval gates for customer-facing messages

**What the user experiences:** AI-labeled confirmation or follow-up drafts wait in an Inbox approval queue; a person can edit, approve/simulate-send, or discard them.

**What is actually happening:** Draft communications have `status: "draft"` and `human_approved: false`. The approval action only accepts draft records, stores an optional edited body, marks the send as simulated, and logs an activity. Appointment reminders are a separate, pre-approved deterministic policy path.

**Why this illustrates the module:** It assigns broader autonomy to internal analysis and routine policy messages while reserving final authority over generative outbound drafts for a human.

**Exact project evidence:** `lib/actions/inbox.ts:924-1179`; `lib/demo/localInbox.ts:592-619`; `lib/communications/reminders.ts:43-98`; `lib/calls/completeCall.ts:1140-1170`.

**Important boundary or tradeoff:** Approval is not tied to an authenticated identity or permission. Some scripted follow-on confirmations are automatically marked simulated-sent after an approved reschedule offer.

**Interview-safe claim:** “I implemented an explicit editable approval state for customer-facing drafts and a separate pre-approved policy for routine reminders.”

**Do NOT claim:** enterprise approval governance; authenticated approvers; real delivery; universal human review of every output.

### MODULE 14 — Product Management for AI: Requirements, PRDs, Stories, Backlogs, UAT

**Example title:** A design spec that accurately labels demo-level implementation

**What the user experiences:** The Automation Center presents workflow modules, approvals, run history, and integration demonstrations.

**What is actually happening:** A review spec identifies the relevant files, states that current “AI workflow modules” are deterministic, lists their created artifacts, and distinguishes the current demo from a future platform. A larger white-label spec is aspirational rather than implemented.

**Why this illustrates the module:** The repository contains concrete product requirements and, importantly, documentation that sets implementation boundaries.

**Exact project evidence:** `docs/automation-hub-fable5-review-spec.md:1-99`; `docs/white-label-ai-integration-platform-spec.md`; `lib/ai-workflows/modules.ts`.

**Important boundary or tradeoff:** No backlog system, acceptance-test suite, signed UAT evidence, delivery metrics, or implemented white-label platform was found.

**Interview-safe claim:** “I documented the intended workflow behavior and explicitly marked which modules were deterministic demo implementations versus future platform capabilities.”

**Do NOT claim:** completed PRD-to-production delivery; formal UAT; implemented multi-tenant platform; client acceptance.

### MODULE 16 — Adoption, Change Management, Training, Human Factors

**Example title:** Role-guided walkthroughs and visible handoffs

**What the user experiences:** An in-app tutorial tells the user whether they are acting as customer or representative, spotlights the next control, explains approvals, and summarizes responsibility after each scenario.

**What is actually happening:** `TutorialProvider` stores progress in browser session storage, coordinates steps with UI events, and presents role, action, artifact, control, and recap copy.

**Why this illustrates the module:** The prototype treats role clarity and explanation of human/AI boundaries as product behavior, not merely documentation.

**Exact project evidence:** `components/tutorial/TutorialProvider.tsx`; `components/tutorial/Spotlight.tsx`.

**Important boundary or tradeoff:** A guided tour is a training artifact, not evidence of user adoption, learning outcomes, behavior change, accessibility validation, or field research.

**Interview-safe claim:** “I built role-specific in-product walkthroughs that explain what the human, AI, and application are doing at each handoff.”

**Do NOT claim:** measured adoption; successful change program; reduced training time; validated usability outcomes.

### MODULE 18 — Model Selection, Cost, Latency, Routing, Provider Strategy

**Example title:** Configurable models and bounded voice sessions

**What the user experiences:** A live voice experience can run when configured and degrade to scripted mode if it cannot; calls are time-limited.

**What is actually happening:** Structured and voice model names are environment-configurable. Structured calls cap completion tokens. Realtime sessions are rate-limited in memory, receive short-lived credentials, and trigger a wrap-up at the configured duration. Realtime minting includes GA/minimal/beta compatibility attempts.

**Why this illustrates the module:** It demonstrates basic model configuration and cost containment decisions without overstating them as routing strategy.

**Exact project evidence:** `.env.example`; `lib/ai/client.ts:43-57`; `app/api/realtime/session/route.ts:41-52`, `168-214`, `316-380`; `components/calls/useCallEngine.ts:208-225`.

**Important boundary or tradeoff:** There is one AI provider, no quality/cost benchmark, no per-task router, no token accounting, no latency instrumentation, and in-memory rate limits are not distributed.

**Interview-safe claim:** “I made model IDs configurable and bounded Realtime duration and structured-output tokens, but I have not built multi-provider routing or cost telemetry.”

**Do NOT claim:** intelligent routing; provider failover; optimized model portfolio; measured latency/cost; enterprise quotas.

### MODULE 19 — Low-Code Automation and Enterprise Tool Ecosystem

**Example title:** Webhook contract and downloadable n8n template

**What the user experiences:** The Integration Lab can preview/send an HTTPS payload and download an n8n workflow definition that forwards a lead event into Northstar.

**What is actually happening:** Next routes accept a `lead.created` payload, create demo records, and invoke deterministic workflow code. Another route returns static n8n workflow JSON. Outbound tests validate HTTPS and use a ten-second abort timeout.

**Why this illustrates the module:** It shows the interface boundary between an application and a low-code orchestrator without claiming the low-code platform is embedded.

**Exact project evidence:** `app/api/demo/webhook/lead-created/route.ts`; `app/api/demo/n8n-workflow/route.ts`; `lib/actions.ts:725-895`.

**Important boundary or tradeoff:** No n8n, Zapier, Make, or Power Automate instance is connected or executed in this repository. The inbound demo webhook lacks authentication.

**Interview-safe claim:** “I implemented webhook contracts and an exportable n8n example, but the repository does not contain a running low-code integration.”

**Do NOT claim:** deployed n8n automation; Zapier/Make connector; enterprise integration certification; secure webhook ingestion.

### MODULE 20 — Voice, Multimodal AI, Computer Use

**Example title:** Browser-based Realtime voice with transcript-driven post-processing

**What the user experiences:** The user speaks through the microphone, hears a model voice, sees transcript turns, and ends with CRM artifacts.

**What is actually happening:** Browser code opens the microphone, creates an `RTCPeerConnection` and data channel, exchanges SDP using an ephemeral secret, plays remote audio, and consumes input/output transcript events. The transcript is later summarized and processed.

**Why this illustrates the module:** It is a genuine audio-input/audio-output AI implementation with a text/structured-data handoff.

**Exact project evidence:** `components/calls/useCallEngine.ts:254-360`; `app/api/realtime/session/route.ts`; `lib/calls/completeCall.ts:652-680`.

**Important boundary or tradeoff:** This is not telephone-network integration, computer use, image understanding, or a multimodal document workflow.

**Interview-safe claim:** “I implemented browser WebRTC voice with short-lived OpenAI Realtime credentials and transcript-based CRM post-processing; no real phone call is placed.”

**Do NOT claim:** telephony; Twilio integration; call-center deployment; computer-use agent; visual multimodality.

### MODULE 24 — Story Bank and Technical Honesty

**Example title:** Demo labels and architecture claims that stop at the code boundary

**What the user experiences:** Call screens state that no real phone call is placed; customer messages are marked simulated; quotes are labeled internal ballparks; CRM sync defaults to dry-run.

**What is actually happening:** Default configuration keeps demo mode on, HubSpot live sync off, browser storage on, and messaging simulated. README and code comments repeatedly declare these boundaries.

**Why this illustrates the module:** The repository supports a strong, honest story precisely because it contains real AI and integration code alongside explicit simulation labels.

**Exact project evidence:** `README.md:8-13`, `127-153`, `198-229`; `.env.example`; `lib/actions/crm.ts`; `lib/actions/inbox.ts`.

**Important boundary or tradeoff:** UI labels do not compensate for missing production security or tests; they only prevent a demo from being mistaken for a live operating system.

**Interview-safe claim:** “I built and verified an independent AI-enabled prototype with real model/API code and deliberately simulated communications, telephony, property data, and default CRM sync.”

**Do NOT claim:** production client implementation; real customers; measured ROI; enterprise adoption; live call/SMS/email volume.

## SECTION 4 — END-TO-END WORKED FLOWS

### FLOW 1 — Public request to speed-to-lead call and approval

1. **HUMAN — USER EVENT:** A homeowner submits the public request form (`components/public/LeadForm.tsx`).
2. **DETERMINISTIC SOFTWARE — INPUT:** Zod validates names, contact details, service, timeframe, budget, leak/insurance flags, and description (`lib/validations/lead.ts`).
3. **DETERMINISTIC SOFTWARE — APPLICATION:** The default path creates a cookie-backed lead and deterministic analysis (`lib/demo/localWorkflows.ts:437-454`); Supabase mode creates database records and can call structured lead analysis.
4. **HUMAN:** The homeowner answers the browser call or chooses the scripted demonstration.
5. **AI or DETERMINISTIC SOFTWARE — MODEL:** With a configured session, OpenAI Realtime conducts an audio conversation using CRM and slot context. Otherwise the assistant persona uses a fixed scripted scenario (`app/api/realtime/session/route.ts`; `lib/calls/scriptedScenarios.ts`).
6. **EXTERNAL SYSTEM:** OpenAI receives audio and returns model audio/transcript events in Realtime mode. No telephone carrier participates.
7. **DETERMINISTIC SOFTWARE — VALIDATION/ORCHESTRATION:** The call engine caps duration and submits at most 200 transcript turns. Post-call logic stores the transcript, obtains a structured summary or heuristic fallback, and resolves appointment language against internal slots (`components/calls/useCallEngine.ts`; `lib/calls/completeCall.ts`).
8. **DETERMINISTIC SOFTWARE — FINAL STATE:** The application updates the lead, books or reschedules an appointment when allowed, creates tasks, writes an activity, and creates a draft confirmation.
9. **HUMAN CONTROL:** Staff review/edit and approve or discard the draft. The send is simulated (`lib/actions/inbox.ts:1030-1097`; local equivalent in `lib/demo/localInbox.ts`).

**Why responsibility is divided this way:** The model handles natural conversation and interpretation; deterministic code owns record validation, slot conflict checks, persistence, and status transitions; a human owns final generative customer communication. The demo can replace the model conversation with a deterministic script so the product narrative remains available during provider failure.

### FLOW 2 — Representative answers an AI customer, then reviews before saving

1. **HUMAN — USER EVENT:** A company representative starts the “you answer” live-call exercise.
2. **AI:** OpenAI Realtime plays the fictional homeowner Jordan using a fixed persona/fact prompt (`lib/realtime/prompts.ts:115-128`).
3. **HUMAN:** The representative leads the call and asks for intake information.
4. **DETERMINISTIC SOFTWARE:** UI transcript parsing fills a visible intake form; the call request sets `deferLeadCreation` so no CRM lead is silently created (`components/calls/useCallEngine.ts:41-45`, `157-174`; `lib/calls/completeCall.ts:754-815`).
5. **AI or DETERMINISTIC SOFTWARE:** The transcript receives a structured summary; failures use a heuristic.
6. **DETERMINISTIC SOFTWARE:** A discussed time is resolved against actual internal availability. The summary and transcript can be saved without creating the lead.
7. **HUMAN CONTROL:** The representative reviews the filled form and chooses when to save the lead (`lib/actions/leads.ts:94-318`).
8. **DETERMINISTIC SOFTWARE — FINAL STATE:** Save creates the lead, links the call, books a validated appointment if selected, produces tasks/activities, and creates a confirmation draft.

**Why responsibility is divided this way:** AI supplies a realistic conversation and extracts candidate data; the representative remains accountable for the real intake interaction and record creation; software enforces types and calendar state. This is augmented work, not autonomous intake.

### FLOW 3 — Feedback text to manager work and response draft

1. **HUMAN — USER EVENT:** A manager enters feedback source, optional rating/name, and feedback text.
2. **DETERMINISTIC SOFTWARE — INPUT:** Zod requires a supported source, rating from 1–5 if present, and 10–8,000 characters of text (`lib/validations/feedback.ts`).
3. **AI:** If configured, OpenAI returns sentiment, risk, summary, categories, actions, a proposed response, and tags under `FeedbackAnalysisSchema` (`lib/ai/analyzeFeedback.ts:35-61`).
4. **DETERMINISTIC SOFTWARE — FALLBACK:** Provider or schema failure invokes `heuristicFeedbackAnalysis`.
5. **DETERMINISTIC SOFTWARE — POLICY:** `applyFeedbackBusinessRules` raises certain low-rating manager/repeat-contact cases to at least high risk; model judgment cannot suppress that policy (`lib/ai/analyzeFeedback.ts:17-32`, `63-66`).
6. **DETERMINISTIC SOFTWARE — APPLICATION:** The result is stored; high/urgent risk creates manager work; configured feedback automation rules run (`lib/ai/analyzeFeedback.ts:72-141`).
7. **HUMAN CONTROL:** A manager reviews the proposed public response before marking/posting it in the demo UI.

**Why responsibility is divided this way:** AI organizes ambiguous language and drafts prose; deterministic policy sets a minimum escalation threshold; the manager retains public-response authority.

### FLOW 4 — Property profile to internal ballpark quote

1. **HUMAN — USER EVENT:** Staff select a lead and request property research/quote preparation.
2. **DETERMINISTIC SOFTWARE — EXTERNAL-DATA SUBSTITUTE:** The only property provider hashes the address to generate repeatable fictional characteristics; it performs no external lookup (`lib/property/demoProvider.ts`).
3. **HUMAN:** Staff select material tier, complexity, job facts, and demo weather context.
4. **DETERMINISTIC SOFTWARE — VALIDATION:** `quoteRequestSchema` validates the fields (`lib/actions/quotes.ts:130-158`).
5. **DETERMINISTIC SOFTWARE — CALCULATION:** `calculateQuote` produces line-item ranges, assumptions, missing information, confidence, and inspection questions (`lib/property/quoteCalculator.ts`).
6. **AI — OPTIONAL AND SUPABASE PATH ONLY:** A structured call may create a short internal summary and talking points. Default local-demo mode uses a fixed narrative instead (`lib/actions/quotes.ts:182-278`).
7. **DETERMINISTIC SOFTWARE — FINAL STATE:** The quote estimate and activity are persisted and labeled internal/preliminary.
8. **HUMAN CONTROL:** An inspection is required before any final scope or customer quote.

**Why responsibility is divided this way:** Formula-based arithmetic is auditable and repeatable; AI only helps communicate the result; humans provide job facts and retain quoting responsibility. Fictional property data is explicitly separated from real external data.

### FLOW 5 — Lead to HubSpot dry-run or conditional live sync

1. **HUMAN — USER EVENT:** Staff choose “Sync to HubSpot.”
2. **DETERMINISTIC SOFTWARE — INPUT/CONTEXT:** The app loads the lead and latest analysis and builds typed contact, deal, and note payloads (`lib/integrations/hubspot/client.ts:14-70`).
3. **DETERMINISTIC SOFTWARE — POLICY:** Unless a private token exists and `ENABLE_HUBSPOT_LIVE_SYNC=true`, the action generates mock IDs, writes dry-run events, and explicitly states that no external CRM changed (`lib/actions/crm.ts:36-43`, `141-184`). The default local storage path is always dry-run.
4. **EXTERNAL SYSTEM — CONDITIONAL:** In enabled Supabase/live mode, HubSpot REST endpoints search/create/update a contact, create a deal, and create a note (`lib/integrations/hubspot/client.ts:97-165`).
5. **DETERMINISTIC SOFTWARE — FAILURE/LOG:** Non-OK HTTP responses throw. The server writes a failed sync event and returns the error (`lib/actions/crm.ts:229-242`).
6. **DETERMINISTIC SOFTWARE — FINAL STATE:** Sync request/response payloads and status are available in CRM sync history.

**Why responsibility is divided this way:** A human initiates a potentially consequential integration; deterministic mapping controls external fields; the default is a safe inspectable dry-run. AI does not decide when or how to sync.

## SECTION 5 — FAILURE AND SAFETY EXAMPLES

| FAILURE | HOW DETECTED | WHAT THE SYSTEM DOES | WHY THIS MATTERS | CODE EVIDENCE |
|---|---|---|---|---|
| Missing OpenAI key | `isAIConfigured()` or route environment check | Structured workflows use heuristics; assistant-persona voice returns scripted mode | Lead/demo flow is not coupled to provider availability | `lib/ai/client.ts:25-45`; `lib/ai/analyzeLead.ts:62-78`; `app/api/realtime/session/route.ts:329-340` |
| Refusal, missing parsed output, or schema-invalid model output | `message.refusal`, missing `message.parsed`, final Zod `safeParse` | Throws `AIResponseError`; callers catch and use deterministic fallback where implemented | Shape failures do not flow directly into operational writes | `lib/ai/client.ts:60-78`; callers in `lib/ai/` |
| Realtime session mint incompatibility/failure | HTTP status/exception from GA or beta endpoint | Tries GA full, GA minimal, then beta; finally returns scripted fallback and reason | Provides a bounded compatibility path and transparent degraded mode | `app/api/realtime/session/route.ts:66-214`, `363-369` |
| Realtime required for AI-customer role | Session is unavailable or connection fails while `persona === "customer"` | Fails visibly instead of substituting the wrong scripted role | Avoids pretending that a human/AI conversation happened | `components/calls/useCallEngine.ts:227-251`, `401-411` |
| Live call has too little real customer speech (Supabase path) | Fewer than two nontrivial customer turns in a non-scripted call | Marks call/AI failed, stores only captured transcript, leaves existing lead facts untouched, and creates an urgent callback task | Prevents seed/demo facts from becoming fabricated CRM data | `lib/calls/completeCall.ts:655-688`, `1194-1295` |
| Invalid JSON or request shape | JSON parse failure and/or Zod/allowlist checks | Returns HTTP 400/422 or action error | Stops malformed external/user data before model or database work | `app/api/ai/*/route.ts`; `app/api/automations/run/route.ts`; `lib/actions/calls.ts:14-56` |
| Missing lead/message/call | Exact lookup returns no record | Returns “not found,” throws a controlled error, or stops the action | Avoids writing orphaned workflow state | `lib/ai/generateFollowup.ts:26-34`; `lib/actions/crm.ts:43-49`; `lib/calls/completeCall.ts:638-644` |
| Requested appointment conflicts with availability | Slot generator subtracts non-cancelled appointments; resolver matches/chooses only from open slots | Supabase post-call path books only a resolved slot; manual calendar holds refuse invalid intervals and avoid overlaps | Calendar state, not model prose, controls booking | `lib/integrations/calendar/internalCalendar.ts:72-142`; `lib/calls/completeCall.ts:930-1013`; `lib/actions/appointments.ts:163-238` |
| Duplicate inbound caller (Supabase path) | Normalized phone or exact email lookup | Attaches call to newest matching lead instead of creating another | Reduces duplicate CRM entities | `lib/calls/completeCall.ts:596-625`, `817-836` |
| Duplicate scheduled reminder | Stable `automation_key` lookup plus partial unique database index | Updates an unsent reminder or leaves an already-sent one unchanged | Reduces duplicate reminder actions | `lib/communications/reminders.ts:52-98`; `supabase/migrations/006_communication_lifecycle.sql:10-12` |
| Unapproved or already-transitioned message | Checks `status === "draft"` or `human_approved` | Refuses approval/send and returns an error; drafts can also be discarded | Enforces the demonstrated communication state machine | `lib/actions/inbox.ts:1030-1137`, `1158-1179`; `lib/demo/localInbox.ts:592-619` |
| HubSpot non-OK response | Wrapper checks `res.ok` and throws with status/body preview | Live action logs a failed sync event and surfaces the error | Makes connector failure inspectable | `lib/integrations/hubspot/client.ts:79-94`; `lib/actions/crm.ts:229-242` |
| Webhook hangs or returns error (Integration Lab) | Ten-second `AbortController` timeout and HTTP status check | Records failed sync event/response preview and returns failure | Prevents an open-ended demo request and preserves evidence | `lib/actions.ts:766-835`, `874-895` |
| Unauthorized webhook test request | Optional shared secret mismatch | Returns HTTP 401 | Demonstrates a minimal shared-secret control | `app/api/webhooks/test/route.ts:8-12` |

Important safety gaps discovered during the same audit:

- The real demo `lead.created` endpoint does not apply the optional webhook secret (`app/api/demo/webhook/lead-created/route.ts`).
- AI analysis, reminder, reset, call-session, and other mutation paths are deliberately unauthenticated in the no-login demo.
- Default local post-call code uses `resolved ?? first available slot` when the summary merely says an appointment was requested (`lib/demo/localWorkflows.ts:541-545`), which is weaker than the Supabase path’s explicit resolution logic.
- HTTPS-only validation on arbitrary Integration Lab webhook URLs is not a complete SSRF defense; there is no hostname/IP allowlist.
- There is no systematic hallucination detector. Prompt rules, schema validation, heuristic normalization, and selected deterministic business checks reduce some risks but do not prove semantic truth.

## SECTION 6 — TESTING / EVALUATION EXAMPLES

### A. NORMAL SOFTWARE TESTS

No automated unit, integration, component, or end-to-end test suite was found. `package.json` has no `test` script or test framework dependency. Repository-wide searches found no test files or assertion-based harness.

Static verification performed during this audit:

- `npm run lint` — passed.
- `npm run build` — passed; Next.js compiled, type-checked, generated static pages, and built the application/API route manifest.

These are meaningful compilation and static-quality checks, but they are not behavioral tests. The `testAutomationRule` and Integration Lab “test” actions execute demo workflows; they do not contain assertions and should not be counted as an automated test suite.

### B. AI-SPECIFIC EVALUATION / VALIDATION

Implemented validation:

- Structured outputs use OpenAI schema formatting and a final Zod parse (`lib/ai/client.ts`).
- Several model paths fall back when the provider call or validation fails.
- Deterministic policy can override feedback risk upward (`lib/ai/analyzeFeedback.ts`).
- Post-call code normalizes extracted fields and checks calendar state (`lib/calls/completeCall.ts`).

Not implemented:

- No labeled evaluation dataset.
- No golden prompt/response cases.
- No LLM-as-judge or human-scored rubric.
- No factuality, extraction accuracy, appointment accuracy, tone, safety, or refusal metrics.
- No comparison across models/prompts.
- No tracked evaluation runs or thresholds.

Therefore, the project has AI output validation and guardrails, but **AI evals are NOT PRESENT**.

### C. USER / WORKFLOW TESTING

The repository contains extensive guided demo scenarios, scripted call fallbacks, a Realtime diagnostic GET route, a webhook echo route, a downloadable n8n sample, and UI flows for manually running automation rules. These support manual walkthrough and demonstration (`components/tutorial/TutorialProvider.tsx`; `lib/calls/scriptedScenarios.ts`; `app/api/realtime/session/route.ts:216-238`; `app/api/webhooks/test/route.ts`).

No usability-study records, UAT scripts with pass/fail results, participant feedback, issue logs, or client sign-off were found. Scripted scenarios are useful fixtures in spirit, but without assertions they are not regression tests.

### D. THINGS THAT DO NOT CURRENTLY EXIST BUT WOULD BE NEEDED FOR PRODUCTION

- Unit tests for calculators, field normalization, date parsing, rule evaluation, and state transitions.
- Integration tests for database transactions, RLS, webhook authentication, HubSpot mappings, and OpenAI failure modes.
- End-to-end tests for request → call → appointment → approval and for rescheduling/duplicate-contact behavior.
- AI eval sets for lead priority, field extraction, call-summary fidelity, appointment acceptance, feedback escalation, and prohibited claims.
- Regression fixtures run across both local-cookie and Supabase paths to prevent their current behavior drift.
- Load, concurrency, idempotency, retry, timeout, and recovery testing.
- Security tests for unauthorized routes, tenant isolation, service-role exposure, webhook replay/signatures, SSRF, prompt injection, and malicious transcript/content input.
- Manual UAT with actual contractor roles and explicit acceptance criteria.

## SECTION 7 — PROTOTYPE VS PRODUCTION

| AREA | CURRENT DEMONSTRATION | REAL PRODUCTION IMPLEMENTATION |
|---|---|---|
| Identity | No login; fixed demo profile; `/login` redirects to `/app` | Authenticated workforce and customer identities through OIDC/SSO or an appropriate identity provider |
| Permissions | Broad schema RLS exists, but service-role server paths bypass it; approval is not identity-bound | Tenant-aware RBAC/ABAC, least privilege, separate public/internal scopes, authenticated approvals, tested RLS |
| Data | Per-browser compressed cookie state by default; optional Supabase schema | Durable transactional store, migrations in CI, backup/restore, retention/deletion policy, tenancy, data-quality ownership |
| Integrations | Browser Realtime; internal calendar; simulated communications/property/weather; HubSpot and webhooks mostly dry-run | Real telephony, SMS/email, calendar, CRM, property/weather providers with sandbox/live separation and credential lifecycle |
| Monitoring | Console errors, activity/run/sync tables, manual Realtime diagnostic | Central logs, traces, model/provider metrics, alerting, SLOs, dashboards, correlation IDs, audit identity |
| Reliability | Inline actions, selected fallbacks, in-memory rate limits, limited compatibility retries | Durable queues, idempotency keys, transactional/outbox patterns, backoff/dead-letter handling, distributed rate limits, reconciliation |
| Testing | Lint/build pass; manual demo scenarios; no automated tests | Unit/integration/e2e/security/load suites plus AI eval gates and production canaries |
| Security | Server-side permanent secrets and ephemeral Realtime token are good foundations; app/API mutations are no-login | Threat model, authentication, authorization, signed/replay-protected webhooks, SSRF protection, secret rotation, DLP, encryption policy, security review |
| Governance | Prompt boundaries and demo labels; no formal policy/audit workflow | Model inventory, use-case/risk classification, retention/consent policy, change approvals, incident response, human-override policy |
| Support | Guided tutorial and demo errors | Support ownership, runbooks, escalation, incident communications, on-call expectations, integration troubleshooting |
| Ownership | Independent prototype; code comments and specs imply intended behavior | Named product, engineering, data, security, operations, and business-process owners with decision rights |
| Scale | No load or concurrency evidence; cookie size capped at 12 × 3,400 encoded characters; process-local rate limits | Capacity plan, distributed storage/rate limiting, load tests, queue throughput targets, multi-region/data-residency decisions as needed |
| Cost | Token/voice-duration caps and simple rate limits; no usage ledger | Per-tenant/model usage and cost attribution, budgets, alerts, unit economics, quality/cost routing, vendor commitments |
| Deployment | Build passes and README describes Vercel steps; no verified public URL or operating deployment | Reproducible CI/CD, environment promotion, secrets, migrations, rollback, health checks, change control, verified monitoring |

## SECTION 8 — BEST PERSONAL EXAMPLES

1. **Deterministic software separated from AI**  
   **Why strong:** Quote arithmetic is visibly formula-based while narrative is optional AI.  
   **Feature:** Internal ballpark quote.  
   **Accurate sentence:** “I kept financial calculations deterministic and used AI only for optional explanatory language.”

2. **Structured outputs**  
   **Why strong:** Multiple workflows share a concrete OpenAI/Zod schema boundary.  
   **Feature:** Lead, feedback, follow-up, call, availability, and quote schemas.  
   **Accurate sentence:** “I used OpenAI Structured Outputs with application-side Zod validation before consuming model results.”

3. **Context engineering**  
   **Why strong:** Prompt payloads deliberately select current lead, analysis, call, time, and slot facts.  
   **Feature:** Existing-customer and speed-to-lead voice prompts.  
   **Accurate sentence:** “I assemble task-specific CRM and scheduling context rather than treating prompting as a static text box.”

4. **Application orchestration**  
   **Why strong:** One post-call sequence coordinates summary, CRM, calendar, tasks, activity, and approval.  
   **Feature:** `completeCall`.  
   **Accurate sentence:** “The model interprets the conversation, while TypeScript orchestrates the operational workflow and record writes.”

5. **Graceful fallback**  
   **Why strong:** Structured AI has heuristic alternatives and voice has a scripted demonstration mode.  
   **Feature:** Lead/call/follow-up fallback paths.  
   **Accurate sentence:** “Provider failure does not have to break the whole workflow; my prototype records degraded status and uses deterministic fallbacks.”

6. **Human decision rights**  
   **Why strong:** Outbound drafts have explicit editable approval/discard transitions.  
   **Feature:** Inbox approval queue.  
   **Accurate sentence:** “I held generative customer messages for human review while allowing a separate pre-approved policy for routine reminders.”

7. **Grounded operational action without RAG**  
   **Why strong:** Known CRM fields and computed slots become context, and booking is validated against application state.  
   **Feature:** Voice scheduling.  
   **Accurate sentence:** “I ground scheduling with exact CRM/calendar records, but I do not mislabel ordinary record retrieval as RAG.”

8. **Voice-to-structured-workflow handoff**  
   **Why strong:** Real browser audio/Realtime code feeds a transcript and structured CRM pipeline.  
   **Feature:** WebRTC call sandbox.  
   **Accurate sentence:** “I implemented browser Realtime voice and converted the resulting transcript into structured, reviewable operational artifacts.”

9. **Demo/live integration seam**  
   **Why strong:** HubSpot builds the same payload for inspectable dry-run and conditional live execution.  
   **Feature:** HubSpot sync panel and sync-event log.  
   **Accurate sentence:** “I designed a safe dry-run path that exposes exact external payloads before optional live CRM writes.”

10. **Technical honesty in prototyping**  
    **Why strong:** Code and UI explicitly label simulated call, send, property, weather, sync, and quote behavior.  
    **Feature:** README guardrails, default configuration, and demo event logs.  
    **Accurate sentence:** “I can distinguish what this prototype genuinely executes from what it simulates, and I do not present it as a production client system.”

## SECTION 9 — GAPS / DO NOT USE THIS PROJECT FOR THIS

This project is a bad or unsupported primary example for the following claims:

- **MCP:** No MCP server, client, transport, tools, or protocol integration exists. Tutorial/spec references are hypothetical.
- **RAG or enterprise knowledge search:** No ingestion, chunking, retrieval pipeline, citations, embeddings, vector database, or semantic search exists.
- **Agents:** No model-directed iterative planning/tool/action loop exists. Use the project for workflows/orchestration, not an agent claim.
- **Tool/function calling:** Models return structured data; application code performs fixed actions. Those are not the same thing.
- **AI memory:** CRM persistence and selected prompt context are not an AI memory subsystem.
- **Production authentication/authorization:** The current app is deliberately no-login and uses service-role access in Supabase mode.
- **Prompt-injection defense or AI governance:** Prompt boundaries exist, but no injection testing, untrusted-content isolation, DLP, policy engine, or governance process exists.
- **Real telephony:** WebRTC connects the browser to OpenAI, not to a phone number or carrier.
- **Real SMS/email delivery:** Sends are simulated. No Twilio, Resend, Gmail, or Microsoft Graph implementation exists.
- **Live property/weather research:** Property data is deterministically generated from the address; weather is demo/user-provided context.
- **Production HubSpot use:** Live REST code exists, but the default is dry-run and actual portal execution is not verified.
- **Deployed low-code automation:** An n8n JSON template and webhook contracts exist; no running n8n/Make/Zapier workflow is present.
- **Background jobs or production scheduling:** Due-reminder code exists, but no worker/cron deployment invokes it automatically.
- **Production observability/reliability:** No tracing, metrics, alerts, SLOs, durable queues, dead letters, or general retry/idempotency system exists.
- **Automated testing or AI evals:** No test suite, eval dataset, grading pipeline, or regression gate exists.
- **Multi-provider strategy or intelligent routing:** All verified model calls use OpenAI; environment-selected model names are configuration, not routing.
- **Measured model quality, cost, or latency:** No evaluation results, usage ledger, token-cost reports, or latency metrics exist.
- **Enterprise/multi-tenant platform:** The white-label/multi-tenant document is a future specification, not implemented product behavior.
- **Production deployment or scale:** The repository builds, but no public deployment, load evidence, uptime history, real traffic, or operating scale is verified.
- **Real customers, adoption, ROI, TCO, or business outcomes:** The company and scenarios are fictional. No customer records, adoption studies, revenue attribution, cost study, or measured ROI exists.
- **Formal discovery, rollout, change-control, or UAT program:** Product specs and guided tours exist, but no verified client discovery artifacts, pilot plan/results, formal backlog history, release governance, or signed UAT evidence was found.

## FINAL CLAIM AUDIT

Every positive implementation claim above points to code or a repository artifact. Conditional features are labeled conditional; simulated behavior is labeled simulated; design documents are not treated as shipped capability. The strongest accurate summary is:

> Gunnar built, with AI-assisted development, a substantial independent Next.js prototype that combines real OpenAI structured-output and browser voice code with deterministic business rules, explicit fallback modes, operational state, human approval gates, and inspectable integration seams. It is not evidence of MCP, RAG, agents, production security/operations, real customer deployment, or measured business value.
