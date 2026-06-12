import { z } from "zod";

export const SERVICE_TYPES = [
  "roofing",
  "siding",
  "windows",
  "doors",
  "bath",
  "gutters",
  "leaf_protection",
  "storm_damage",
  "not_sure",
] as const;

export const PROJECT_REASONS = [
  "damage_repair",
  "replacement",
  "upgrade",
  "leak_urgent",
  "insurance_claim",
  "maintenance",
  "other",
] as const;

export const TIMEFRAMES = [
  "emergency",
  "this_week",
  "this_month",
  "1_3_months",
  "researching",
] as const;

export const BUDGET_RANGES = [
  "under_5k",
  "5k_15k",
  "15k_30k",
  "30k_plus",
  "not_sure",
] as const;

export const LEAD_SOURCES = [
  "google",
  "facebook",
  "referral",
  "yard_sign",
  "previous_customer",
  "event",
  "other",
] as const;

export const leadFormSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Enter a valid email").max(200),
  phone: z.string().min(7, "Enter a valid phone number").max(30),
  preferred_contact_method: z.enum(["phone", "text", "email"]),
  best_time_to_contact: z.enum(["morning", "afternoon", "evening", "anytime"]),

  street_address: z.string().min(1, "Street address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(2, "State is required").max(50),
  zip_code: z.string().min(5, "ZIP code is required").max(10),
  homeowner_status: z.enum(["owner", "buyer_under_contract", "property_manager", "other"]),

  service_type: z.enum(SERVICE_TYPES),
  project_reason: z.enum(PROJECT_REASONS),
  timeframe: z.enum(TIMEFRAMES),
  budget_range: z.enum(BUDGET_RANGES),

  description: z
    .string()
    .min(10, "Tell us a little more about what is going on (at least 10 characters)")
    .max(4000),

  insurance_started: z.enum(["yes", "no", "not_sure", "not_applicable"]).optional(),
  active_leak: z.enum(["yes", "no", "not_sure"]).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const leadStageSchema = z.enum([
  "new",
  "contacted",
  "appointment_scheduled",
  "estimate_sent",
  "follow_up_needed",
  "won",
  "lost",
]);
