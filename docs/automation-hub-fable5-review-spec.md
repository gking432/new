# Automation Hub / Integration Lab Review Spec for Fable 5

Date: 2026-06-20

Audience: Fable 5 or another code/product agent reviewing the current demo app before moving into the larger white-label platform spec.

Primary ask: inspect the current Automation Hub / AI Automations work, compare what was implemented against what we are trying to communicate, and identify gaps before extending it.

## Short Version

The app now has an `AI Automations` area that is meant to show more than a list of demo buttons. It should communicate this product idea:

> This system is an AI automation layer for home service businesses. It can operate inside our demo CRM, sit on top of external CRMs, receive events from automation tools, send payloads to automation tools, create internal CRM work, draft customer messages for approval, and log what happened.

The current implementation is a demo-level version of that idea. It is not yet a production integration platform.

Fable 5 should review whether the page actually communicates that clearly, whether the flows are visible after a user clicks something, whether the code is safe enough for a demo, and what should be tightened before the white-label work begins.

## What We Added

### 1. AI Automations Page

Main files:

- `app/app/automations/page.tsx`
- `components/automations/AiAutomationsCenter.tsx`

The old Automations page was replaced with a fuller AI automation center. It pulls together:

- AI workflow modules.
- existing automation rules and run history.
- recent leads.
- pending approval counts.
- reminder counts.
- CRM sync / webhook event logs.
- an Integration Lab tab.

The default tab is currently the Integration Lab, because that is the part that best explains how outside automation platforms fit into the demo.

### 2. AI Workflow Modules

Main files:

- `lib/ai-workflows/modules.ts`
- `lib/ai-workflows/runModule.ts`
- `lib/ai-workflows/services.ts`
- `lib/ai-workflows/types.ts`
- `lib/actions.ts`

The current modules are deterministic demo workflows. They do not call a live AI model. They exist to make the demo predictable and visible.

Current module ideas:

- Lead Intake Analysis
- Follow-Up Drafting
- Quote Prep
- Manager Alert
- CRM Update Suggestions
- External Webhook Sync

The modules create real demo artifacts where useful:

- `automation_runs`
- `activities`
- `tasks`
- `communications` drafts
- lead AI analysis records

Important behavior: customer-facing drafts should remain approval-gated. The demo should never imply a real customer message was sent unless the user explicitly approved a simulated send inside the app.

### 3. Inbound Webhook Demo

Main file:

- `app/api/demo/webhook/lead-created/route.ts`

This endpoint accepts a `lead.created` payload from a generic external CRM, Zapier, Make, or n8n-style workflow.

Example shape:

```json
{
  "eventType": "lead.created",
  "source": "external_crm",
  "payload": {
    "name": "Sarah Mitchell",
    "email": "sarah@example.com",
    "phone": "414-555-0188",
    "serviceType": "roofing",
    "message": "We had hail last night and now water is coming in upstairs."
  }
}
```

Current behavior:

- creates a lead in the demo CRM.
- logs a webhook activity.
- runs the Lead Intake Analysis workflow.
- returns the workflow output.
- does not send customer messages externally.

This is a demo endpoint. It is intentionally simple, but Fable 5 should call out production security gaps.

### 4. Outbound Webhook Test

Main file:

- `lib/actions.ts`

Main action:

- `sendIntegrationWebhookTest`

Current behavior:

- selected lead becomes a structured webhook payload.
- blank webhook URL means dry run only.
- nonblank webhook URL must be HTTPS.
- live sends are explicit only.
- request/response details are logged to `crm_sync_events`.
- activity is logged on the lead.
- result appears in the Integration Lab UI.

This exists so the demo can show "Northstar -> Zapier/n8n/Make/webhook" without needing a full native integration.

### 5. n8n Workflow Download

Main file:

- `app/api/demo/n8n-workflow/route.ts`

The Integration Lab includes a download button for a starter n8n workflow JSON. The workflow is meant to show the rough outside-platform side:

1. receive a webhook in n8n.
2. forward the normalized lead event into the demo endpoint.
3. return the Northstar workflow response.

### 6. Copy/Label Cleanup Around Demo Claims

Other touched areas:

- `components/app/AppSidebar.tsx`
- `components/app/AppHeader.tsx`
- `components/demo/DemoCenterClient.tsx`
- `app/app/demo-center/page.tsx`
- `app/app/crm-sync/page.tsx`
- `components/inbox/InboxView.tsx`

Intent:

- call the area `AI Automations`.
- make it clear drafts are drafts.
- avoid over-claiming that native CRM integrations are fully connected.
- point users from the Demo Center into the Automation Hub.

## What We Are Trying To Accomplish

The Automation Hub should help a non-technical prospect understand four things quickly:

