# White-Label AI Integration Platform Spec

First-pass draft for turning the Northstar demo CRM into a white-label AI automation product that agencies can resell to home service companies first, and eventually to service businesses more broadly.

## 1. Product Vision

Build a white-label AI integration, CRM, and automation platform for agencies, consultants, and operators who want to sell AI workflow transformation to home service businesses without building the infrastructure themselves.

The current Northstar CRM demo becomes the flagship demo surface, reference implementation, and starting CRM control plane. The larger product is an AI operations layer with a built-in CRM view that can connect to the client's existing CRM, phone system, calendar, inbox, forms, marketing tools, reporting stack, and automation tools.

The platform should let an agency pitch, configure, launch, monitor, and manage AI-powered workflows for multiple home service clients from one dashboard.

Home services are the first category, not a tiny sub-vertical. The system should work across roofing, HVAC, plumbing, electrical, remodeling, pest control, landscaping, restoration, and similar businesses from the start. Later, the same core platform should expand into other service businesses with different workflow packs, language, data fields, and integrations.

## 2. Core Positioning

### Simple Pitch

"Launch AI assistants, automations, call workflows, follow-up systems, and CRM integrations for home service companies in days instead of months, under your own brand."

### What The Platform Does

- Connects to existing business systems.
- Provides a built-in CRM/control-plane view for contacts, leads, jobs, appointments, conversations, AI activity, workflow runs, sync state, and errors.
- Adds AI assistants for calls, messages, scheduling, notes, follow-up, lead qualification, summaries, reporting, and internal workflows.
- Provides prebuilt workflow packs for home service use cases.
- Lets agencies configure those workflows per client.
- Tracks usage, ROI, failures, sync health, customer interactions, and business outcomes.
- Supports white-label branding so the agency looks like the provider.

### What The Platform Is Not

- It is not only a CRM.
- It is not only a chatbot.
- It is not only Zapier templates.
- It is not a one-off demo.
- It is not a tool that requires every client to abandon their current CRM.

The built-in CRM is a first-class part of the product. It should work as the operational control plane for agencies and clients whether an external CRM remains the source of truth or the client chooses to move into the platform CRM. The primary product value is the combination of AI workflows, integrations, and CRM visibility.

## 3. Target Users

### Platform Owner

The company operating the software.

Needs:

- Manage all agencies.
- Manage billing, tiers, feature access, usage limits, support, and system health.
- Publish workflow templates.
- Monitor global infrastructure.
- Control pricing and margins.
- Review logs and errors across tenants.

### Agency Owner

The customer who resells the platform to home service businesses.

Needs:

- White-label their account with logo, colors, domain, email sender, and client-facing language.
- Add and manage multiple client companies.
- Sell packages such as Bronze, Silver, Gold, and Custom.
- Enable or disable workflows per client.
- Open an operational CRM view for each client to inspect records, conversations, workflow activity, and sync issues.
- See revenue, usage, client health, and outcomes.
- Prove ROI to clients.
- Avoid technical complexity.

### Agency Implementer

The person at the agency who configures client workflows.

Needs:

- Connect CRMs and tools.
- Map fields.
- Test workflows.
- Configure business rules.
- Review sync errors.
- Inspect mirrored CRM data, workflow run history, message drafts, call notes, appointments, and failed sync payloads.
- Run dry-run tests.
- Create client-specific automation settings.
- Troubleshoot without engineering help.

### Client Owner / Manager

The home service business owner, sales manager, office manager, production manager, or admin.

Needs:

- See what AI is doing.
- Review messages when approval is required.
- Understand business impact.
- Trust the system.
- Receive alerts.
- Access reports.
- Avoid complex settings they do not understand.

### Client Staff

Sales reps, CSRs, estimators, production coordinators, and admins.

Needs:

- Use tasks, inboxes, call notes, summaries, appointment details, and alerts.
- See AI recommendations inside existing workflows.
- Correct AI outputs when needed.
- Keep their existing CRM as the source of truth when required.
- Use the platform CRM as the primary CRM when the client chooses that operating model.

### Homeowner / End Customer

The client company's customer.

Needs:

- Fast response.
- Natural communication.
- Easy scheduling and rescheduling.
- Accurate reminders.
- Clear expectations.
- No confusing AI behavior.
- Human handoff when needed.

## 4. Product Structure

### Platform Layers

1. Platform admin layer  
   Used by the software owner.

2. Agency layer  
   Used by agencies to manage clients and white-label settings.

3. Client layer  
   Used by each home service business.

4. CRM control-plane layer
   Contacts, leads, jobs/projects, appointments, tasks, conversations, notes, AI activity, workflow history, sync state, and troubleshooting views.

5. AI automation layer
   Agents, workflows, prompts, policies, approval rules, limits, and logs.

6. Integration layer
   CRM adapters, phone, SMS, email, calendar, webhooks, Zapier, n8n, Make, Power Automate, custom API.

7. Demo / sales layer
   Sandboxes, guided tours, ROI demos, mock data, and client-facing preview links.

### Four Commercial Layers

This product has four commercial/user layers that must stay distinct in the implementation:

1. Product owner layer
   The software owner sells and operates the platform for whitelisters. This layer manages whitelister accounts, global templates, billing plans, infrastructure health, support, audit logs, feature flags, model/provider routing, and platform-level risk controls.

2. Whitelister layer
   The agency, consultant, operator, or reseller sells the platform to businesses under their own brand. This layer manages up to 100 or more client businesses, controls white-label settings, creates demo links, launches client onboarding, configures workflow packs, monitors client health, reviews usage/margin, and troubleshoots AI/integration problems.

3. Client business layer
   The end client is the home service business using the AI workflows, CRM view, approvals, inbox, reporting, appointments, and operational tools. They may use the platform CRM as their primary CRM, or they may keep an external CRM while the platform mirrors and assists it.

4. Homeowner/customer layer
   The client's customer interacts through calls, texts, emails, web chat, forms, scheduling links, review requests, and reminders. This layer should feel like the home service company, not the whitelister or platform owner.

Layer rules:

- A product owner can see and manage all whitelisters and clients, with audited impersonation.
- A whitelister can see and manage only its own client businesses.
- A client business can see only its own data, users, approvals, reports, and CRM records.
- Homeowners never see internal workflow, AI, sync, or tenant information.
- Branding should follow the audience: platform brand for whitelisters where allowed, whitelister brand for client businesses, client business brand for homeowners.

## 5. Key Product Modes

### Demo Mode

Used by agencies to sell.

Features:

- Fake home service CRM demo similar to Northstar.
- Simulated calls, SMS, emails, calendar, CRM sync, reports, automations.
- Resettable data.
- Guided tour.
- Client-specific branding.
- Demo links per prospect.
- "What this would look like in your CRM" sections.

### Sandbox Mode

Used before going live.

Features:

- Real client settings.
- Dry-run CRM sync.
- Fake sends for SMS/email.
- Test phone numbers.
- Test workflows.
- Preview logs.
- Safety checklist.

### Live Mode

Used for production clients.

Features:

- Real CRM sync.
- Real SMS/email/phone integrations.
- Real automation runs.
- Live usage metering.
- Error handling.
- Human approval gates where configured.
- Client reporting.

### CRM Operating Modes

Each client should be able to use the platform CRM in one of several operating modes:

Mirror mode:

- The external CRM remains the source of truth.
- The platform mirrors the records needed for AI workflows, reporting, approvals, and troubleshooting.
- Agencies can inspect contacts, leads/jobs, messages, call notes, appointments, field mappings, sync state, and workflow history without logging into every client system.

Assist mode:

- The external CRM remains the source of truth.
- Agency/client users can approve drafts, retry syncs, correct field mappings, add internal notes, trigger workflows, and investigate problems from the platform CRM view.
- The platform writes approved updates back to the external CRM.

