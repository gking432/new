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

const optionalText = (max: number) =>
  z
    .union([z.string().trim().min(1).max(max), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : null));

const optionalEmail = z
  .union([
    z.string().trim().email("Enter a valid email").max(200),
    z.literal(""),
    z.null(),
    z.undefined(),
  ])
  .transform((value) => (value ? value : null));

export const leadFormSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: optionalEmail,
  phone: z.string().min(7, "Enter a valid phone number").max(30),
  preferred_contact_method: z.enum(["phone", "text", "email"]).default("phone"),
  best_time_to_contact: z.enum(["morning", "afternoon", "evening", "anytime"]).default("anytime"),

  street_address: optionalText(200),
  city: optionalText(100),
  state: z.string().min(2, "State is required").max(50).default("WI"),
  zip_code: optionalText(10),
  homeowner_status: z.enum(["owner", "buyer_under_contract", "property_manager", "other"]).default("owner"),

  service_type: z.enum(SERVICE_TYPES).default("not_sure"),
  project_reason: z.enum(PROJECT_REASONS).default("damage_repair"),
  timeframe: z.enum(TIMEFRAMES),
  budget_range: z.enum(BUDGET_RANGES).default("not_sure"),

  description: z
    .string()
    .max(4000)
    .optional()
    .default(""),

  insurance_started: z.enum(["yes", "no", "not_sure", "not_applicable"]).default("not_sure"),
  active_leak: z.enum(["yes", "no", "not_sure"]).default("not_sure"),
  source: z.enum(LEAD_SOURCES).default("other"),
});

export type LeadFormInput = z.input<typeof leadFormSchema>;
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
