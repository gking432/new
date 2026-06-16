import type { Lead, TranscriptTurn } from "@/types/app";
import { customerServiceLabel } from "@/lib/utils/statuses";
import { callStructuredAI, isAIConfigured } from "./client";
import {
  CALL_SUMMARY_SYSTEM_PROMPT,
  CallSummarySchema,
  buildCallSummaryUserPrompt,
  type CallSummaryOutput,
} from "./callSchemas";

export interface SummarizeCallArgs {
  scenario: string;
  transcript: string;
  transcriptTurns?: TranscriptTurn[];
  lead?: Lead | null;
  /**
   * Known structured facts about the call (from a scripted scenario or live
   * field extraction). Used to seed the deterministic fallback and given to
   * the AI as ground truth.
   */
  seedFields?: Partial<CallSummaryOutput["extracted_fields"]> & {
    service_type?: string;
    urgency?: string;
    appointment_time?: string | null;
    summary_hint?: string;
  };
}

export interface SummarizeCallResult {
  summary: CallSummaryOutput;
  aiStatus: "completed" | "fallback";
}

function leadContext(lead: Lead) {
  return JSON.stringify(
    {
      name: `${lead.first_name} ${lead.last_name}`,
      phone: lead.phone,
      email: lead.email,
      address: [lead.street_address, lead.city, lead.state].filter(Boolean).join(", "),
      service_type: lead.service_type,
      stage: lead.stage,
      urgency: lead.urgency,
      lead_quality: lead.lead_quality,
      description: lead.description,
      active_leak: lead.active_leak,
      insurance_started: lead.insurance_started,
    },
    null,
    2
  );
}

const SERVICE_KEYWORDS: [string, string[]][] = [
  ["storm_damage", ["hail", "storm", "wind damage", "missing shingle", "tree limb", "tarp"]],
  ["roofing", ["roof", "shingle", "leak in the ceiling"]],
  ["siding", ["siding", "fiber cement", "cedar"]],
  ["windows", ["window", "drafty", "fogged glass", "failed seal"]],
  ["doors", ["door", "slider", "entry"]],
  ["bath", ["bath", "shower", "tub", "walk-in"]],
  ["gutters", ["gutter", "downspout"]],
  ["leaf_protection", ["leaf protection", "gutter guard"]],
];

/**
 * Deterministic call summary used when AI is unavailable (and for scripted
 * demo calls). Builds a believable, clearly labeled rule-based summary from
 * the transcript text and any known fields.
 */