Primary CRM mode:

- The client chooses to use the platform CRM as their main CRM because the AI workflows, communications, reporting, and integrations are already built in.
- External systems can still receive exports, webhooks, or downstream syncs.

Demo-only mode:

- The CRM is used for sales demos, training, sandbox testing, and proof-of-concept workflows without touching live client data.

## 6. White-Label Requirements

### Agency Branding

- Agency logo.
- Agency name.
- Brand colors.
- Custom domain.
- Custom subdomain.
- Email sender name.
- Email sender domain.
- Login screen branding.
- Client portal branding.
- Report branding.
- Proposal/demo branding.
- Support email and phone.
- Optional "powered by" badge controlled by platform tier.

### Client Branding

- Client company name.
- Client logo.
- Client colors where appropriate.
- Customer-facing assistant name.
- Customer-facing SMS/email voice.
- Call greeting scripts.
- Website widget theme.
- Review response tone.

### Brand Hierarchy

The agency should look like the provider to the client. The client should look like the provider to homeowners. The platform owner should be invisible unless explicitly allowed.

## 7. Dashboards

### Platform Admin Dashboard

Core views:

- Agencies.
- Clients.
- Revenue.
- Active subscriptions.
- Usage.
- AI cost.
- Gross margin by agency and client.
- Failed workflows.
- Integration health.
- Model usage.
- Call volume.
- SMS/email volume.
- Support tickets.
- Security events.
- Feature adoption.
- Template performance.

Admin controls:

- Create agency.
- Suspend agency.
- Assign plan.
- Override limits.
- Publish workflow templates.
- Manage platform-wide prompts.
- Manage model routing.
- Manage integrations.
- View audit logs.
- Trigger backfills.
- Run migrations.
- Impersonate agency or client with audit trail.

### Agency Dashboard

Core views:

- Clients.
- Prospect demos.
- Active workflows by client.
- Client health score.
- Usage by client.
- ROI by client.
- Alerts requiring attention.
- Integration failures.
- Upcoming renewals.
- Package/tier assigned to each client.
- Revenue and margin estimates.
- Implementation checklist.
- Sales collateral and demo links.

Agency controls:

- Add client.
- Invite client users.
- Connect tools.
- Configure settings.
- Enable workflow packs.
- Set usage limits.
- Set approval rules.
- Run dry-run tests.
- View logs.
- Export reports.
- Clone configurations from another client.
- Create a demo from a live template.

### Client Dashboard

Core views:

- Leads touched by AI.
- Calls handled.
- Messages drafted/sent.
- Appointments booked.
- Tasks created/resolved.
- Follow-ups completed.
- Reviews analyzed.
- Speed-to-lead stats.
- Missed-call recovery.
- Lead source performance.
- Pipeline movement.
- Revenue influence.
- Open approvals.
- Recent AI activity.

Client controls:

- Review approval queue.
- Edit drafts.
- Pause automations if permitted.
- Escalate issues.
- View transcripts and summaries.
- View reports.
- Manage basic team users if permitted.

The client dashboard should not expose advanced integration settings unless the agency grants access.

## 8. Roles And Permissions

### Platform Roles

- Platform owner.
- Platform admin.
- Support engineer.
- Template manager.
- Billing admin.
- Read-only analyst.

### Agency Roles

- Agency owner.
- Agency admin.
- Implementer.
- Sales/demo user.
- Support user.
- Billing user.
- Read-only user.

### Client Roles

- Client owner.
- Manager.
- Sales rep.
- CSR.
- Estimator.
- Production manager.
- Admin.
- Read-only.

### Permission Concepts

- Tenant isolation.
- Agency-to-client access.
- Feature-level permissions.
- Workflow-level permissions.
- Approval permissions.
- Integration credential permissions.
- Billing permissions.
- Impersonation permissions.
- Audit log visibility.

## 9. Client Onboarding Flow

### Step 1: Create Client

Inputs:

- Company name.
- Industry type.
- Services offered.
- Market location.
- Time zone.
- Main phone number.
- Website.
- CRM used.
- Package tier.
- Primary contact.

### Step 2: Choose Operating Model

Options:

- Mirror mode: external CRM remains source of truth, platform CRM mirrors important records for visibility, AI workflows, reporting, and troubleshooting.
- Assist mode: external CRM remains source of truth, platform CRM is used to approve AI actions, retry syncs, inspect failures, correct mappings, and trigger workflows.
- Primary CRM mode: platform CRM becomes the client's main CRM, with AI workflows and integrations built in.
- Hybrid mode: platform owns AI events, logs, approvals, workflow state, and selected operational records while another system owns customers/deals/jobs.
- Demo-only mode.

### Step 3: Connect Systems

Possible systems:

- CRM.
- Phone.
- SMS.
- Email.
- Calendar.
- Website forms.
- Ads/lead sources.
- Review platforms.
- Payment/invoicing.
- Project management.
- Data warehouse or spreadsheet.

### Step 4: Map Fields

Examples:

- Contact name.
- Phone.
- Email.
- Address.
- Service type.
- Lead source.
- Lead status.
- Pipeline stage.
- Appointment date.
- Assigned rep.
- Estimate amount.
- Job status.
- Notes.
- Tags.
- Custom fields.

### Step 5: Enable Workflow Packs

Examples:

- Speed-to-lead.
- Missed-call rescue.
- Appointment confirmation.
- Appointment reminders.
- Estimate follow-up.
- Review management.
- Storm mode.
- Manager digest.
- CRM cleanup.

### Step 6: Configure Policies

Examples:

- Require approval before outbound SMS.
- Allow automated appointment reminders.
- Never auto-send price quotes.
- Escalate urgent leaks.
- Mark bad reviews high risk.
- Use human handoff after two failed AI turns.
- Do not call before 8 AM or after 7 PM.
- Respect local time zone.
- Record calls only after consent.

### Step 7: Test In Sandbox

Tests:

- Form submission.
- Inbound call.
- Missed call.
- Text reply.
- Appointment booking.
- CRM sync dry run.
- Zapier/n8n webhook.
- Approval queue.
- Error handling.

### Step 8: Go Live

Go-live checklist:

- Credentials connected.
- Field mapping validated.
- Phone/SMS/email approved.
- Calendar sync tested.
- CRM dry run reviewed.
- Approval policy set.
- Staff trained.
- Emergency pause available.
- Billing active.

## 10. Integration Strategy

### Integration Types

1. Native CRM adapters.
2. Generic REST API connector.
3. Webhook connector.
4. Zapier connector.
5. n8n connector.
6. Make connector.
7. Power Automate connector.
8. CSV import/export.
9. Google Sheets/Airtable connector.
10. Browser/RPA connector as a future fallback for closed systems.

### Popular CRM Targets

Home service and contractor platforms:

- JobNimbus.
- ServiceTitan.
- Housecall Pro.
- Jobber.
- Service Fusion.
- AccuLynx.
- Leap.
- CompanyCam.
- JobProgress.
- Buildertrend.
- Contractor Foreman.
- ServiceM8.
- FieldPulse.
- Workiz.
- GoHighLevel.
- Hatch.
- Angi/lead aggregator exports where available.

General CRMs:

- HubSpot.
- Salesforce.
- Zoho CRM.
- Pipedrive.
- Monday.com.
- Airtable.
- Microsoft Dynamics.
- Insightly.
- Keap.

Fallback targets:

- Google Sheets.
- Airtable.
- Postgres.
- MySQL.
- REST webhook.
- Email parser.
- CSV sync.

### Integration Adapter Pattern

Each native adapter should implement:

