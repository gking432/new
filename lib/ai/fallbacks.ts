import type { Lead } from "@/types/app";
import type {
  FeedbackAnalysisOutput,
  FollowupOutput,
  LeadAnalysisOutput,
} from "./schemas";
import { SERVICE_LABELS } from "@/lib/utils/statuses";

/**
 * Deterministic fallback analysis used when the AI provider is unavailable
 * or returns an invalid response. Lead creation must never fail because AI
 * failed, so these heuristics keep the workflow functional. Records produced
 * this way are marked ai_status = "failed" so the team knows it is a
 * rule-based estimate, not a model analysis.
 */

const SERVICE_VALUE_RANGES: Record<string, [number, number] | null> = {
  roofing: [9000, 18000],
  siding: [12000, 24000],
  windows: [8000, 22000],
  doors: [3000, 9000],
  bath: [14000, 28000],
  gutters: [1500, 4000],
  leaf_protection: [2500, 6500],
  storm_damage: [10000, 25000],
  not_sure: null,
};

const BUDGET_RANGES: Record<string, [number, number] | null> = {
  under_5k: [2000, 5000],
  "5k_15k": [5000, 15000],
  "15k_30k": [15000, 30000],
  "30k_plus": [30000, 50000],
  not_sure: null,
};

export function heuristicLeadAnalysis(lead: Lead): LeadAnalysisOutput {
  const hasLeak = lead.active_leak === "yes";
  const isStorm = lead.service_type === "storm_damage";
  const isUrgentReason = lead.project_reason === "leak_urgent";

  let urgency: LeadAnalysisOutput["urgency"] = "medium";
  if (hasLeak || lead.timeframe === "emergency") urgency = "emergency";
  else if (isStorm || isUrgentReason || lead.timeframe === "this_week") urgency = "high";
  else if (lead.timeframe === "researching") urgency = "low";

  const highBudget = lead.budget_range === "15k_30k" || lead.budget_range === "30k_plus";
  const strongSource = lead.source === "referral" || lead.source === "previous_customer";

  let quality: LeadAnalysisOutput["lead_quality"] = "warm";
  if (urgency === "emergency" || urgency === "high" || highBudget || strongSource) {
    quality = "hot";
  } else if (lead.timeframe === "researching" && lead.budget_range === "not_sure") {
    quality = "cold";
  }

  const valueRange =
    BUDGET_RANGES[lead.budget_range ?? "not_sure"] ??
    SERVICE_VALUE_RANGES[lead.service_type] ??
    null;

  const serviceLabel = SERVICE_LABELS[lead.service_type] ?? lead.service_type;
  const contactWindow =
    urgency === "emergency"
      ? "Within 15 minutes"
      : urgency === "high"
        ? "Within 1 hour"
        : urgency === "medium"
          ? "Same business day"
          : "Within 1–2 business days";

  const tasks: LeadAnalysisOutput["task_recommendations"] = [
    urgency === "emergency" || urgency === "high"
      ? {
          title: `Call ${lead.first_name} ${lead.last_name} about ${serviceLabel.toLowerCase()} request`,
          description: `Urgent inbound request. Confirm whether the issue is active, gather details, and offer an inspection within 24–48 hours.`,
          priority: "urgent" as const,
          due_in_minutes: 15,
        }
      : {
          title: `Call ${lead.first_name} ${lead.last_name} about ${serviceLabel.toLowerCase()} request`,
          description: `New inbound request. Confirm project details and offer an inspection appointment.`,
          priority: quality === "hot" ? ("high" as const) : ("medium" as const),
          due_in_minutes: urgency === "medium" ? 240 : 1440,
        },
  ];

  return {
    summary: `Homeowner submitted a ${serviceLabel.toLowerCase()} request. ${
      hasLeak ? "Reports active leaking, which makes this time-sensitive. " : ""
    }${lead.description.slice(0, 200)}${lead.description.length > 200 ? "…" : ""}`,
    urgency,
    urgency_reasoning: hasLeak
      ? "Homeowner reports active leaking; water intrusion can escalate quickly."
      : `Based on service type (${serviceLabel}) and stated timeframe (${lead.timeframe ?? "unspecified"}).`,
    lead_quality: quality,
    lead_quality_reasoning: highBudget
      ? "Stated budget supports a meaningful project value."
      : strongSource
        ? "Referral and repeat-customer leads historically convert well."
        : "Based on timeframe, budget signal, and source.",
    estimated_value_min: valueRange ? valueRange[0] : null,
    estimated_value_max: valueRange ? valueRange[1] : null,
    recommended_next_action:
      urgency === "emergency"
        ? "Call within 15 minutes. Confirm whether water intrusion is active and offer an inspection within 24–48 hours."
        : `Call ${contactWindow.toLowerCase()} to confirm project details and book an inspection.`,
    recommended_contact_window: contactWindow,
    sales_questions: [
      "When did the issue start, and has it gotten worse?",
      hasLeak || isStorm
        ? "Is water actively coming in right now?"
        : "What outcome are you hoping for with this project?",
      lead.insurance_started && lead.insurance_started !== "not_applicable"
        ? "Have you contacted your insurance company yet?"
        : "Is there a budget range you are working within?",
      "Are you available for an inspection within the next 24–48 hours?",
    ],
    potential_objections: [
      "Wants to gather multiple quotes before deciding",
      "Unsure about cost and financing options",
      "Scheduling availability during work hours",
    ],
    recommended_service_angle: isStorm
      ? "Lead with a free storm damage inspection and help documenting damage for a possible insurance claim. Do not promise claim approval."
      : `Lead with a free inspection and a clear written estimate for the ${serviceLabel.toLowerCase()} work.`,
    tags: [
      lead.service_type,
      ...(hasLeak ? ["active_leak"] : []),
      ...(highBudget ? ["high_value"] : []),
      ...(lead.source ? [lead.source] : []),
    ],
    task_recommendations: tasks,
  };
}

