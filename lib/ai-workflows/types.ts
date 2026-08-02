import type { Lead, LeadQuality, ServiceType, Urgency } from "@/types/app";

export type AiWorkflowModuleId =
  | "lead_intake_analysis"
  | "follow_up_drafting"
  | "quote_prep"
  | "manager_alert"
  | "crm_update_suggestions"
  | "external_webhook_sync";

export type WorkflowModuleStatus = "active" | "draft" | "disabled";
export type WorkflowDestination =
  | "internal_crm"
  | "approval_queue"
  | "quote_tool"
  | "external_webhook"
  | "docs_only";

export interface AiWorkflowModule {
  id: AiWorkflowModuleId;
  name: string;
  description: string;
  status: WorkflowModuleStatus;
  trigger: string;
  output: string;
  approval: string;
  destination: WorkflowDestination;
  destinationLabel: string;
  runTestLabel?: string;
}

export interface AutomationLeadSnapshot {
  id: string;
  name: string;
  serviceType: ServiceType;
  stage: string;
  urgency: Urgency;
  leadQuality: LeadQuality;
  source: string | null;
  city: string | null;
  state: string | null;
  description: string;
}

export interface LeadAutomationAnalysis {
  urgency: Urgency;
  leadQuality: LeadQuality;
  serviceDetected: ServiceType;
  estimatedValueRange: string;
  summary: string;
  recommendedNextAction: string;
  missingInfo: string[];
}

export interface FollowUpDraft {
  channel: "sms" | "email";
  subject: string | null;
  body: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
}

export interface QuotePrepPacket {
  checklist: string[];
  customerQuestions: string[];
  estimatorNotes: string[];
  suggestedFraming: string;
}

export interface ManagerAlert {
  title: string;
  summary: string;
  reason: string;
  recommendedAction: string;
  priority: "urgent" | "high" | "medium";
}

export interface CrmUpdateSuggestion {
  title: string;
  description: string;
  suggestedStage?: string;
  suggestedTask?: string;
  suggestedTags: string[];
}

export interface WebhookPreview {
  eventType: "lead.created";
  source: "northstar_demo_crm";
  payload: Record<string, unknown>;
}

export interface ModuleRunOutput {
  lead: AutomationLeadSnapshot;
  analysis?: LeadAutomationAnalysis;
  followUp?: FollowUpDraft;
  quotePrep?: QuotePrepPacket;
  managerAlert?: ManagerAlert;
  crmSuggestions?: CrmUpdateSuggestion[];
  webhookPayload?: WebhookPreview;
  approvalCommunicationId?: string;
  taskId?: string;
  quoteToolHref?: string;
  actionsTaken: string[];
}

export function leadName(lead: Pick<Lead, "first_name" | "last_name">) {
  return `${lead.first_name} ${lead.last_name}`.trim();
}

export function leadSnapshot(lead: Lead): AutomationLeadSnapshot {
  return {
    id: lead.id,
    name: leadName(lead),
    serviceType: lead.service_type,
    stage: lead.stage,
    urgency: lead.urgency,
    leadQuality: lead.lead_quality,
    source: lead.source,
    city: lead.city,
    state: lead.state,
    description: lead.description,
  };
}
