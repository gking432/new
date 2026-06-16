import { z } from "zod";

export const CallSummarySchema = z.object({
  summary: z.string(),
  crm_note: z.string(),
  customer_intent: z.string(),
  service_type: z.enum([
    "roofing",
    "siding",
    "windows",
    "doors",
    "bath",
    "gutters",
    "leaf_protection",
    "storm_damage",
    "not_sure",
  ]),
  urgency: z.enum(["emergency", "high", "medium", "low"]),
  lead_quality: z.enum(["hot", "warm", "cold"]),
  next_action: z.string(),
  appointment_requested: z.boolean(),
  appointment_time: z.string().nullable(),
  objections: z.array(z.string()),
  extracted_fields: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip_code: z.string().nullable(),
    active_leak: z.string().nullable(),
    insurance_started: z.string().nullable(),
    roof_age: z.string().nullable(),
    siding_age: z.string().nullable(),
    last_painted: z.string().nullable(),
    preferred_contact_method: z.string().nullable(),
  }),
  recommended_tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      priority: z.enum(["urgent", "high", "medium", "low"]),
      due_in_minutes: z.number(),
    })
  ),
  confirmation_message_draft: z.string(),
});

export type CallSummaryOutput = z.infer<typeof CallSummarySchema>;

export const CALL_SUMMARY_SYSTEM_PROMPT = `You are an AI call intelligence assistant for a residential home improvement company.

Your job is to turn a customer phone conversation into clean CRM-ready notes, extracted fields, next actions, appointment details, task recommendations, and follow-up drafts.

The company offers roofing, siding, windows, doors, baths, gutters, leaf protection, and storm damage inspections.

Do not overpromise. Do not claim insurance approval. Do not provide a final quote. Do not imply that an inspection has happened if it has not.

Keep CRM notes short, clear, and useful for a sales rep or operations manager.

Separate full transcript from CRM notes. The transcript is for reference. The CRM note should only include what the team needs to act.

If the customer agreed to a specific appointment slot, set appointment_requested to true and put the agreed time (ISO 8601 with timezone offset if stated, otherwise a plain description) in appointment_time.

Respond with a single JSON object matching the schema you were given. No markdown, no commentary.`;

export function buildCallSummaryUserPrompt(args: {
  scenario: string;
  transcript: string;
  leadContext?: string;
  nowIso: string;
}) {
  return `Call scenario: ${args.scenario}
Current date/time: ${args.nowIso}
${args.leadContext ? `\nExisting CRM context for this caller:\n${args.leadContext}\n` : ""}
Full call transcript ("AI" is the company assistant, "Customer" is the caller):

${args.transcript}

Return JSON with these exact keys: summary, crm_note, customer_intent, service_type, urgency, lead_quality, next_action, appointment_requested, appointment_time, objections (array of strings), extracted_fields (object with first_name, last_name, email, phone, address, city, state, zip_code, active_leak, insurance_started, roof_age, siding_age, last_painted, preferred_contact_method — use null for anything not mentioned), recommended_tasks (array of {title, description, priority, due_in_minutes}), confirmation_message_draft (a short SMS-length confirmation the team could send after approval).`;
}
