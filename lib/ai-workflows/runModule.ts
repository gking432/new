import type { SupabaseClient } from "@supabase/supabase-js";
import { getAiWorkflowModule } from "./modules";
import {
  analyzeLeadForAutomation,
  buildWebhookPreview,
  createManagerAlert,
  draftFollowUp,
  prepareQuoteChecklist,
  suggestCrmUpdates,
} from "./services";
import type { AiWorkflowModuleId, ModuleRunOutput } from "./types";
import { leadSnapshot } from "./types";
import type { Lead, TaskPriority } from "@/types/app";

function parseValueRange(range: string) {
  const numbers = range.match(/\d[\d,]*/g)?.map((value) => Number(value.replace(/,/g, ""))) ?? [];
  return {
    min: numbers[0] ?? null,
    max: numbers[1] ?? null,
  };
}

function taskPriority(priority: string): TaskPriority {
  if (priority === "urgent" || priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }
  return "medium";
}

async function insertWorkflowRun(
  supabase: SupabaseClient,
  args: {
    moduleId: AiWorkflowModuleId;
    lead: Lead;
    output: ModuleRunOutput;
    status?: "success" | "failed" | "skipped";
    errorMessage?: string;
  }
) {
  const workflowModule = getAiWorkflowModule(args.moduleId);
  const actions = [
    `Workflow: ${workflowModule?.name ?? args.moduleId}`,
    `Input: ${args.output.lead.name} · ${args.output.lead.serviceType} · ${args.output.lead.stage}`,
    ...args.output.actionsTaken,
  ];

  await supabase.from("automation_runs").insert({
    rule_id: null,
    lead_id: args.lead.id,
    trigger_event: "manual_test",
    status: args.status ?? "success",
    actions_taken: actions,
    error_message: args.errorMessage ?? null,
  });
}

