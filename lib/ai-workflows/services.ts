import type {
  CrmUpdateSuggestion,
  FollowUpDraft,
  LeadAutomationAnalysis,
  ManagerAlert,
  QuotePrepPacket,
  WebhookPreview,
} from "./types";
import type { Lead, LeadQuality, ServiceType, Urgency } from "@/types/app";
import { SERVICE_LABELS, STAGE_STYLES } from "@/lib/utils/statuses";

const VALUE_RANGES: Record<ServiceType, string> = {
  roofing: "$12,000 - $28,000",
  siding: "$14,000 - $35,000",
  windows: "$8,000 - $24,000",
  doors: "$3,000 - $9,000",
  bath: "$10,000 - $26,000",
  gutters: "$1,800 - $6,500",
  leaf_protection: "$2,500 - $8,000",
  storm_damage: "$9,000 - $32,000",
  not_sure: "$3,000 - $15,000",
};

function textFor(lead: Lead) {
  return [
    lead.description,
    lead.project_reason,
    lead.timeframe,
    lead.active_leak,
    lead.insurance_started,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function detectUrgency(lead: Lead): Urgency {
  const text = textFor(lead);
  if (lead.active_leak === "yes" || /leak|water coming|emergency|ceiling|storm|hail|wind/.test(text)) {
    return "high";
  }
  if (/asap|soon|this week|urgent/.test(text)) return "high";
  if (/planning|researching|next year|not sure/.test(text)) return "low";
  return lead.urgency ?? "medium";
}

function detectQuality(lead: Lead, urgency: Urgency): LeadQuality {
  if (urgency === "high" || urgency === "emergency") return "hot";
  if (lead.budget_range === "30k_plus" || lead.budget_range === "15k_30k") return "hot";
  if (lead.timeframe === "not_sure" || lead.service_type === "not_sure") return "cold";
  return lead.lead_quality ?? "warm";
}

function missingInfoFor(lead: Lead) {
  const missing: string[] = [];
  if (!lead.phone) missing.push("Phone number");
  if (!lead.email) missing.push("Email address");
  if (!lead.street_address) missing.push("Property address");
  if (!lead.timeframe) missing.push("Project timing");
  if (!lead.budget_range) missing.push("Budget range");
  if (lead.service_type === "not_sure") missing.push("Confirmed service type");
  return missing;
}

export function analyzeLeadForAutomation(lead: Lead): LeadAutomationAnalysis {
  const urgency = detectUrgency(lead);
  const leadQuality = detectQuality(lead, urgency);
  const serviceLabel = SERVICE_LABELS[lead.service_type] ?? lead.service_type.replace(/_/g, " ");
  const missingInfo = missingInfoFor(lead);
  const isUrgent = urgency === "high" || urgency === "emergency";

  return {
    urgency,
    leadQuality,
    serviceDetected: lead.service_type,
    estimatedValueRange: VALUE_RANGES[lead.service_type],
    summary: `${lead.first_name} ${lead.last_name} is a ${leadQuality} ${serviceLabel.toLowerCase()} lead${
      lead.city ? ` in ${lead.city}` : ""
    }. ${isUrgent ? "The request has urgency signals and should be handled quickly." : "The request is workable but needs normal qualification."}`,
    recommendedNextAction: isUrgent
      ? "Call or text within 15 minutes, confirm active issue, and offer the soonest inspection window."
      : "Confirm project details, collect missing context, and move the lead toward an inspection.",
    missingInfo,
  };
}

export function draftFollowUp(lead: Lead, analysis: LeadAutomationAnalysis): FollowUpDraft {
  const serviceLabel = SERVICE_LABELS[lead.service_type] ?? "project";
  const channel = lead.preferred_contact_method === "email" ? "email" : "sms";
  const nextStep =
    analysis.urgency === "high" || analysis.urgency === "emergency"
      ? "take a quick look at the issue and get you an inspection window"
      : "confirm a few details and help you choose the right next step";

  if (channel === "email") {
    return {
      channel,
      subject: `Next step for your ${serviceLabel.toLowerCase()} request`,
      body: `Hi ${lead.first_name}, thanks for reaching out to Northstar about your ${serviceLabel.toLowerCase()} project. Based on what you shared, the best next step is for our team to ${nextStep}. What time today or tomorrow works best for a quick call?`,
      reason: "Email selected because the lead prefers email contact.",
      riskLevel: "medium",
    };
  }

  return {
    channel,
    subject: null,
    body: `Hi ${lead.first_name}, this is Northstar. Thanks for reaching out about your ${serviceLabel.toLowerCase()} project. We can ${nextStep}. What time today works for a quick call?`,
    reason: "SMS is the fastest approval-gated follow-up for this lead.",
    riskLevel: "medium",
  };
}

export function prepareQuoteChecklist(lead: Lead, analysis: LeadAutomationAnalysis): QuotePrepPacket {
  const serviceLabel = SERVICE_LABELS[lead.service_type] ?? "project";
  const activeLeak = analysis.urgency === "high" || analysis.urgency === "emergency";
  return {
    checklist: [
      `Verify the ${serviceLabel.toLowerCase()} scope before discussing price.`,
      "Confirm property address, access notes, and best on-site contact.",
      "Capture photos/measurements needed before producing a final quote.",
      activeLeak ? "Inspect active water-intrusion areas before normal sales questions." : "Ask what prompted the project now.",
    ],
    customerQuestions: [
      "What changed recently that made this project urgent?",
      "Have you received any prior estimates?",
      "Are there financing, insurance, HOA, or timing constraints?",
      "Who else needs to be involved in the final decision?",
    ],
    estimatorNotes: [
      `Estimated value range: ${analysis.estimatedValueRange}.`,
      `Lead quality: ${analysis.leadQuality}; urgency: ${analysis.urgency}.`,
      analysis.missingInfo.length
        ? `Missing info to collect: ${analysis.missingInfo.join(", ")}.`
        : "Core contact and project fields are complete.",
    ],
    suggestedFraming:
      "Position this as an inspection-first conversation. Give a ballpark only if clearly labeled internal/preliminary and avoid final pricing until measurements are confirmed.",
  };
}

export function createManagerAlert(lead: Lead, analysis: LeadAutomationAnalysis): ManagerAlert {
  const priority =
    analysis.urgency === "high" || analysis.urgency === "emergency"
      ? "urgent"
      : analysis.leadQuality === "hot"
        ? "high"
        : "medium";
  return {
    title: `${priority === "urgent" ? "Urgent" : "Review"}: ${lead.first_name} ${lead.last_name}`,
    summary: analysis.summary,
    reason:
      priority === "urgent"
        ? "Urgency signals indicate this should not wait in the normal queue."
        : "The lead has enough value or ambiguity to benefit from manager review.",
    recommendedAction: analysis.recommendedNextAction,
    priority,
  };
}

export function suggestCrmUpdates(lead: Lead, analysis: LeadAutomationAnalysis): CrmUpdateSuggestion[] {
  const suggestions: CrmUpdateSuggestion[] = [];
  if (lead.stage === "new" && (analysis.urgency === "high" || analysis.leadQuality === "hot")) {
    suggestions.push({
      title: "Suggest stage movement",
      description: "Lead has enough urgency to move from New to Contacted after the first outreach attempt.",
      suggestedStage: "contacted",
      suggestedTags: ["speed-to-lead"],
    });
  }
  if (analysis.missingInfo.length) {
    suggestions.push({
      title: "Collect missing CRM fields",
      description: `Missing fields: ${analysis.missingInfo.join(", ")}.`,
      suggestedTask: "Confirm missing project/contact details on next touch.",
      suggestedTags: ["data-cleanup"],
    });
  }
  suggestions.push({
    title: "Add source and service tags",
    description: `Tag as ${lead.source ?? "unknown source"} and ${
      SERVICE_LABELS[lead.service_type] ?? lead.service_type
    } for reporting.`,
    suggestedTags: [lead.source ?? "source-missing", lead.service_type],
  });
  return suggestions;
}

export function buildWebhookPreview(lead: Lead, analysis: LeadAutomationAnalysis): WebhookPreview {
  return {
    eventType: "lead.created",
    source: "northstar_demo_crm",
    payload: {
      id: lead.id,
      name: `${lead.first_name} ${lead.last_name}`,
      email: lead.email,
      phone: lead.phone,
      serviceType: lead.service_type,
      serviceLabel: SERVICE_LABELS[lead.service_type] ?? lead.service_type,
      stage: lead.stage,
      stageLabel: STAGE_STYLES[lead.stage]?.label ?? lead.stage,
      urgency: analysis.urgency,
      leadQuality: analysis.leadQuality,
      estimatedValueRange: analysis.estimatedValueRange,
      recommendedNextAction: analysis.recommendedNextAction,
      source: lead.source,
      city: lead.city,
      state: lead.state,
      createdAt: lead.created_at,
    },
  };
}