- Auth connection.
- Credential refresh.
- Field discovery.
- Field mapping.
- Test connection.
- Create contact.
- Update contact.
- Find duplicate contact.
- Create lead/deal/job.
- Update stage/status.
- Create note.
- Create task.
- Create appointment.
- Attach transcript or summary.
- Create tag.
- Fetch recent activity.
- Fetch pipeline stages.
- Fetch users/reps.
- Fetch calendars if available.
- Dry-run preview.
- Sync log.
- Error classification.
- Retry strategy.

### Integration Events

Inbound events:

- New lead.
- Updated lead.
- New call.
- Missed call.
- New SMS.
- New email.
- Appointment created.
- Appointment changed.
- Estimate sent.
- Job won.
- Job lost.
- Job completed.
- Review received.
- Payment received.
- Pipeline stage changed.

Outbound events:

- Create/update contact.
- Create/update lead.
- Create note.
- Create task.
- Draft message.
- Send message.
- Create appointment.
- Move pipeline stage.
- Add tag.
- Assign owner.
- Create manager alert.
- Sync report.

## 11. Zapier And n8n Strategy

### Why This Matters

Agencies need fast wins. Not every CRM gets a native adapter on day one. Zapier and n8n provide a bridge into hundreds of systems while native adapters mature.

### Zapier App

Triggers:

- New AI-qualified lead.
- New urgent lead.
- New call summary.
- Appointment booked.
- Appointment rescheduled.
- Message needs approval.
- Message sent.
- Task created.
- Bad review detected.
- Integration error.
- Daily manager digest ready.

Actions:

- Create lead in platform.
- Create/update contact.
- Send lead to AI analysis.
- Create AI note.
- Start call workflow.
- Draft follow-up.
- Send approved message.
- Add automation event.
- Pause client workflow.

Searches:

- Find client.
- Find contact by phone/email.
- Find lead.
- Find appointment.
- Find workflow.

### n8n Pack

Ship reusable n8n workflows:

- Webhook intake to AI qualification to CRM.
- Missed call to transcript to SMS callback.
- Estimate follow-up sequence.
- Google review monitor to AI response draft.
- CRM stage change to reminder tasks.
- Daily owner digest.
- Integration health monitor.
- Storm/weather campaign switch.
- Duplicate lead cleanup.
- AI note formatter.

### Make / Power Automate

Later but important for business clients:

- Make scenario templates.
- Power Automate templates for Microsoft-heavy companies.
- Teams notifications.
- SharePoint/Excel reporting.
- Outlook calendar sync.

## 12. AI Workflow Library

Every workflow should include:

- Name.
- Category.
- Business unit.
- Trigger.
- Conditions.
- AI action.
- Non-AI action.
- Required integrations.
- Approval policy.
- Risk level.
- Estimated setup time.
- Expected business impact.
- Tier availability.
- Usage cost estimate.
- Test button.
- Dry-run preview.
- Audit log.

### Managed External Automations

Some client automation work will live outside the platform CRM and outside the platform's native workflow runner. This includes custom automations built by the platform owner or whitelister inside HubSpot, GoHighLevel, ServiceTitan, Zapier, n8n, Make, Power Automate, Google Workspace, Airtable, spreadsheets, or other business systems.

These should still be tracked in the platform so whitelisters can manage support and prove value.

Each managed external automation should store:

- Client.
- Owning whitelister.
- External system.
- Automation name.
- Business purpose.
- Trigger.
- Actions.
- Owner/responsible user.
- Link to external automation.
- Required credentials or connected account.
- Related platform workflow, if any.
- Environment: demo, sandbox, or live.
- Status: draft, active, paused, broken, deprecated.
- Last checked time.
- Last successful run time if available.
- Known failure modes.
- Support notes.
- Audit history.

Managed external automation views should show:

- Which clients have custom automations.
- Which automations are live.
- Which automations are broken or stale.
- Which automations depend on expiring credentials.
- Which automations are not observable from the platform and require manual support.
- Which automations should eventually be migrated into the native workflow runner.

### Sales Workflows

- Speed-to-lead call within 60 seconds.
- Web lead qualification.
- Missed-call rescue.
- Abandoned-call recovery.
- After-hours lead response.
- AI intake note taker.
- Sales rep call copilot.
- Appointment booking assistant.
- Appointment reschedule assistant.
- Estimate follow-up sequence.
- Financing objection follow-up.
- Stale lead reactivation.
- No-answer nurture.
- Lead source quality scoring.
- Duplicate lead merge warning.
- Quote-ready lead packet.
- Multi-location routing.
- Lead-to-rep assignment.
- Hot lead manager escalation.

### Marketing Workflows

- Source ROI digest.
- Storm mode campaign switch.
- Review-to-referral ask.
- Website chat assistant.
- Campaign-specific lead tagging.
- Google Ads lead quality feedback.
- Facebook lead cleanup and qualification.
- Neighborhood campaign suggestions.
- Before/after project content prompt.
- Customer testimonial request.
- Seasonal campaign planner.
- Landing-page lead form enrichment.
- Referral campaign tracker.

### Customer Service Workflows

- Active leak escalation.
- Customer complaint triage.
- Bad review alert.
- Warranty request triage.
- Appointment confirmation.
- 24-hour reminder.
- 1-hour reminder.
- Running-late notification.
- No-show recovery.
- Customer text summarization.
- AI reply draft.
- Sentiment/risk detection.
- Human handoff after escalation.
- FAQ assistant.
- Insurance documentation follow-up.

### Operations Workflows

- Estimator prep packet.
- Production handoff packet.
- Weather-aware reschedule warning.
- Permit and HOA checklist.
- Material readiness check.
- Crew schedule conflict alert.
- Measurement/photo missing alert.
- Job won to production kickoff.
- Installation day customer update.
- Post-install cleanup checklist.
- Punch-list follow-up.
- Warranty handoff.
- Change-order summary.

### Administration Workflows

- Daily owner digest.
- Weekly KPI report.
- Aging pipeline manager digest.
- CRM data cleanup.
- Duplicate contact detection.
- Missing field audit.
- Rep activity digest.
- Task overdue digest.
- Lead source cost rollup.
- Job-cost margin alert.
- Payroll/admin task reminders.
- Permission audit.

### IT / Systems Workflows

- Integration health monitor.
- Webhook retry.
- CRM sync failure alert.
- Phone provider outage alert.
- SMS deliverability alert.
- AI cost anomaly alert.
- API credential expiration alert.
- Role-based AI guardrails.
- Audit log export.
- Data retention policy run.
- Sandbox-to-live checklist.

## 13. AI Agents

### Voice Intake Agent

Handles inbound calls, asks questions, summarizes, creates CRM notes, books inspections, and routes urgent issues.

### Speed-To-Lead Agent

Calls or texts new leads immediately after form submission.

### Scheduling Agent

Checks calendar, suggests real slots, books appointments, reschedules, and prevents impossible bookings.

### Sales Follow-Up Agent

Drafts and optionally sends follow-ups after estimates, missed calls, no-shows, and stale leads.

### Customer Service Agent

Handles FAQs, appointment questions, reschedules, complaints, warranty issues, and escalation detection.

### Review Manager Agent

Monitors reviews, drafts responses, flags bad reviews, suggests recovery actions, and asks happy customers for referrals.

### Operations Coordinator Agent

Creates estimator packets, production handoff notes, weather alerts, material checks, and job updates.

### Reporting Analyst Agent

Turns raw activity into owner-ready summaries, KPIs, source reports, and workflow ROI.

### CRM Hygiene Agent

Finds duplicates, bad data, missing fields, stale tasks, stage mismatches, and sync conflicts.

## 14. Approval And Autonomy Model

### Approval Modes

- Always require approval.
- Auto-send low-risk only.
- Auto-send reminders only.
- Auto-send internal tasks only.
- Auto-send after confidence threshold.
- Auto-send for specific workflow.
- Auto-send for specific user/client/tier.
- Human approval for first 30 days, then recommend automation.