export async function runAiWorkflowModule(
  supabase: SupabaseClient,
  args: {
    moduleId: AiWorkflowModuleId;
    lead: Lead;
    userId: string | null;
  }
): Promise<ModuleRunOutput> {
  const workflowModule = getAiWorkflowModule(args.moduleId);
  if (!workflowModule) throw new Error("Unknown AI workflow module");

  const { lead, userId } = args;
  const analysis = analyzeLeadForAutomation(lead);
  const output: ModuleRunOutput = {
    lead: leadSnapshot(lead),
    analysis,
    actionsTaken: [],
  };

  if (args.moduleId === "lead_intake_analysis") {
    const values = parseValueRange(analysis.estimatedValueRange);
    await supabase.from("lead_ai_analyses").insert({
      lead_id: lead.id,
      summary: analysis.summary,
      urgency: analysis.urgency,
      urgency_reasoning: "Demo AI workflow detected urgency from lead text and project context.",
      lead_quality: analysis.leadQuality,
      lead_quality_reasoning: "Demo AI workflow combined urgency, service type, budget, and timing signals.",
      recommended_next_action: analysis.recommendedNextAction,
      recommended_contact_window:
        analysis.urgency === "high" || analysis.urgency === "emergency"
          ? "Within 15 minutes"
          : "Same business day",
      recommended_service_angle: `Lead asked about ${lead.service_type.replace(/_/g, " ")}.`,
      sales_questions: [
        "What prompted the project now?",
        "What outcome matters most to you?",
        "Who else should be part of the appointment?",
      ],
      potential_objections: ["Needs inspection before final quote", "May need scheduling flexibility"],
      tags: [analysis.leadQuality, analysis.urgency, lead.service_type],
      raw_output: analysis,
    });
    await supabase
      .from("leads")
      .update({
        urgency: analysis.urgency,
        lead_quality: analysis.leadQuality,
        estimated_value_min: values.min,
        estimated_value_max: values.max,
        ai_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);
    const { data: task } = await supabase
      .from("tasks")
      .insert({
        lead_id: lead.id,
        title:
          analysis.urgency === "high" || analysis.urgency === "emergency"
            ? "AI workflow: call urgent lead"
            : "AI workflow: qualify lead",
        description: analysis.recommendedNextAction,
        type: "call",
        priority:
          analysis.urgency === "high" || analysis.urgency === "emergency" ? "high" : "medium",
        status: "open",
        due_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    output.taskId = task?.id ?? undefined;
    output.actionsTaken.push(
      `AI result: ${analysis.urgency} urgency, ${analysis.leadQuality} quality, ${analysis.estimatedValueRange} estimated range`,
      "Saved CRM analysis record",
      "Created internal task suggestion"
    );
  }

  if (args.moduleId === "follow_up_drafting") {
    const followUp = draftFollowUp(lead, analysis);
    const { data: communication } = await supabase
      .from("communications")
      .insert({
        lead_id: lead.id,
        channel: followUp.channel,
        direction: "outbound",
        status: "draft",
        from_value: "Northstar Exterior & Home",
        to_value: followUp.channel === "email" ? lead.email : lead.phone,
        subject: followUp.subject,
        body: followUp.body,
        ai_summary: followUp.reason,
        suggested_next_action: "Review, edit if needed, then approve & send as a simulated message.",
        ai_generated: true,
        human_approved: false,
        metadata: {
          source: "ai_automation_module",
          module_id: args.moduleId,
          risk_level: followUp.riskLevel,
          demo_notice: "Draft only — no external message has been sent.",
        },
      })
      .select("id")
      .single();
    output.followUp = followUp;
    output.approvalCommunicationId = communication?.id ?? undefined;
    output.actionsTaken.push(
      `Drafted ${followUp.channel.toUpperCase()} follow-up`,
      "Created approval item in Inbox",
      "No external message was sent"
    );
  }

  if (args.moduleId === "quote_prep") {
    const quotePrep = prepareQuoteChecklist(lead, analysis);
    output.quotePrep = quotePrep;
    output.quoteToolHref = `/app/quote-tool?lead=${lead.id}`;
    output.actionsTaken.push(
      `Prepared ${quotePrep.checklist.length} estimator checklist items`,
      `Added ${quotePrep.customerQuestions.length} discovery questions`,
      "Linked handoff to Quote Tool"
    );
  }

  if (args.moduleId === "manager_alert") {
    const alert = createManagerAlert(lead, analysis);
    const { data: task } = await supabase
      .from("tasks")
      .insert({
        lead_id: lead.id,
        assigned_to: null,
        title: alert.title,
        description: `${alert.summary}\n\nRecommended action: ${alert.recommendedAction}`,
        type: "manager_review",
        priority: taskPriority(alert.priority),
        status: "open",
        due_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    output.managerAlert = alert;
    output.taskId = task?.id ?? undefined;
    output.actionsTaken.push(
      `Created ${alert.priority}-priority manager review task`,
      `Reason: ${alert.reason}`
    );
  }

  if (args.moduleId === "crm_update_suggestions") {
    const suggestions = suggestCrmUpdates(lead, analysis);
    output.crmSuggestions = suggestions;
    output.actionsTaken.push(
      `Generated ${suggestions.length} CRM update suggestion${suggestions.length === 1 ? "" : "s"}`,
      "No CRM fields were changed automatically"
    );
  }

  if (args.moduleId === "external_webhook_sync") {
    const webhookPayload = buildWebhookPreview(lead, analysis);
    output.webhookPayload = webhookPayload;
    output.actionsTaken.push(
      "Built Zapier/n8n-style webhook payload",
      "Dry-run only: no external system was contacted"
    );
  }

  await supabase.from("activities").insert({
    lead_id: lead.id,
    user_id: userId,
    type: "ai_automation",
    title: `AI workflow test: ${workflowModule.name}`,
    description: output.actionsTaken.join(" · "),
    metadata: {
      module_id: args.moduleId,
      output,
      runtime_mode: "demo",
    },
  });

  await insertWorkflowRun(supabase, {
    moduleId: args.moduleId,
    lead,
    output,
  });

  return output;
}