export function heuristicFollowup(
  lead: Lead,
  args: { type: FollowupOutput["type"]; tone: string; goal: string; notes?: string }
): FollowupOutput {
  const serviceLabel = (SERVICE_LABELS[lead.service_type] ?? lead.service_type).toLowerCase();
  const company = process.env.DEMO_COMPANY_NAME || "Northstar Exterior & Home";

  const smsBody = `Hi ${lead.first_name}, this is ${company}. We received your ${serviceLabel} request and would like to schedule a free inspection. Do you have availability today or tomorrow? Reply with a time that works and we'll confirm.`;

  const emailBody = `Hi ${lead.first_name},

Thank you for reaching out to ${company} about your ${serviceLabel} project. We reviewed your request and the next step is a quick on-site inspection so we can give you a clear, written estimate.

Would today or tomorrow work for a visit? Reply to this email or call us and we will lock in a time.

Thank you,
${company}`;

  switch (args.type) {
    case "email":
    case "estimate_followup":
    case "appointment_confirmation":
      return {
        type: args.type,
        subject:
          args.type === "estimate_followup"
            ? `Following up on your ${serviceLabel} estimate`
            : args.type === "appointment_confirmation"
              ? `Your inspection appointment with ${company}`
              : `Your ${serviceLabel} request — next steps`,
        body: emailBody,
        call_opening: null,
        discovery_questions: [],
        talking_points: [],
        closing_line: "Reply to this email or give us a call and we will get you scheduled.",
        internal_note:
          "Template draft generated without AI. Review and personalize before sending.",
      };
    case "call_script":
      return {
        type: "call_script",
        subject: null,
        body: `Call script for ${lead.first_name} ${lead.last_name} — ${serviceLabel} request.`,
        call_opening: `Hi ${lead.first_name}, this is [your name] with ${company}. You sent us a note about your ${serviceLabel} project and I wanted to follow up while it's fresh.`,
        discovery_questions: [
          "Can you walk me through what you're seeing?",
          "When did you first notice the issue?",
          "Is anything actively leaking or getting worse?",
          "Have you worked with a contractor on this before?",
        ],
        talking_points: [
          "Free inspection with a clear written estimate — no obligation.",
          "Licensed and insured local crew.",
          "We can usually inspect within 24–48 hours.",
        ],
        closing_line:
          "I have openings tomorrow morning and afternoon — which works better for you?",
        internal_note:
          "Template draft generated without AI. Review and personalize before the call.",
      };
    case "voicemail":
      return {
        type: "voicemail",
        subject: null,
        body: `Hi ${lead.first_name}, this is [your name] with ${company}. We got your note about your ${serviceLabel} project and would love to get an inspection scheduled. Give us a call back at your convenience — we'll keep an eye out for your call. Thanks!`,
        call_opening: null,
        discovery_questions: [],
        talking_points: [],
        closing_line: null,
        internal_note: "Template draft generated without AI. Review before use.",
      };
    case "review_response":
      return {
        type: "review_response",
        subject: null,
        body: `Thank you for taking the time to share this feedback. We take it seriously and would like to make it right — please reach out to us directly so we can talk through what happened and the next step.`,
        call_opening: null,
        discovery_questions: [],
        talking_points: [],
        closing_line: null,
        internal_note: "Template draft generated without AI. Review before posting.",
      };
    default:
      return {
        type: "sms",
        subject: null,
        body: smsBody,
        call_opening: null,
        discovery_questions: [],
        talking_points: [],
        closing_line: null,
        internal_note:
          "Template draft generated without AI. Review and personalize before sending.",
      };
  }
}