### Risk Levels

Low risk:

- Appointment reminder.
- Internal task creation.
- CRM note.
- Daily digest.
- Basic FAQ answer.

Medium risk:

- Appointment confirmation.
- Estimate follow-up.
- Review request.
- Reschedule proposal.

High risk:

- Pricing.
- Financing.
- Legal or insurance language.
- Angry customer response.
- Warranty dispute.
- Refund/discount.
- Final quote.

High-risk outputs should default to approval required.

## 15. Tier Packaging

Names can change, but a simple model:

### Bronze

For small contractors or agencies starting out.

Features:

- 1 client location.
- CRM/webhook integration.
- Basic lead analysis.
- AI call summaries.
- SMS/email draft approval queue.
- Appointment confirmations.
- Basic appointment reminders.
- Basic reports.
- Limited workflow library.
- Zapier templates.
- Monthly usage cap.

Example workflows:

- Speed-to-lead SMS.
- Missed-call task.
- Appointment confirmation draft.
- Estimate follow-up draft.
- Basic review alert.

### Silver

For growing teams.

Features:

- Multiple client users.
- More workflows.
- Phone integration.
- AI voice intake or call assistant.
- Calendar sync.
- n8n templates.
- CRM stage updates.
- Lead source reporting.
- Review management.
- Manager digest.
- Advanced approval policies.
- Higher usage cap.

Example workflows:

- Speed-to-lead call.
- AI scheduling.
- Missed-call rescue.
- Estimate follow-up sequence.
- Bad review triage.
- Estimator prep packet.
- Integration health alerts.

### Gold

For serious operators.

Features:

- Multiple locations.
- Advanced CRM adapters.
- Custom workflow builder.
- Auto-send low-risk workflows.
- AI voice agents.
- Multi-channel inbox.
- Advanced reporting.
- White-labeled client portal.
- Custom prompt policies.
- Role-based guardrails.
- Dedicated onboarding.
- Priority support.
- Higher usage cap.

Example workflows:

- Full AI phone assistant.
- Rescheduling agent.
- Storm mode campaign.
- Production handoff.
- Weather-aware rescheduling.
- Margin alert.
- Custom executive reports.

### Platinum / Enterprise

For agencies with many clients or larger contractors.

Features:

- Unlimited or high-volume clients.
- Custom integrations.
- BYO model or private model routing.
- SSO.
- Dedicated infrastructure option.
- Custom data retention.
- Advanced audit exports.
- White-label domain.
- API access.
- Custom Zapier/n8n packs.
- Dedicated success manager.
- SLA.

## 16. Usage Limits

Track limits per agency and per client:

- AI minutes.
- Voice call minutes.
- SMS sent.
- Emails sent.
- AI analyses.
- Workflow runs.
- CRM sync events.
- Connected integrations.
- Users.
- Clients.
- Storage.
- Transcript retention.
- Report generation.
- Custom workflow count.

The agency should be able to set client limits lower than the agency limit.

## 17. Billing Model

Possible billing layers:

- Agency subscription.
- Per-client subscription.
- Usage overages.
- Add-on workflow packs.
- Add-on AI voice minutes.
- Add-on SMS/email volume.
- Setup fee.
- White-label domain fee.
- Native integration fee.
- Enterprise support fee.

Agency margin features:

- Agency can set client retail price.
- Platform shows agency cost, client price, and margin.
- Optional Stripe passthrough.
- Optional invoice export.

## 18. Agency Client Management

Client list should show:

- Client name.
- Package.
- Status.
- Go-live date.
- Monthly usage.
- Workflow count.
- Open errors.
- Integration health.
- Approval backlog.
- ROI estimate.
- Last AI activity.
- Renewal date.

Client detail should include:

- Overview.
- Integrations.
- Workflows.
- AI agents.
- Approval settings.
- Usage.
- Reports.
- Users.
- Billing.
- Audit log.
- Support notes.
- Sandbox/live toggle.

## 19. Configuration System

### Client Settings

- Company name.
- Time zone.
- Services.
- Service areas.
- Business hours.
- Emergency rules.
- Appointment lengths.
- Sales reps.
- Estimators.
- Crews.
- Lead sources.
- Tone of voice.
- Assistant name.
- Escalation contacts.
- Approval contacts.
- Blackout dates.
- Communication windows.
- Do-not-contact rules.

### Workflow Settings

- Enabled/disabled.
- Trigger source.
- Conditions.
- Delay timing.
- Send channel.
- Approval mode.
- Escalation rule.
- Assigned owner.
- Tags.
- CRM stage mapping.
- Message template.
- AI prompt override.
- Test mode/live mode.

### AI Settings

- Model preference.
- Temperature/style.
- Allowed actions.
- Disallowed language.
- Required disclaimers.
- Confidence threshold.
- Human handoff threshold.
- Data access scope.
- Memory policy.
- Prompt version.

## 20. Workflow Builder

### MVP

No-code toggles and forms for prebuilt workflows.

### V2

Simple rule builder:

- When this happens.
- If these conditions are true.
- Ask AI to do this.
- Then run these actions.
- Require approval if this risk level.

### V3

Advanced workflow canvas:

- Triggers.
- Conditions.
- AI steps.
- Human approval steps.
- Branching.
- Delays.
- Webhooks.
- CRM actions.
- Error paths.
- Test runs.

## 21. AI Prompt And Template Management

Platform should support:

- Global prompt templates.
- Agency-level prompt overrides.
- Client-level prompt overrides.
- Workflow-specific prompts.
- Prompt version history.
- A/B testing.
- Approved language libraries.
- Compliance snippets.
- Forbidden phrases.
- Tone profiles.
- Output schemas.
- Regression tests.

## 22. Reporting And ROI

### Agency Reports

- Client ROI summary.
- Usage by client.
- AI cost by client.
- Workflow adoption.
- Failed workflow rate.
- Revenue influenced.
- Leads touched by AI.
- Appointments booked by AI.
- Approval backlog.
- Time saved estimate.
- Client health score.

### Client Reports

- Speed-to-lead.
- Lead source performance.
- Booked appointment rate.
- Estimate follow-up performance.
- Missed-call recovery.
- Appointment reminder effectiveness.
- Review sentiment.
- Pipeline aging.
- Task completion.
- AI activity timeline.
- Revenue influenced.

### ROI Calculations

Examples:

- Missed calls recovered x estimated close value.
- Faster lead response x improved booking rate.
- Estimate follow-up x recovered opportunities.
- Review management x reputation protection.
- Admin time saved x loaded hourly rate.
- Reduced no-shows x appointment value.

## 23. Observability And Support

Every workflow run should produce:

- Trigger event.
- Inputs.
- AI prompt version.
- AI output.
- Confidence score.
- Action attempted.
- External API response.
- Retry count.
- Final status.
- Cost estimate.
- Duration.
- Human approval status.
- Audit log entry.

Support tools:

- Client timeline.
- Workflow run replay.
- Dry-run simulator.
- Error classification.
- Retry button.
- Disable workflow.
- Impersonation with audit.
- Download logs.
- Redact sensitive info.

## 24. Security And Compliance

Security requirements:

- Multi-tenant isolation.
- Row-level security.
- Role-based access control.
- Encryption at rest.
- Encryption in transit.
- Secrets vault.
- Separate agency/client credentials.
- Audit logs.
- Least-privilege API scopes.
- Credential rotation.
- IP allowlist for enterprise.
- SSO/SAML for enterprise.
- MFA.
- Backup and recovery.

Compliance concerns:

- TCPA consent for calls/texts.
- Call recording consent by state.
- CAN-SPAM for email.
- Data retention settings.
- PII handling.
- Right to delete/export.
- AI disclosure where required.
- No insurance approval promises.
- No final pricing promises without inspection.
- Human escalation for sensitive situations.