1. The app can respond to business events.
2. AI can analyze, draft, suggest, and prepare work.
3. Customer-facing messages can require human approval.
4. The automation layer can connect to outside systems through webhooks and later native integrations.

It should feel less like "random test buttons" and more like a small command center for automation recipes, workflow outputs, integration testing, and logs.

## Fable 5 Review Goals

### Product/UX Review

Please inspect `/app/automations` and answer:

- Does the page communicate the automation story in under 60 seconds?
- Does it clearly distinguish internal CRM automations from external app integrations?
- Does clicking a button create a visible, understandable result?
- Does the user know where to look after a dry run or webhook send?
- Are the labels honest about what is built versus conceptual?
- Is the Integration Lab too dense, or is it appropriately practical?
- Are empty states helpful, especially when there are no leads?
- Does this feel valuable to a home service business owner or operator?
- Does this feel valuable to a future white-label seller who needs to demo integrations?

### Code Review

Please inspect these files first:

- `components/automations/AiAutomationsCenter.tsx`
- `app/app/automations/page.tsx`
- `lib/ai-workflows/modules.ts`
- `lib/ai-workflows/runModule.ts`
- `lib/ai-workflows/services.ts`
- `lib/ai-workflows/types.ts`
- `lib/actions.ts`
- `app/api/demo/webhook/lead-created/route.ts`
- `app/api/demo/n8n-workflow/route.ts`
- `lib/db/queries.ts`
- `lib/db/queries-phase2.ts`
- `types/app.ts`

Look for:

- accidental production claims in UI text.
- actions that mutate data without an obvious visible result.
- places where demo-only behavior should be labeled.
- over-broad server actions.
- missing loading or error states.
- data shape mismatches between webhook payloads, workflow output, and UI display.
- logs that store too much sensitive data for a future production version.
- places where the UI could break on no leads, missing lead data, failed webhook response, or malformed payloads.

### Manual Test Checklist

Run the app locally, then check:

1. Visit `/app/automations`.
2. Confirm the page loads with the Integration Lab visible.
3. If there are no leads, click the sample lead creation button.
4. Confirm a lead is created and the Lead Intake Analysis workflow runs.
5. Select a lead and click `Log dry-run payload`.
6. Confirm no external request is sent.
7. Confirm a `crm_sync_events` row appears in Recent integration events.
8. Confirm the result panel explains that this was a dry run.
9. Paste an HTTPS webhook URL from Zapier, n8n, Make, or a test catcher.
10. Click `Send to webhook`.
11. Confirm success/failure is visible and logged.
12. Download the n8n workflow JSON.
13. Import it into n8n if available and confirm the node names and endpoint are understandable.
14. Run each AI workflow module test and confirm the output is visible somewhere meaningful.
15. Check Inbox after Follow-Up Drafting and confirm it created a draft, not a sent message.
16. Check Tasks after Manager Alert and Lead Intake Analysis.
17. Check lead activity timeline after workflow runs.

### Automated Checks

Before proposing code changes, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

If Fable 5 changes behavior, also smoke-test:

```bash
curl -I http://localhost:3000/app/automations
curl -s http://localhost:3000/api/demo/n8n-workflow | head -c 1000
curl -s -X POST http://localhost:3000/api/demo/webhook/lead-created \
  -H "content-type: application/json" \
  -d '{"eventType":"lead.created","source":"external_crm","payload":{"name":"Demo Integration Lead","email":"integration@example.com","phone":"555-0101","serviceType":"roofing","message":"Storm damage and roof leak after last night. Need estimate this week."}}'
```

## Acceptance Criteria For This Demo Layer

The Automation Hub is successful when:

- A user can understand that this is an AI automation layer, not just a CRM settings page.
- A user can create or select a lead and run workflow examples without confusion.
- Every workflow test leaves behind a visible artifact: run log, task, draft, activity, payload, or event row.
- The UI never implies a real customer message was sent when it was only drafted.
- The UI never implies native CRM integrations are complete when they are only conceptual or webhook-ready.
- The outbound webhook test only sends externally after an explicit user action.
- Dry-run mode is obvious and useful.
- Recent integration events help diagnose what happened.
- The n8n workflow download gives a future builder a concrete starting point.

## Security And Safety Items To Review

These do not all need to be solved in the demo, but they should be called out before this becomes product architecture.

### Inbound Webhook Security

Current demo endpoint:

- no signature validation.
- no API key.
- no tenant scoping.
- uses an admin client to create records.
- accepts public POST requests.

Production needs:

- signed webhook verification or API keys.
- tenant/client lookup.
- payload validation with a schema.
- rate limiting.
- replay protection.
- audit logs.
- clear separation between demo endpoints and production endpoints.

### Outbound Webhook Safety

Current outbound test:

