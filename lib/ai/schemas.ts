import { z } from "zod";

export const LeadAnalysisSchema = z.object({
  summary: z.string(),
  urgency: z.enum(["emergency", "high", "medium", "low"]),
  urgency_reasoning: z.string(),
  lead_quality: z.enum(["hot", "warm", "cold"]),
  lead_quality_reasoning: z.string(),
  estimated_value_min: z.number().nullable(),
  estimated_value_max: z.number().nullable(),
  recommended_next_action: z.string(),
  recommended_contact_window: z.string(),
  sales_questions: z.array(z.string()),
  potential_objections: z.array(z.string()),
  recommended_service_angle: z.string(),
  tags: z.array(z.string()),
  task_recommendations: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      priority: z.enum(["urgent", "high", "medium", "low"]),
      due_in_minutes: z.number(),
    })
  ),
});

export type LeadAnalysisOutput = z.infer<typeof LeadAnalysisSchema>;

export const FollowupSchema = z.object({
  type: z.enum([
    "sms",
    "email",
    "call_script",
    "voicemail",
    "appointment_confirmation",
    "estimate_followup",
    "review_response",
  ]),
  subject: z.string().nullable(),
  body: z.string(),
  call_opening: z.string().nullable(),
  discovery_questions: z.array(z.string()),
  talking_points: z.array(z.string()),
  closing_line: z.string().nullable(),
  internal_note: z.string(),
});

export type FollowupOutput = z.infer<typeof FollowupSchema>;

export const FeedbackAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  risk_level: z.enum(["low", "medium", "high", "urgent"]),
  summary: z.string(),
  key_praise: z.array(z.string()),
  key_complaints: z.array(z.string()),
  operational_category: z.enum([
    "communication",
    "scheduling",
    "crew_quality",
    "cleanup",
    "pricing",
    "sales_experience",
    "installation_quality",
    "warranty",
    "unknown",
  ]),
  suggested_internal_action: z.string(),
  suggested_customer_response: z.string(),
  marketing_quote_opportunity: z.string().nullable(),
  tags: z.array(z.string()),
});

export type FeedbackAnalysisOutput = z.infer<typeof FeedbackAnalysisSchema>;