Future:

- SOC 2 readiness.
- HIPAA-style controls if expanding industries.
- Data processing agreements.
- Subprocessor list.
- Model provider data policy controls.

## 25. Data Model Concepts

Core entities:

- Platform account.
- Agency.
- Client.
- Location.
- User.
- Role.
- Integration.
- Credential.
- Field mapping.
- Managed external automation.
- Workflow template.
- Workflow instance.
- Workflow run.
- AI agent.
- Prompt template.
- Prompt version.
- Approval item.
- CRM workspace.
- CRM pipeline.
- CRM stage.
- Message.
- Call.
- Transcript.
- Lead/contact mirror.
- Job/project mirror.
- CRM object reference.
- Appointment.
- Task.
- Note.
- Conversation thread.
- Report.
- Usage meter.
- Billing plan.
- Audit event.
- Error event.

Important patterns:

- The platform should keep its own normalized operational mirror of important records, but the client's CRM remains the source of truth when configured that way.
- Every local record should store external object references, source system, sync status, last synced time, and conflict state.
- The platform CRM should be useful even when it is not the source of truth. Agencies need it to inspect client data, understand what the AI saw, review conversations, debug failed workflows, and prove what happened.
- The same CRM data model should support primary CRM mode for clients that prefer to move into this system instead of keeping a separate CRM.

## 26. Source Of Truth And CRM Strategy

Options per client:

### Mirror Mode / External CRM Source Of Truth

The external CRM is authoritative. The platform mirrors the records needed for AI workflows and troubleshooting, then writes approved notes, tasks, appointments, and status updates back to the CRM.

### Assist Mode / External CRM With Platform Actions

The external CRM is authoritative, but users work inside the platform CRM to approve AI drafts, retry failed syncs, inspect workflow runs, correct mappings, trigger follow-ups, and review AI-generated notes. Approved actions sync back to the source CRM.

### Primary CRM Mode

The platform CRM is authoritative. This is useful for clients that do not have a strong CRM, want the simplest setup, or decide the AI-native CRM is easier than keeping their current system.

### Hybrid

The platform owns AI events, logs, approvals, and workflow state. The CRM owns customers/deals/jobs.

## 27. Communication Channels

### Phone

Possible providers:

- Twilio Voice.
- RingCentral.
- Aircall.
- Dialpad.
- OpenPhone.
- GoHighLevel phone.
- ServiceTitan phone if available.

Features:

- Inbound AI answer.
- Rep-assisted live notes.
- Call summaries.
- Call routing.
- Missed-call workflow.
- After-hours mode.
- Call recording consent.
- Transcripts.
- Human transfer.
- Call outcome sync.

### SMS

Possible providers:

- Twilio.
- Telnyx.
- OpenPhone.
- GoHighLevel.
- CRM-native SMS when available.

Features:

- Approval queue.
- Auto reminders.
- Two-way conversation sync.
- Opt-out handling.
- Quiet hours.
- Templates.
- AI drafts.
- Delivery status.

### Email

Possible providers:

- SendGrid.
- Resend.
- Postmark.
- Gmail.
- Outlook.
- CRM-native email.

Features:

- AI replies.
- Thread matching.
- Approval queue.
- Email lead ingestion.
- Follow-up sequences.
- Review request.
- Digest reports.

### Web Chat / Website Widget

Features:

- White-label widget.
- Lead capture.
- AI FAQ.
- Appointment request.
- Human handoff.
- CRM sync.
- Source tracking.

## 28. Home Service Specialization

Home services are the first broad market category. The product should not be limited to one trade such as roofing or HVAC. Instead, the core data model and workflow system should support the common service-business pattern: inbound demand, qualification, scheduling, estimates, follow-up, job/project handoff, customer communication, reviews, reporting, and operational visibility.

Later expansion into other service businesses should happen through new workflow packs, field sets, integration templates, reporting presets, and industry language rather than a rewrite of the platform.

Industries to support:

- Roofing.
- Siding.
- Windows.
- Doors.
- Baths.
- Gutters.
- Leaf protection.
- HVAC.
- Plumbing.
- Electrical.
- Landscaping.
- Pest control.
- Restoration.
- Remodeling.
- Solar.

Home-service-specific concepts:

- Service type.
- Property address.
- Urgency.
- Active leak.
- Storm damage.
- Insurance status.
- Financing interest.
- Estimate appointment.
- Production date.
- Crew schedule.
- Material order.
- Permit/HOA.
- Job cost.
- Review/referral.

## 29. Demo And Sales Enablement

Agencies should get:

- White-labeled platform CRM demo.
- Resettable demo data.
- Guided tour.
- Demo scripts.
- Pitch deck.
- ROI calculator.
- Client-specific demo link.
- Before/after workflow diagrams.
- Feature comparison by tier.
- Case study generator.
- Proposal template.
- Demo call simulator.
- CRM sync dry-run viewer.

The demo should show:

- AI-assisted rep call.
- AI voice assistant.
- Speed-to-lead.
- SMS/email drafting.
- Scheduling.
- Notifications.
- Task creation.
- Pipeline updates.
- Reports.
- CRM sync.
- Automation library.
- Review management.

## 30. Product MVP

### MVP Goal

Let an agency onboard any home service client, connect or mirror their existing CRM when they have one, use the platform CRM as the operational control plane, enable high-value AI workflows, and prove ROI from a dashboard.

### MVP Scope

- Multi-tenant agency/client model.
- Agency dashboard.
- Client dashboard.
- Built-in CRM control plane for contacts, leads/jobs, conversations, appointments, notes, tasks, AI activity, workflow runs, and sync status.
- CRM operating modes: mirror, assist, primary CRM, hybrid, and demo-only.
- White-label branding basics.
- Workflow library with toggles.
- HubSpot adapter.
- Generic webhook adapter.
- Zapier trigger/action app or webhook pack.
- n8n template pack.
- AI lead analysis.
- AI call summary.
- SMS/email draft queue.
- Appointment confirmation/reminder workflow.
- Missed-call rescue workflow.
- Estimate follow-up workflow.
- Review alert workflow.
- CRM sync logs.
- Usage tracking.
- Basic billing plan assignment.
- Sandbox/live mode.

### MVP Non-Goals

- Full visual workflow builder.
- Every CRM adapter.
- Full feature parity with every incumbent CRM.
- Full billing automation.
- Enterprise SSO.
- Fully autonomous AI across all workflows.
- Native mobile app.

## 31. V1 Roadmap

### Phase 1: Productize The Demo

- Extract Northstar-specific copy.
- Rename and shape the current CRM as the reusable CRM control plane.
- Define CRM operating modes: mirror, assist, primary, hybrid, and demo-only.
- Add branding settings.
- Add agency/client entities.
- Add demo mode per agency.
- Add reusable workflow template model.
- Add feature flags and tier controls.
- Harden reset/sandbox logic.

### Phase 2: Integration Backbone

- Build adapter interface.
- Stabilize HubSpot.
- Add webhook connector.
- Add CRM mirroring for contacts, leads/jobs, notes, appointments, conversations, and sync state.
- Add Zapier/n8n packs.
- Add field mapping UI.
- Add dry-run and live-run logs.
- Add retry/error handling.

### Phase 3: Agency Portal

- Client list.
- Client onboarding wizard.
- Workflow toggles.
- Client health.
- Usage.
- Reports.
- White-label settings.
- Support/admin tools.

### Phase 4: Client Portal

- AI activity feed.
- Approval queue.
- Reports.
- Usage summary.
- Basic user management.
- Limited workflow visibility.

### Phase 5: Voice/SMS/Email Production