- lets a signed-in demo user paste any HTTPS URL.
- sends lead data to that URL.
- logs payload and response preview.

Production needs:

- SSRF protection and private-network blocking.
- domain allowlisting or verified webhook destinations.
- secret handling per tenant/client.
- payload minimization.
- PII masking in logs where appropriate.
- retention policy for request/response payload logs.
- retry policy with backoff.
- idempotency keys.

### Customer Messaging Safety

The demo correctly treats AI-written customer communications as drafts.

Fable 5 should preserve that rule:

- pricing language should be review-gated.
- insurance language should be review-gated.
- financing language should be review-gated.
- angry-customer replies should be review-gated.
- appointment confirmations can eventually be configurable, but the demo should remain explicit.

## Suggested Improvements

These are good next candidates if the current page feels close but not polished:

1. Add a payload inspector drawer/modal for the last dry run.
2. Add copy buttons for webhook payload and curl example.
3. Add a clearer left-to-right recipe diagram for inbound and outbound flows.
4. Add explicit "What changed" links after each module run, such as View task, View inbox draft, View lead timeline.
5. Add a small app gallery for Zapier, Make, n8n, Power Automate, HubSpot, GoHighLevel, ServiceTitan, JobNimbus, Housecall Pro, Jobber, and generic webhook.
6. Add event contract versioning, for example `eventVersion: "2026-06-demo"`.
7. Add a read-only payload history detail view for recent integration events.
8. Add clearer error messages when a webhook fails.
9. Add test-catcher instructions for people who do not have Zapier/n8n/Make ready.
10. Split demo-only endpoints under `/api/demo/*` from future production endpoints under `/api/integrations/*`.

## Things To Avoid For Now

Do not turn this demo task into the whole white-label platform.

Avoid:

- full OAuth implementations for every CRM.
- a full background workflow engine.
- multi-tenant agency/client billing.
- deep permission models.
- production webhook credential storage.
- claiming any integration is connected unless it is actually connected.

The current goal is a convincing, honest, useful demo of the automation layer.

## How This Relates To The White-Label Platform

The Automation Hub and the white-label platform are related, but they are not the same product surface.

Current demo:

- one demo CRM.
- one company context.
- simulated/safe AI workflow actions.
- demo webhooks.
- sales/demo storytelling.

White-label platform:

- many white-label sellers.
- many end businesses per seller.
- seller-facing dashboard.
- optional end-business CRM.
- external CRM overlays.
- onboarding flows.
- permissions and roles.
- billing and plan limits.
- brand controls.
- audit logs.
- integration credentials.
- security boundaries between tenants.

## Should The White-Label Project Be Separate?

Recommendation: yes, treat the white-label project as a separate product initiative.

That does not necessarily mean it must be a separate repo today. But it should be conceptually separate from this demo app because the white-label version has different architecture, risk, and user flows.

A good path would be:

- Keep this app as the Northstar demo CRM and proof-of-concept.
- Use it to prove automation workflows, sales demos, and CRM behavior.
- Design the white-label product separately as a true multi-tenant platform.
- Share reusable logic where it makes sense.

If/when this becomes a larger build, consider a monorepo shape:

```text
apps/
  demo-crm/
  platform/
packages/
  automation-core/
  integration-contracts/
  crm-adapters/
  ai-workflow-recipes/
  ui/
```

In that model:

- `apps/demo-crm` is the current Northstar-style demo.
- `apps/platform` is the white-label admin/seller/client platform.
- shared packages hold event contracts, workflow recipes, adapter interfaces, and reusable UI.

If staying in one Next.js app for now, keep the separation in the route structure and docs:

- `/app/*` for the current CRM demo.
- `/platform/*` or `/agency/*` only when deliberately starting white-label work.
- `/api/demo/*` for demo-only endpoints.
- `/api/integrations/*` for future production-grade integration endpoints.

## Fable 5 Prompt To Use

Suggested first prompt:

```text
Read docs/automation-hub-fable5-review-spec.md first. Then inspect the Automation Hub implementation files listed in the doc. Do not implement yet. Tell me whether the current demo clearly communicates the automation/integration layer, what is confusing, what is risky, and what you would change before we use it as the foundation for the larger white-label platform.
```

Suggested second prompt if the review is good:

```text
Now propose the smallest focused implementation pass that would make the Automation Hub more convincing and easier to understand. Prioritize visible user feedback, honest integration labels, dry-run/live webhook clarity, event logs, and safety. Do not start the white-label platform yet.
```

Suggested third prompt before white-label work:

```text
Now read docs/white-label-ai-integration-platform-spec.md. Compare it to the Automation Hub review. Tell me what should remain demo-only, what should become reusable automation core, and what belongs in the separate white-label platform product.
```
