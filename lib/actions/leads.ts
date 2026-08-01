"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeAndSaveLead } from "@/lib/ai/analyzeLead";
import { scheduleAppointmentReminders } from "@/lib/communications/reminders";
import { slotLabel } from "@/lib/integrations/calendar/internalCalendar";
import { createClient } from "@/lib/supabase/server";
import { customerServiceLabel } from "@/lib/utils/statuses";
import type { Lead } from "@/types/app";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

// No-login demo: there's no authenticated user. Attribute writes to the first
// seeded profile if one exists, otherwise leave the (nullable) user columns
// null. Kept named requireUser so existing call sites are unchanged.
async function requireUser(supabase: SupabaseClient): Promise<{ id: string | null }> {
  const { data } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
  return { id: ((data as { id?: string } | null)?.id as string | null) ?? null };
}

const leadInputSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().max(100).optional().default(""),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  street_address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zip_code: z.string().max(10).optional().nullable(),
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
  description: z.string().max(4000).optional().default(""),
  timeframe: z.string().max(40).optional().nullable(),
  active_leak: z.string().max(20).optional().nullable(),
  insurance_started: z.string().max(20).optional().nullable(),
  preferred_contact_method: z.enum(["phone", "text", "email"]).optional().nullable(),
  source: z.string().max(40).optional().nullable(),
  source_call_id: z.string().uuid().optional().nullable(),
  appointment_start_time: z.string().optional().nullable(),
  secondary_contact_name: z.string().max(160).optional().nullable(),
  secondary_contact_relationship: z.string().max(80).optional().nullable(),
  secondary_contact_phone: z.string().max(40).optional().nullable(),
  secondary_contact_email: z.string().max(200).optional().nullable(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

function safeGreetingName(firstName: string | null | undefined) {
  const cleaned = firstName?.trim();
  if (!cleaned || /^(new|unknown|caller|homeowner|customer)$/i.test(cleaned)) return "there";
  return cleaned;
}

function confirmationBody(firstName: string | null | undefined, startTime: string) {
  return `Hi ${safeGreetingName(firstName)}, your appointment is confirmed for ${slotLabel(
    new Date(startTime)
  )}. If you need to reschedule, reply to this message.`;
}

const supabaseConnectionError =
  "Could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and that the Supabase project is active.";

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    return `${error.message} ${cause ? errorText(cause) : ""}`;
  }
  return typeof error === "string" ? error : "";
}

function isSupabaseConnectionError(error: unknown) {
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(errorText(error));
}

/**
 * Manually creates a lead from the in-dashboard CRM form (walk-ins, phone
 * notes, or AI downtime). Runs AI analysis like any other lead.
 */