- Twilio or phone provider.
- SMS provider.
- Email provider.
- Consent/quiet-hour handling.
- Human handoff.
- Delivery tracking.

### Phase 6: Scale And Enterprise

- More CRM adapters.
- Billing automation.
- Advanced workflow builder.
- SSO.
- SOC 2 prep.
- Partner marketplace.
- Template marketplace.

## 32. Technical Architecture

### Frontend

- Next.js app.
- Agency portal.
- Client portal.
- Demo CRM.
- Admin dashboard.
- Workflow library UI.
- Integration setup UI.

### Backend

- API routes/server actions.
- Workflow runner.
- Queue system.
- Scheduled jobs.
- Webhook receiver.
- Adapter service.
- AI orchestration service.
- Usage metering.
- Audit logger.

### Data

- Supabase/Postgres initially.
- Row-level security.
- Tenant IDs on every tenant record.
- Event log tables.
- Sync log tables.
- Workflow run tables.
- Usage meter tables.

### Queues And Jobs

Use a durable queue for:

- Webhook processing.
- CRM sync.
- SMS/email sends.
- AI analysis.
- Report generation.
- Scheduled reminders.
- Retry jobs.

Candidates:

- Supabase queues/cron.
- Inngest.
- Trigger.dev.
- Temporal later.
- Cloud Tasks later.

### AI Orchestration

Needs:

- Model provider abstraction.
- Prompt versioning.
- Structured outputs.
- Tool calling.
- Guardrails.
- Cost tracking.
- Confidence scoring.
- Fallbacks.
- Evaluation tests.

Providers:

- OpenAI.
- Anthropic.
- Google Gemini.
- OpenRouter for routing.
- Customer BYO key for enterprise.

## 33. Safety Guardrails

Global rules:

- Never promise insurance coverage.
- Never provide final quote without inspection.
- Never imply legal/financial certainty.
- Never ignore opt-out.
- Never call/text outside allowed windows.
- Escalate angry customers.
- Escalate emergencies.
- Escalate low-confidence outputs.
- Keep human approval for high-risk messages.
- Maintain audit logs.

Client-configurable rules:

- Services offered.
- Business hours.
- Escalation contacts.
- Approval requirements.
- Allowed channels.
- Auto-send permissions.
- Quiet hours.
- Emergency definitions.
- Tone preferences.

## 34. Competitive Advantages

- Home-service-specific workflow library.
- Agency-first white-label model.
- AI plus CRM integration, not just chatbot.
- Demo-to-live path.
- Zapier/n8n support for fast implementation.
- Human approval controls.
- ROI reporting.
- Multi-client agency dashboard.
- Workflow packaging by business unit.
- Built-in CRM sandbox for selling.

## 35. Major Risks

Technical risks:

- CRM APIs differ widely.
- Some home service platforms have weak or closed APIs.
- Phone/SMS compliance complexity.
- Multi-tenant security complexity.
- AI reliability.
- Calendar sync edge cases.
- Data duplication.
- Webhook retries.

Business risks:

- Agencies may overpromise.
- Clients may expect full autonomy too soon.
- Usage costs could hurt margins.
- Support burden could grow quickly.
- White-label customers need training.

Mitigations:

- Dry-run mode.
- Approval gates.
- Clear tier limits.
- Strong onboarding checklist.
- Integration health dashboard.
- Conservative default automations.
- Template testing.
- Usage caps.
- Support playbooks.

## 36. Open Questions

- Should the first commercial product target agencies first, or direct home service businesses first?
- Which CRM capabilities are required before offering primary CRM mode to real clients?
- Which CRM capabilities can remain mirror/assist-only at launch?
- Which CRM adapter should come after HubSpot?
- Should the platform include phone numbers, or require agencies/clients to bring their own?
- Should SMS/email be sent through platform-owned providers or client-owned accounts?
- How much pricing control should agencies have?
- Should end clients know the platform brand exists?
- Should workflow templates be locked by tier or purchasable as add-ons?
- How much custom prompt editing should agencies get?
- How much autonomy is safe for launch?

## 37. Suggested First Commercial Offer

### Offer Name

AI Operations Launch Kit for Home Service Companies

### Included

- White-labeled demo.
- Client onboarding.
- CRM/webhook connection.
- Speed-to-lead workflow.
- Missed-call rescue workflow.
- Appointment confirmation/reminder workflow.
- Estimate follow-up workflow.
- Review alert workflow.
- AI call notes.
- AI activity dashboard.
- Monthly ROI report.

### Why This Is The Right First Offer

It maps directly to pain the business already understands:

- Leads are expensive.
- Missed calls lose money.
- Follow-up is inconsistent.
- Reviews matter.
- Office staff is overloaded.
- CRM data gets messy.

It also avoids the hardest early promise: fully autonomous AI running every part of the company.

## 38. Immediate Next Build Steps

1. Rename current app internally as the CRM control plane/reference surface.
2. Define CRM operating modes: mirror, assist, primary CRM, hybrid, and demo-only.
3. Add a `tenants` model that can represent platform, agency, and client ownership.
4. Add tenant-aware CRM records for contacts, leads/jobs, conversations, appointments, notes, tasks, external references, and sync status.
5. Add agency/client admin screens.
6. Convert automation cards into real workflow templates.
7. Add per-client workflow enablement.
8. Add generic webhook connector.
9. Add a field mapping UI.
10. Add workflow run logs.
11. Add CRM mirror/debug views for sync payloads, conflicts, retries, and AI-visible context.
12. Add usage meters.
13. Add white-label branding settings.
14. Add an agency demo link generator.
15. Add "dry run vs live" controls.
16. Create Zapier/n8n workflow export docs.
17. Create first pricing/tier config.

## 39. Northstar Demo Relationship

The Northstar app should become:

- The reference CRM control plane.
- A sales demo.
- A sandbox.
- A mirrored CRM/debugging surface for clients that keep an external CRM.
- A primary CRM option for clients that want to move into the platform.
- A proof that the AI workflows can work end to end.

The platform product should make it clear:

- These AI workflows can run inside the platform CRM.
- The platform CRM can mirror an external CRM, assist an external CRM, or become the primary CRM.
- The same workflows can also be connected to HubSpot, JobNimbus, ServiceTitan, Housecall Pro, Jobber, GoHighLevel, Zapier, n8n, or custom APIs.
- The agency's job is to configure, launch, monitor, troubleshoot, and manage those workflows for each client.

## 40. Fable 5 Handoff Goal

This spec should be written so an implementation agent can make sustained progress without repeatedly rediscovering the product intent.

The handoff document should tell Fable 5:

- What the product is.
- Who each surface is for.
- Which data must be isolated.
- Which workflows must exist first.
- Which workflows are explicitly later.
- How tenants, users, CRM records, automations, approvals, integrations, and audit logs relate.
- What a finished feature must do before it counts as complete.
- Which code contracts, schema concepts, and state machines should be used consistently.
- Which security, UX, compliance, and support requirements are non-negotiable.

Non-negotiable build principles:

- Build the platform as multi-tenant from the start.
- Treat the CRM as a first-class operational control plane.
- Treat the AI layer as configurable, observable, and interruptible.
- Treat whitelisters as non-technical by default.
- Make demo, sandbox, dry-run, and live behavior visibly different.
- Make every external action traceable: who/what triggered it, what data was used, what prompt/template ran, what external API was called, what happened, and what the user can do next.
- Default to human approval for customer-facing and high-risk actions until a client explicitly grants more autonomy.

## 41. Security And Tenant Isolation Details

Security is a product requirement, not only a backend implementation concern.

Tenant hierarchy:

- Product owner account.
- Whitelister account.
- Client business account.
- Client location or business unit.
- User membership.

Required isolation behavior:

- Every tenant-scoped table must include the tenant/client ownership needed for row-level security.
- No authenticated user should receive broad `using (true)` access in production policies.
- Users may belong to multiple whitelisters or clients, so access should come from memberships, not hard-coded user roles alone.
- A whitelister user can access only clients attached to that whitelister.
- A client user can access only their own client business and locations.
- Product owner impersonation must require an explicit reason and create an audit event.
- Support access must be time-bound or at least auditable.

Secrets and credentials:

- API keys, OAuth refresh tokens, SMTP credentials, webhook secrets, model keys, and phone/SMS credentials must be encrypted at rest.
- Secrets must never be exposed to the browser.
- Secrets must never appear in workflow logs, sync logs, AI prompts, error messages, screenshots, or support exports.
- Credential rotation and connection reauthorization should be supported per integration.
- Webhooks should support signatures, idempotency keys, replay protection, and rate limits.

Audit events should be emitted for:

- Login and user invitation.
- Role or permission changes.
- Integration connection, disconnection, and credential update.
- Field mapping changes.
- Workflow enable/disable.
- Prompt/template changes.
- Approval policy changes.
- Manual approval, edit, discard, retry, or override.
- Live send/call/sync actions.
- Impersonation.
- Data export and deletion.

Compliance and communication safety:

- SMS must support opt-in, opt-out, STOP handling, quiet hours, and consent source.
- Voice must support call recording consent by region.
- Email must support unsubscribe rules where applicable.
- AI must not promise insurance approval, legal certainty, financing approval, discounts, refunds, or final pricing unless explicitly approved by a human.
- Every client should have configurable disallowed phrases and required disclaimers.
- High-risk customer-facing messages must default to approval required.

Security acceptance criteria:

- Create two whitelisters with one client each; a whitelister user from one cannot access the other's clients through UI, direct URL, server action, API route, or Supabase query.
- Create a client user; they cannot access whitelister-level settings, other clients, global templates, billing margin, or platform admin tools.
- Trigger a workflow in sandbox and live mode; logs show safe redacted payloads and do not expose secrets.
- Connect an integration; tokens are stored encrypted/server-side and are never returned to the client.
- Impersonate a client; audit log captures actor, target, reason, timestamp, and actions.

## 42. User Experience Requirements

The product must be powerful without feeling technical.

Whitelister UX:

- The whitelister dashboard should be a command center for many clients, not a single-client CRM.
- It should be easy to see which clients are healthy, which need attention, which workflows are paused, which integrations are failing, which approvals are piling up, and which clients are producing ROI.
- Setup should be wizard-driven, with safe defaults and plain-language explanations.
- Every technical object should have a human label: "HubSpot sync failed because the `Appointment Date` field is missing" is better than a raw API error.
- Whitelisters should be able to clone a client setup, launch a demo, assign a package, and enable workflow packs without engineering help.

Client business UX:

- The client CRM view should make it obvious what the AI did, what is waiting for human approval, and what changed in the CRM.
- Client users should have a clear emergency pause button for all automations or for a specific workflow/channel.
- The approval queue should support edit, approve, discard, request changes, and "always require approval for this type."
- The CRM should show timeline context: forms, calls, texts, emails, appointments, tasks, notes, AI decisions, workflow runs, and sync events.
- Reports should translate AI activity into business outcomes: response time, appointments booked, missed calls recovered, estimates followed up, reviews handled, time saved, and revenue influenced.

Homeowner/customer UX:

- Customer-facing messages should sound like the client business, not the platform.
- Customers should always have a path to a human.
- Scheduling/rescheduling should be simple and should never expose internal routing logic.
- If AI is disclosed, disclosure language should be configurable by client and channel.

Empty and error states:

- Every dashboard should have useful empty states with next actions.
- Every integration error should explain impact and suggested fix.
- Every paused workflow should show why it is paused and who can restart it.
- Demo mode should always have resettable data and guided scenarios.

## 43. Whitelister Onboarding And Enablement

Whitelisters should be able to start selling before they become technical experts.

Whitelister onboarding flow:

1. Create whitelister account.
2. Add logo, colors, support email/phone, optional custom subdomain/domain.
3. Choose default packages and retail pricing.
4. Configure "powered by" visibility based on plan.
5. Choose default workflow packs to sell.
6. Configure default AI voice/tone and compliance snippets.
7. Generate a white-labeled demo CRM.
8. Generate demo links and proposal/case-study assets.
9. Invite whitelister users.
10. Complete training checklist.

Whitelister sales kit:

- White-labeled demo CRM.
- Pitch script.
- Demo scripts by use case.
- ROI calculator.
- One-page package comparison.
- Proposal template.
- Onboarding checklist.
- Implementation timeline.
- Client FAQ.
- "What happens when something goes wrong" support explanation.

Whitelister client onboarding flow:

1. Create client business.
2. Choose CRM operating mode.
3. Add services, locations, hours, service areas, appointment types, staff, and escalation contacts.
4. Connect CRM or choose platform CRM primary mode.
5. Connect phone/SMS/email/calendar providers or leave in demo/sandbox mode.
6. Map fields.
7. Select workflow packs.
8. Configure approval/autonomy policy.
9. Run sandbox tests.
10. Review generated outputs and sync payloads.
11. Complete go-live checklist.
12. Turn on live mode workflow by workflow.

Client onboarding status should be visible as:

- Draft.
- Demo configured.
- Sandbox configured.
- Awaiting credentials.
- Field mapping needed.
- Sandbox tests passing.
- Ready for go-live.
- Live.
- Paused.
- Needs attention.

## 44. Automation And AI Implementation Contracts

Every automation should be represented as a template plus a client-specific instance.

Workflow template fields:

- Name.
- Slug.
- Category.
- Target user.
- Trigger type.
- Required integrations.
- Required field mappings.
- Conditions.
- Actions.
- Approval policy.
- Risk level.
- Default prompt/template IDs.
- Test fixtures.
- Demo scenario.
- Tier availability.
- Estimated usage cost.

Workflow run state machine:

- `queued`
- `running`
- `waiting_for_approval`
- `waiting_for_external_system`
- `succeeded`
- `skipped`
- `failed_retryable`
- `failed_final`
- `cancelled`
- `paused_by_policy`

Every workflow run should store:

- Tenant/client/location IDs.
- Workflow template and instance IDs.
- Trigger event and payload reference.
- Idempotency key.
- Mode: demo, sandbox, dry-run, or live.
- Input snapshot used by AI.
- Prompt/template version.
- AI output and structured parsed output.
- Approval item ID if applicable.
- External action attempts.
- Retry count.
- Cost estimate.
- Final status.
- User-facing explanation.
- Internal debug details with redaction.

AI action rules:

- AI should produce structured outputs wherever possible.
- Prompt versions should be immutable once used in a live workflow run.
- The UI should show prompt/template version, not just "AI did this."
- AI should be allowed to recommend high-risk actions, but not execute them without approval.
- If AI confidence is low or required data is missing, the action should become an approval/escalation item instead of failing silently.
- AI-visible CRM context should be logged as a redacted snapshot for debugging.

## 45. Implementation Code Shapes

The implementation should use consistent shared types so Fable 5 does not invent new naming for every feature.

Suggested tenant and CRM mode types:

```ts
export type TenantKind = "platform" | "whitelister" | "client";

export type CrmOperatingMode =
  | "mirror"
  | "assist"
  | "primary"
  | "hybrid"
  | "demo_only";

export type RuntimeMode = "demo" | "sandbox" | "dry_run" | "live";

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "waiting_for_external_system"
  | "succeeded"
  | "skipped"
  | "failed_retryable"
  | "failed_final"
  | "cancelled"
  | "paused_by_policy";
```

Suggested integration adapter contract:

```ts
export interface IntegrationAdapter {
  provider: string;

  testConnection(connectionId: string): Promise<AdapterResult>;
  discoverFields(connectionId: string): Promise<FieldDefinition[]>;
  validateMapping(mapping: FieldMapping): Promise<MappingValidationResult>;

  findContact(input: ContactLookup): Promise<ExternalObjectRef | null>;
  upsertContact(input: ContactUpsert): Promise<AdapterWriteResult>;
  upsertLeadOrJob(input: LeadOrJobUpsert): Promise<AdapterWriteResult>;
  createNote(input: NoteCreate): Promise<AdapterWriteResult>;
  createTask(input: TaskCreate): Promise<AdapterWriteResult>;
  createAppointment(input: AppointmentCreate): Promise<AdapterWriteResult>;

  fetchRecentActivity(input: ActivitySyncCursor): Promise<ActivitySyncResult>;
}

export interface AdapterWriteResult {
  ok: boolean;
  mode: RuntimeMode;
  externalRef?: ExternalObjectRef;
  requestPayloadRedacted: unknown;
  responsePayloadRedacted?: unknown;
  error?: ClassifiedIntegrationError;
}
```

Suggested workflow runner contract:

```ts
export interface WorkflowRunContext {
  runId: string;
  whitelisterId: string;
  clientId: string;
  locationId?: string;
  runtimeMode: RuntimeMode;
  workflowInstanceId: string;
  triggerEventId: string;
  idempotencyKey: string;
}

export interface WorkflowStepResult {
  status:
    | "continue"
    | "wait_for_approval"
    | "wait_for_external_system"
    | "skip"
    | "retry"
    | "fail";
  userMessage?: string;
  debugMessage?: string;
  approvalItemId?: string;
  nextRunAt?: string;
}
```

Suggested approval item fields:

```ts
export interface ApprovalItem {
  id: string;
  clientId: string;
  workflowRunId: string;
  channel: "sms" | "email" | "voice" | "crm_note" | "task" | "appointment" | "internal";
  riskLevel: "low" | "medium" | "high";
  status: "pending" | "approved" | "edited_approved" | "discarded" | "expired";
  originalDraft: string;
  editedDraft?: string;
  aiReasoningSummary?: string;
  requiredByPolicy: boolean;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}
```

## 46. Build Acceptance Criteria

A feature should not be considered done only because the happy-path UI exists.

For every major feature, require:

- Tenant isolation test or manual verification.
- Empty state.
- Loading state.
- Error state.
- Permission behavior.
- Demo/sandbox/live behavior where applicable.
- Audit log event where applicable.
- Usage/cost event where applicable.
- Redacted debug log where applicable.
- Acceptance scenario written in plain English.

MVP acceptance scenario:

1. Product owner creates a whitelister.
2. Whitelister brands the portal and creates two client businesses.
3. Client A uses platform CRM primary mode.
4. Client B uses mirror/assist mode with HubSpot or webhook dry-run.
5. Whitelister enables speed-to-lead, missed-call rescue, appointment reminders, estimate follow-up, and review alert workflows for both clients.
6. A demo lead is submitted for Client A; AI analyzes it, creates CRM activity, drafts a message, and creates an approval item.
7. A dry-run webhook lead is submitted for Client B; platform mirrors the record, shows mapped fields, runs AI analysis, and logs the outbound CRM sync payload without sending live data.
8. Whitelister sees both clients in the dashboard with health, usage, approvals, workflow activity, and sync status.
9. Client A user sees only Client A's CRM, approvals, reports, and activity.
10. Client B user sees only Client B's mirrored CRM records and approval queue.
11. Product owner can see both whitelister/client states and an audit trail.

## 47. Suggested Fable 5 Goal Sequence

Use goal-sized build pushes that produce working vertical slices. Each goal should include schema, server logic, UI, seed/demo data, and verification where applicable.

Goal 1: Tenant foundation

- Add platform/whitelister/client/location tenant model.
- Add user memberships and roles.
- Add RLS policies.
- Migrate existing demo records to a default client tenant.
- Add tenant isolation verification.

Goal 2: CRM control plane foundation

- Add tenant-aware contacts, leads/jobs, conversations, notes, appointments, tasks, external references, and activity timeline.
- Convert the Northstar CRM views to use tenant-aware data.
- Add CRM operating mode on each client: mirror, assist, primary, hybrid, or demo-only.

Goal 3: Whitelister dashboard

- Add client list for up to 100 clients.
- Add health, usage, open approvals, sync errors, active workflows, and onboarding status.
- Add client detail with CRM, workflows, integrations, reports, support notes, and audit log tabs.

Goal 4: Workflow templates and run logs

- Convert existing automation rules/cards into workflow templates and client workflow instances.
- Add workflow run state machine.
- Add run logs, idempotency keys, retries, approval pauses, dry-run/live modes, and redacted debug details.

Goal 5: Approval queue and AI activity

- Add universal approval item model.
- Connect SMS/email drafts, CRM notes, appointment changes, and high-risk outputs to approvals.
- Add approve/edit/discard flows with audit events.
- Add "what AI did" timeline entries.

Goal 6: Integration backbone

- Add adapter interface.
- Stabilize HubSpot adapter.
- Add generic webhook adapter.
- Add field discovery/mapping UI.
- Add CRM mirror/debug views for request/response payloads, sync conflicts, and retries.

Goal 7: Whitelister onboarding and demo kit

- Add whitelister branding setup.
- Add package defaults.
- Add white-labeled demo CRM generator.
- Add demo links, guided scripts, and resettable demo data.
- Add client onboarding checklist.

Goal 8: Usage, pricing, and margin tracking

- Add usage meters for AI calls, messages, workflow runs, sync events, voice minutes, storage, and users.
- Add whitelister cost/client price/margin views.
- Add usage caps and overage alerts.

Goal 9: Production communications

- Add real SMS/email provider abstraction.
- Add opt-in/opt-out, quiet hours, delivery status, and consent logs.
- Add live-mode safety checks and emergency pause.

Goal 10: Hardening pass

- Add audit/event coverage.
- Add security checks.
- Add loading/error/empty states.
- Add support tools.
- Add regression scenarios for core workflows.

## 48. Questions To Resolve Before Fable 5 Build Push

Business and packaging:

- Are "whitelister," "agency," and "partner" interchangeable, or should the UI use one term everywhere?
- Do whitelisters pay per client, per usage, per seat, or a platform fee plus usage?
- Can whitelisters set arbitrary retail prices, or only choose from package templates?
- Should the first public offer be whitelister-first only, or should direct service businesses also be allowed to buy?

CRM and data:

- What is the minimum primary CRM feature set: contacts, leads, jobs/projects, pipeline, appointments, tasks, notes, inbox, quotes, reporting?
- Does primary CRM mode need estimates/proposals/invoices at launch, or can it hand those off to other tools?
- Should the CRM model use "lead/job/project" generically, or should terminology change by industry?
- Should whitelisters be able to edit client CRM records, or only inspect/troubleshoot unless granted permission?

Integrations:

- Which first external CRM matters most after HubSpot/webhook?
- Should phone/SMS/email initially use platform-owned provider accounts, client-owned accounts, or both?
- Should whitelisters be able to bring their own Twilio/SendGrid/OpenAI keys?
- Are custom-built automations inside external CRMs handled by this app directly, or tracked as implementation/support work attached to the client?

AI and autonomy:

- Which workflows can auto-send on day one?
- What exact actions should always require approval?
- Should whitelisters be allowed to edit prompts directly, or only choose tone/industry/policy settings?
- Should AI disclosure be mandatory, configurable, or controlled by channel/legal region?

Operations:

- What support promise does the platform owner make to whitelisters?
- What support promise do whitelisters make to their clients?
- Who owns failed automations: platform owner, whitelister, or client admin?
- Should every client have an emergency pause contact and escalation phone number before live mode?
