import "server-only";

import {
  analyzeLeadForAutomation,
  buildWebhookPreview,
  createManagerAlert,
  draftFollowUp,
  prepareQuoteChecklist,
  suggestCrmUpdates,
} from "@/lib/ai-workflows/services";
import { getAiWorkflowModule } from "@/lib/ai-workflows/modules";
import { leadSnapshot, type AiWorkflowModuleId, type ModuleRunOutput } from "@/lib/ai-workflows/types";
import { demoId, mutateDemoState } from "@/lib/demo/serverStore";

export async function runLocalAutomationModule(
  moduleId: AiWorkflowModuleId,
  leadId?: string
): Promise<ModuleRunOutput> {
  return mutateDemoState((state) => {
    const lead = leadId
      ? state.leads.find((item) => item.id === leadId)
      : state.leads.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!lead) throw new Error("Create a demo lead before running this workflow.");
    const workflowModule = getAiWorkflowModule(moduleId);
    if (!workflowModule) throw new Error("Unknown AI workflow module");

    const analysis = analyzeLeadForAutomation(lead);
    const output: ModuleRunOutput = {
      lead: leadSnapshot(lead),
      analysis,
      actionsTaken: [],
    };

    if (moduleId === "lead_intake_analysis") {
      lead.urgency = analysis.urgency;
      lead.lead_quality = analysis.leadQuality;
      lead.ai_status = "completed";
      lead.updated_at = new Date().toISOString();
      output.actionsTaken.push(
        `AI result: ${analysis.urgency} urgency and ${analysis.leadQuality} quality`,
        "Updated the internal CRM lead signal",
        "Logged the recommended next action"
      );
    }

    if (moduleId === "follow_up_drafting") {
      const followUp = draftFollowUp(lead, analysis);
      const communicationId = demoId();
      const createdAt = new Date().toISOString();
      state.communications.push({
        id: communicationId,
        lead_id: lead.id,
        contact_id: null,
        call_id: null,
        channel: followUp.channel,
        direction: "outbound",
        status: "draft",
        from_value: "Northstar Exterior & Home",
        to_value: followUp.channel === "email" ? lead.email : lead.phone,
        subject: followUp.subject,
        body: followUp.body,
        ai_summary: followUp.reason,
        suggested_next_action: "Review, edit if needed, then approve the simulated send.",
        ai_generated: true,
        human_approved: false,
        scheduled_send_at: null,
        automation_key: null,
        metadata: { source: "ai_automation_module", module_id: moduleId, risk_level: followUp.riskLevel },
        created_at: createdAt,
        updated_at: createdAt,
      });
      output.followUp = followUp;
      output.approvalCommunicationId = communicationId;
      output.actionsTaken.push(
        `Drafted ${followUp.channel.toUpperCase()} follow-up`,
        "Created approval item in Inbox",
        "No external message was sent"
      );
    }

    if (moduleId === "quote_prep") {
      const quotePrep = prepareQuoteChecklist(lead, analysis);
      output.quotePrep = quotePrep;
      output.quoteToolHref = `/app/quote-tool?lead=${lead.id}`;
      output.actionsTaken.push(
        `Prepared ${quotePrep.checklist.length} estimator checklist items`,
        "Linked the handoff to Quote Tool"
      );
    }

    if (moduleId === "manager_alert") {
      output.managerAlert = createManagerAlert(lead, analysis);
      output.actionsTaken.push(
        `Prepared ${output.managerAlert.priority}-priority manager alert`,
        `Reason: ${output.managerAlert.reason}`
      );
    }

    if (moduleId === "crm_update_suggestions") {
      output.crmSuggestions = suggestCrmUpdates(lead, analysis);
      output.actionsTaken.push(
        `Generated ${output.crmSuggestions.length} CRM update suggestions`,
        "No important CRM fields were changed without approval"
      );
    }

    if (moduleId === "external_webhook_sync") {
      output.webhookPayload = buildWebhookPreview(lead, analysis);
      output.actionsTaken.push(
        "Built Zapier/n8n-style webhook payload",
        "Dry-run only: no external system was contacted"
      );
    }

    const createdAt = new Date().toISOString();
    const runActions = [
      `Workflow: ${workflowModule.name}`,
      `Input: ${output.lead.name} - ${output.lead.serviceType} - ${output.lead.stage}`,
      ...output.actionsTaken,
    ];
    state.automationRuns.unshift({
      id: demoId(),
      rule_id: null,
      lead_id: lead.id,
      feedback_id: null,
      trigger_event: "manual_test",
      status: "success",
      actions_taken: runActions,
      error_message: null,
      created_at: createdAt,
    });
    state.activities.unshift({
      id: demoId(),
      lead_id: lead.id,
      user_id: null,
      type: "ai_automation",
      title: `AI workflow test: ${workflowModule.name}`,
      description: output.actionsTaken.join(" - "),
      metadata: { module_id: moduleId, runtime_mode: "demo" },
      created_at: createdAt,
    });
    return output;
  });
}