export async function createLead(input: LeadInput): Promise<ActionResult<{ leadId: string }>> {
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const {
      secondary_contact_name,
      secondary_contact_relationship,
      secondary_contact_phone,
      secondary_contact_email,
      source_call_id,
      appointment_start_time,
      ...leadData
    } = parsed.data;
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        ...leadData,
        last_name: leadData.last_name || "",
        stage: "new",
        source: source_call_id ? "phone_call" : (leadData.source ?? "manual"),
        ai_status: "pending",
        assigned_to: user.id,
      })
      .select("*")
      .single();
    if (error || !lead) return { success: false, error: error?.message ?? "Could not create lead" };

    const secondaryName = secondary_contact_name?.trim();
    if (
      secondaryName ||
      secondary_contact_phone?.trim() ||
      secondary_contact_email?.trim()
    ) {
      const [secondaryFirst = "", ...secondaryRest] = (secondaryName ?? "").split(/\s+/);
      await supabase.from("contacts").insert({
        first_name: secondaryFirst || null,
        last_name: secondaryRest.join(" ") || null,
        phone: secondary_contact_phone || null,
        email: secondary_contact_email || null,
        external_crm_provider: "northstar_secondary_contact",
        external_crm_id: lead.id,
      });
      await supabase.from("activities").insert({
        lead_id: lead.id,
        user_id: user.id,
        type: "note",
        title: "Secondary contact added",
        description: [
          secondaryName,
          secondary_contact_relationship
            ? `Relationship: ${secondary_contact_relationship}`
            : null,
          secondary_contact_phone,
          secondary_contact_email,
        ]
          .filter(Boolean)
          .join(" · "),
      });

      if (secondary_contact_phone || secondary_contact_email) {
        await supabase.from("tasks").insert({
          lead_id: lead.id,
          title: "Review and send secondary contact update",
          description:
            "The lead includes a spouse or secondary contact. Review the AI-drafted update before sending it.",
          type: secondary_contact_phone ? "sms" : "email",
          priority: "medium",
          status: "open",
          due_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        });
        await supabase.from("communications").insert({
          lead_id: lead.id,
          channel: secondary_contact_phone ? "sms" : "email",
          direction: "outbound",
          status: "draft",
          from_value: "Northstar Exterior & Home",
          to_value: secondary_contact_phone ?? secondary_contact_email ?? null,
          subject: "Inspection update",
          body: `Hi${secondaryFirst ? ` ${secondaryFirst}` : ""}, this is Northstar Exterior & Home. ${lead.first_name} listed you as a secondary contact for the inspection. We will keep you in the loop if anything changes.`,
          ai_generated: true,
          human_approved: false,
          metadata: { demo_action: "secondary_contact_update" },
        });
      }
    }

    if (source_call_id) {
      const fullName = `${lead.first_name} ${lead.last_name}`.trim();
      await supabase
        .from("calls")
        .update({
          lead_id: lead.id,
          caller_name: fullName || lead.first_name,
          caller_phone: lead.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", source_call_id);
      await supabase.from("call_summaries").update({ lead_id: lead.id }).eq("call_id", source_call_id);
    }

    await supabase.from("activities").insert({
      lead_id: lead.id,
      user_id: user.id,
      type: "lead_created",
      title:
        source_call_id || leadData.source === "phone_call"
          ? "Lead saved from rep-assisted phone call"
          : "Lead created manually",
      description: source_call_id || leadData.source === "phone_call"
        ? "The sales rep reviewed the AI-filled intake form and saved it to the CRM."
        : "Entered directly in the CRM.",
      metadata: source_call_id ? { call_id: source_call_id } : undefined,
    });

    let leadForAnalysis = lead as Lead;
    const appointmentStart = appointment_start_time ? new Date(appointment_start_time) : null;
    if (appointmentStart && !Number.isNaN(appointmentStart.getTime())) {
      const end = new Date(appointmentStart.getTime() + 60 * 60_000);
      const appointmentLabel = slotLabel(appointmentStart);
      const { data: appointment } = await supabase
        .from("appointments")
        .insert({
          lead_id: lead.id,
          title: `${customerServiceLabel(lead.service_type).toLowerCase()} inspection — ${lead.first_name} ${lead.last_name}`,
          appointment_type: "inspection",
          start_time: appointmentStart.toISOString(),
          end_time: end.toISOString(),
          status: "scheduled",
          location: [lead.street_address, lead.city].filter(Boolean).join(", ") || null,
          source: source_call_id || leadData.source === "phone_call" ? "ai_call" : "manual",
        })
        .select("id, start_time")
        .single();

      if (appointment) {
        await supabase
          .from("leads")
          .update({
            stage: "appointment_scheduled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id);
        leadForAnalysis = {
          ...(lead as Lead),
          stage: "appointment_scheduled",
          updated_at: new Date().toISOString(),
        } as Lead;
        await supabase.from("activities").insert({
          lead_id: lead.id,
          user_id: user.id,
          type: "appointment",
          title: source_call_id || leadData.source === "phone_call"
            ? `Inspection booked from rep-assisted call: ${appointmentLabel}`
            : `Inspection booked manually: ${appointmentLabel}`,
          metadata: {
            call_id: source_call_id,
            appointment_id: appointment.id,
          },
        });
        await scheduleAppointmentReminders(supabase, {
          lead: {
            id: lead.id,
            first_name: lead.first_name,
            service_type: lead.service_type,
            phone: lead.phone,
          },
          appointmentId: appointment.id,
          startTime: appointment.start_time,
          source: source_call_id || leadData.source === "phone_call" ? "ai_call" : "manual",
        });
        await supabase.from("tasks").insert({
          lead_id: lead.id,
          title: "Review and send appointment confirmation",
          description: `Review the AI-drafted SMS confirming ${lead.first_name}'s inspection for ${appointmentLabel}, then send it from the Approval Queue.`,
          type: "sms",
          priority: lead.active_leak === "yes" ? "high" : "medium",
          status: "open",
          due_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        });
        await supabase.from("communications").insert({
          lead_id: lead.id,
          call_id: source_call_id ?? null,
          channel: lead.phone ? "sms" : "email",
          direction: "outbound",
          status: "draft",
          from_value: "Northstar Exterior & Home",
          to_value: lead.phone ?? lead.email ?? null,
          subject: "Appointment confirmation",
          body: confirmationBody(lead.first_name, appointment.start_time),
          ai_generated: true,
          human_approved: false,
          metadata: { demo_action: "appointment_confirmation" },
        });
      }
    }

    // Analyze in the background-ish (await so the redirect shows results).
    try {
      await analyzeAndSaveLead(
        supabase,
        leadForAnalysis,
        appointmentStart ? { createTasks: false, forceHeuristic: true, statusOverride: "completed" } : undefined
      );
    } catch {
      await supabase.from("leads").update({ ai_status: "failed" }).eq("id", lead.id);
    }

    revalidatePath("/app", "layout");
    return { success: true, data: { leadId: lead.id } };
  } catch (err) {
    if (isSupabaseConnectionError(err)) {
      return { success: false, error: supabaseConnectionError };
    }
    return { success: false, error: err instanceof Error ? err.message : "Could not create lead" };
  }
}

/** Updates editable fields on an existing lead (manual CRM edits). */
export async function updateLeadFields(
  leadId: string,
  input: Partial<LeadInput>
): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) clean[k] = v;
    }
    clean.updated_at = new Date().toISOString();
    const { error } = await supabase.from("leads").update(clean).eq("id", leadId);
    if (error) return { success: false, error: error.message };
    await supabase.from("activities").insert({
      lead_id: leadId,
      user_id: user.id,
      type: "note",
      title: "Lead details updated",
    });
    revalidatePath(`/app/leads/${leadId}`);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}
