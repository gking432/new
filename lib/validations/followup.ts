import { z } from "zod";

export const FOLLOWUP_TYPES = [
  "sms",
  "email",
  "call_script",
  "voicemail",
  "appointment_confirmation",
  "estimate_followup",
  "review_response",
] as const;

export const FOLLOWUP_TONES = [
  "professional",
  "friendly",
  "urgent",
  "reassuring",
  "concise",
] as const;

export const FOLLOWUP_GOALS = [
  "book_appointment",
  "confirm_details",
  "follow_up_estimate",
  "reengage_cold_lead",
  "handle_concern",
  "thank_customer",
] as const;

export const followupRequestSchema = z.object({
  lead_id: z.string().uuid(),
  type: z.enum(FOLLOWUP_TYPES),
  tone: z.enum(FOLLOWUP_TONES),
  goal: z.enum(FOLLOWUP_GOALS),
  notes: z.string().max(2000).optional().default(""),
});

export type FollowupRequest = z.infer<typeof followupRequestSchema>;
