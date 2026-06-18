# White-Label AI Integration Platform Spec

First-pass draft for turning the Northstar demo CRM into a white-label AI automation product that agencies can resell to home service companies.

## 1. Product Vision

Build a white-label AI integration and automation platform for agencies, consultants, and operators who want to sell AI workflow transformation to home service businesses without building the infrastructure themselves.

The current Northstar CRM demo becomes the flagship demo surface and reference implementation. The larger product is not "a CRM replacement." It is an AI operations layer that can connect to the client's existing CRM, phone system, calendar, inbox, forms, marketing tools, reporting stack, and automation tools.

The platform should let an agency pitch, configure, launch, monitor, and manage AI-powered workflows for multiple home service clients from one dashboard.

## 2. Core Positioning

### Simple Pitch

"Launch AI assistants, automations, call workflows, follow-up systems, and CRM integrations for home service companies in days instead of months, under your own brand."

### What The Platform Does

- Connects to existing business systems.
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

The built-in CRM can exist as an optional lightweight CRM, sandbox, or fallback. The primary product value is the AI integration layer.

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

4. AI automation layer  
   Agents, workflows, prompts, policies, approval rules, limits, and logs.

5. Integration layer  
   CRM adapters, phone, SMS, email, calendar, webhooks, Zapier, n8n, Make, Power Automate, custom API.

6. Demo / sales layer  
   Sandboxes, guided tours, ROI demos, mock data, and client-facing preview links.

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

- AI sits on top of current CRM.
- AI uses platform CRM as lightweight CRM.
- Hybrid mode: platform captures AI events and syncs summaries back.
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
- Workflow template.
- Workflow instance.
- Workflow run.
- AI agent.
- Prompt template.
- Prompt version.
- Approval item.
- Message.
- Call.
- Transcript.
- Lead/contact mirror.
- CRM object reference.
- Appointment.
- Task.
- Report.
- Usage meter.
- Billing plan.
- Audit event.
- Error event.

Important pattern:

The platform should keep its own normalized operational mirror of important records, but the client's CRM remains the source of truth when configured that way. Every local record should store external object references and sync status.

## 26. Source Of Truth Strategy

Options per client:

### CRM Source Of Truth

The platform writes notes, tasks, appointments, and status updates back to the CRM. The CRM is authoritative.

### Platform Source Of Truth

The platform CRM is primary. Useful for small clients without a good CRM.

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

- White-labeled demo CRM.
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

Let an agency onboard a home service client, connect a CRM or webhook, enable a small set of high-value workflows, and prove ROI from a dashboard.

### MVP Scope

- Multi-tenant agency/client model.
- Agency dashboard.
- Client dashboard.
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
- Full billing automation.
- Enterprise SSO.
- Fully autonomous AI across all workflows.
- Native mobile app.

## 31. V1 Roadmap

### Phase 1: Productize The Demo

- Extract Northstar-specific copy.
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
- Should the built-in CRM remain a real product or only a demo/fallback?
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

1. Rename current app internally as the demo CRM/reference surface.
2. Add a `tenants` model that can represent platform, agency, and client ownership.
3. Add agency/client admin screens.
4. Convert automation cards into real workflow templates.
5. Add per-client workflow enablement.
6. Add generic webhook connector.
7. Add a field mapping UI.
8. Add workflow run logs.
9. Add usage meters.
10. Add white-label branding settings.
11. Add an agency demo link generator.
12. Add "dry run vs live" controls.
13. Create Zapier/n8n workflow export docs.
14. Create first pricing/tier config.

## 39. Northstar Demo Relationship

The Northstar app should become:

- A sales demo.
- A reference CRM.
- A sandbox.
- A fallback CRM for small clients.
- A proof that the AI workflows can work end to end.

The platform product should make it clear:

- These AI workflows can run inside this demo CRM.
- They can also be connected to HubSpot, JobNimbus, ServiceTitan, Housecall Pro, Jobber, GoHighLevel, Zapier, n8n, or custom APIs.
- The agency's job is to configure, launch, and manage those workflows for each client.

