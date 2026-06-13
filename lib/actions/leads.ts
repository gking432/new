"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeAndSaveLead } from "@/lib/ai/analyzeLead";
import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/app";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
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
});

export type LeadInput = z.infer<typeof leadInputSchema>;

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
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        ...parsed.data,
        last_name: parsed.data.last_name || "",
        stage: "new",
        source: parsed.data.source ?? "manual",
        ai_status: "pending",
        assigned_to: user.id,
      })
      .select("*")
      .single();
    if (error || !lead) return { success: false, error: error?.message ?? "Could not create lead" };

    await supabase.from("activities").insert({
      lead_id: lead.id,
      user_id: user.id,
      type: "lead_created",
      title: "Lead created manually",
      description: "Entered directly in the CRM.",
    });

    // Analyze in the background-ish (await so the redirect shows results).
    try {
      await analyzeAndSaveLead(supabase, lead as Lead);
    } catch {
      await supabase.from("leads").update({ ai_status: "failed" }).eq("id", lead.id);
    }

    revalidatePath("/app", "layout");
    return { success: true, data: { leadId: lead.id } };
  } catch (err) {
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