const NEGATIVE_HINTS = [
  "frustrat",
  "disappoint",
  "late",
  "never",
  "rude",
  "delay",
  "wrong",
  "bad",
  "terrible",
  "awful",
  "had to call",
  "no one",
  "pushed back",
  "problem",
];

const POSITIVE_HINTS = [
  "great",
  "professional",
  "excellent",
  "amazing",
  "clean",
  "on time",
  "recommend",
  "happy",
  "wonderful",
  "looks good",
  "looks great",
  "informed",
];

export function heuristicFeedbackAnalysis(input: {
  feedback_text: string;
  rating?: number | null;
}): FeedbackAnalysisOutput {
  const text = input.feedback_text.toLowerCase();
  const negatives = NEGATIVE_HINTS.filter((hint) => text.includes(hint));
  const positives = POSITIVE_HINTS.filter((hint) => text.includes(hint));

  let sentiment: FeedbackAnalysisOutput["sentiment"] = "neutral";
  if (input.rating != null) {
    if (input.rating <= 2) sentiment = "negative";
    else if (input.rating >= 4 && negatives.length === 0) sentiment = "positive";
    else if (negatives.length > 0 && positives.length > 0) sentiment = "mixed";
    else if (input.rating >= 4) sentiment = "mixed";
  } else if (negatives.length > 0 && positives.length > 0) {
    sentiment = "mixed";
  } else if (negatives.length > positives.length) {
    sentiment = "negative";
  } else if (positives.length > 0) {
    sentiment = "positive";
  }

  const category: FeedbackAnalysisOutput["operational_category"] =
    text.includes("call") || text.includes("communicat") || text.includes("inform")
      ? "communication"
      : text.includes("schedul") || text.includes("appointment") || text.includes("pushed back")
        ? "scheduling"
        : text.includes("clean")
          ? "cleanup"
          : text.includes("price") || text.includes("cost") || text.includes("estimate")
            ? "pricing"
            : text.includes("crew") || text.includes("install")
              ? "crew_quality"
              : "unknown";

  const riskLevel: FeedbackAnalysisOutput["risk_level"] =
    sentiment === "negative" ? "high" : sentiment === "mixed" ? "medium" : "low";

  return {
    sentiment,
    risk_level: riskLevel,
    summary: `Customer feedback ${
      input.rating != null ? `with a ${input.rating}-star rating ` : ""
    }classified as ${sentiment} by keyword heuristics. Review the full text for nuance.`,
    key_praise: positives.length > 0 ? ["Customer used positive language about the work or crew"] : [],
    key_complaints:
      negatives.length > 0 ? ["Customer used language suggesting friction or frustration"] : [],
    operational_category: category,
    suggested_internal_action:
      sentiment === "negative"
        ? "Have a manager review this feedback and contact the customer within one business day."
        : sentiment === "mixed"
          ? "Review the complaint portion and decide whether outreach is needed."
          : "Log the feedback. Consider requesting a public review if appropriate.",
    suggested_customer_response:
      sentiment === "negative" || sentiment === "mixed"
        ? "Thank you for the honest feedback. We're sorry the experience wasn't smooth — a manager will reach out directly to talk through what happened."
        : "Thank you for the kind words — we'll share this with the crew. We appreciate you trusting us with your home.",
    marketing_quote_opportunity:
      sentiment === "positive" ? "Possible testimonial — confirm permission before use." : null,
    tags: [sentiment, category],
  };
}
