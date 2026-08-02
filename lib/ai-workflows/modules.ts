import type { AiWorkflowModule } from "./types";

export const AI_WORKFLOW_MODULES: AiWorkflowModule[] = [
  {
    id: "lead_intake_analysis",
    name: "Lead Intake Analysis",
    description:
      "Scores urgency, detects service type, estimates lead quality, and recommends the next action.",
    status: "active",
    trigger: "New lead created or manual test",
    output: "CRM note, priority signal, task suggestion",
    approval: "Not required for internal CRM notes or tasks.",
    destination: "internal_crm",
    destinationLabel: "Internal CRM",
  },
  {
    id: "follow_up_drafting",
    name: "Follow-Up Drafting",
    description:
      "Creates a customer-facing follow-up draft using CRM context and the current pipeline stage.",
    status: "active",
    trigger: "Estimate sent, stale lead, missed call, or manual test",
    output: "Draft SMS/email waiting in the approval queue",
    approval: "Required before any customer-facing message is marked sent.",
    destination: "approval_queue",
    destinationLabel: "Inbox approval queue",
  },
  {
    id: "quote_prep",
    name: "Quote Prep Assistant",
    description:
      "Prepares estimator questions, inspection checklist items, and framing notes before quote work.",
    status: "active",
    trigger: "Appointment booked, quote requested, or manual test",
    output: "Estimator prep packet and Quote Tool handoff",
    approval: "Not required. Internal prep only.",
    destination: "quote_tool",
    destinationLabel: "Quote Tool",
  },
  {
    id: "manager_alert",
    name: "Manager Alert Rules",
    description:
      "Flags high-value, urgent, or risky leads for manager review before the opportunity stalls.",
    status: "active",
    trigger: "Urgent lead, high value, bad review, or manual test",
    output: "Manager task and CRM timeline alert",
    approval: "Not required. Internal alert only.",
    destination: "internal_crm",
    destinationLabel: "Internal CRM",
  },
  {
    id: "crm_update_suggestions",
    name: "CRM Update Suggestions",
    description:
      "Suggests stage changes, missing-field cleanup, source tags, and next tasks without silently changing records.",
    status: "draft",
    trigger: "Lead changed, call summarized, or manual test",
    output: "Suggested CRM updates and task recommendations",
    approval: "Requires human confirmation before changing important CRM fields.",
    destination: "internal_crm",
    destinationLabel: "CRM review",
  },
  {
    id: "external_webhook_sync",
    name: "External Webhook Sync",
    description:
      "Builds the payload a Zapier, n8n, Make, or external CRM workflow would receive.",
    status: "active",
    trigger: "Lead created, appointment scheduled, or manual test",
    output: "Inspectable webhook payload, not sent externally in demo mode",
    approval: "Not required for dry-run payload previews.",
    destination: "external_webhook",
    destinationLabel: "Webhook dry run",
    runTestLabel: "Preview payload",
  },
];

export function getAiWorkflowModule(id: string) {
  return AI_WORKFLOW_MODULES.find((module) => module.id === id) ?? null;
}