export function heuristicCallSummary(args: SummarizeCallArgs): CallSummaryOutput {
  const text = args.transcript.toLowerCase();
  const seed = args.seedFields ?? {};
  const lead = args.lead ?? null;

  let serviceType = seed.service_type ?? lead?.service_type ?? "not_sure";
  if (serviceType === "not_sure") {
    for (const [service, words] of SERVICE_KEYWORDS) {
      if (words.some((w) => text.includes(w))) {
        serviceType = service;
        break;
      }
    }
  }

  const mentionsLeak =
    seed.active_leak === "yes" ||
    /water (spot|stain|coming in|is dripping|dripping)|active leak|leaking/.test(text);
  const mentionsStorm = /hail|storm|wind/.test(text);
  const urgency = (seed.urgency ??
    (mentionsLeak ? "emergency" : mentionsStorm ? "high" : "medium")) as CallSummaryOutput["urgency"];

  const wantsAppointment =
    Boolean(seed.appointment_time) ||
    /tomorrow|appointment|schedule|inspection|works for me|that works/.test(text);
  const appointmentTime = seed.appointment_time ?? null;

  const firstName = seed.first_name ?? lead?.first_name ?? null;
  const lastName = seed.last_name ?? lead?.last_name ?? null;
  const callerName = [firstName, lastName].filter(Boolean).join(" ") || "The caller";

  const issue =
    seed.summary_hint ??
    (mentionsStorm
      ? "reported recent storm damage"
      : `asked about a ${customerServiceLabel(serviceType).toLowerCase()} project`);

  const summary = `${callerName} ${issue}${mentionsLeak ? " with active water intrusion" : ""}.${
    appointmentTime
      ? ` An inspection was tentatively set for ${appointmentTime}.`
      : wantsAppointment
        ? " They are open to scheduling an inspection."
        : ""
  } ${
    seed.insurance_started === "no"
      ? "No insurance claim has been started yet."
      : seed.insurance_started === "yes"
        ? "An insurance claim is already in motion."
        : ""
  }`.trim();

  const nextAction = appointmentTime
    ? "Review and send the appointment confirmation, then prep the inspector with the call notes."
    : wantsAppointment
      ? "Choose the inspection slot discussed on the call, send the confirmation, and prep the inspector with the notes."
      : mentionsLeak
        ? "Prioritize this active leak, verify the homeowner is safe, and book the soonest inspection."
        : "Follow up the same business day to answer questions and book an inspection.";

  return {
    summary,
    crm_note: `${summary} Recommended next step: ${nextAction}`,
    customer_intent: wantsAppointment
      ? "Wants an inspection scheduled"
      : "Gathering information about the project",
    service_type: serviceType as CallSummaryOutput["service_type"],
    urgency,
    lead_quality: urgency === "emergency" || urgency === "high" ? "hot" : "warm",
    next_action: nextAction,
    appointment_requested: wantsAppointment,
    appointment_time: appointmentTime,
    objections: /price|cost|expensive|other quotes/.test(text)
      ? ["Wants to understand pricing before committing"]
      : [],
    extracted_fields: {
      first_name: firstName,
      last_name: lastName,
      email: seed.email ?? lead?.email ?? null,
      phone: seed.phone ?? lead?.phone ?? null,
      address: seed.address ?? lead?.street_address ?? null,
      city: seed.city ?? lead?.city ?? null,
      state: seed.state ?? lead?.state ?? null,
      zip_code: seed.zip_code ?? lead?.zip_code ?? null,
      active_leak: seed.active_leak ?? (mentionsLeak ? "yes" : null),
      insurance_started: seed.insurance_started ?? null,
      roof_age: seed.roof_age ?? null,
      siding_age: seed.siding_age ?? null,
      last_painted: seed.last_painted ?? null,
      preferred_contact_method: seed.preferred_contact_method ?? null,
    },
    recommended_tasks: [
      {
        title: appointmentTime
          ? "Review and send appointment confirmation"
          : wantsAppointment
            ? `Choose inspection slot for ${callerName}`
            : mentionsLeak
              ? `Prioritize active leak for ${callerName}`
              : `Follow up with ${callerName} after AI call`,
        description: nextAction,
        priority: appointmentTime ? "high" : urgency === "emergency" ? "urgent" : urgency === "high" ? "high" : "medium",
        due_in_minutes: appointmentTime ? 5 : urgency === "emergency" ? 30 : urgency === "high" ? 60 : 240,
      },
    ],
    confirmation_message_draft: `Hi${firstName ? ` ${firstName}` : ""}, this is Northstar Exterior & Home.${
      appointmentTime
        ? ` Your appointment is confirmed for ${appointmentTime}. If you need to reschedule, reply to this message.`
        : " We have your request on file. Reply here if anything changes."
    }`,
  };
}

/**
 * Summarizes a finished call. Uses the AI provider when configured; otherwise
 * (or on failure) falls back to the deterministic heuristic so the demo
 * pipeline always completes.
 */
export async function summarizeCall(args: SummarizeCallArgs): Promise<SummarizeCallResult> {
  if (isAIConfigured() && args.transcript.trim().length > 40) {
    try {
      const summary = await callStructuredAI({
        system: CALL_SUMMARY_SYSTEM_PROMPT,
        user: buildCallSummaryUserPrompt({
          scenario: args.scenario,
          transcript: args.transcript,
          leadContext: args.lead ? leadContext(args.lead) : undefined,
          nowIso: new Date().toISOString(),
        }),
        schema: CallSummarySchema,
        maxTokens: 2000,
      });
      return { summary, aiStatus: "completed" };
    } catch (error) {
      console.error("AI call summary failed, using fallback:", error);
    }
  }
  return { summary: heuristicCallSummary(args), aiStatus: "fallback" };
}
