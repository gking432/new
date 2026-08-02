"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callStructuredAI, isAIConfigured } from "@/lib/ai/client";
import { getPropertyProvider } from "@/lib/property/provider";
import { calculateQuote, type QuoteInputs } from "@/lib/property/quoteCalculator";
import { DEFAULT_WEATHER, type WeatherContext } from "@/lib/property/types";
import { createClient } from "@/lib/supabase/server";
import type { PropertyResearch } from "@/types/app";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { demoAdminId, demoId, mutateDemoState, readDemoState } from "@/lib/demo/serverStore";

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

/**
 * Loads (or generates) the demo property profile for a lead's address and
 * saves it to property_research.
 */
export async function generatePropertyProfile(
  leadId: string
): Promise<ActionResult<PropertyResearch>> {
  if (isLocalDemoMode()) {
    try {
      const state = await readDemoState();
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return { success: false, error: "Lead not found" };
      const address = [lead.street_address, lead.city, lead.state].filter(Boolean).join(", ") || `Lead ${leadId.slice(0, 8)}`;
      const profile = await getPropertyProvider().lookupByAddress(address);
      const record: PropertyResearch = {
        id: state.properties.find((item) => item.lead_id === leadId)?.id ?? demoId(),
        lead_id: leadId,
        address: profile.address,
        year_built: profile.year_built,
        finished_sqft: profile.finished_sqft,
        stories: profile.stories,
        lot_size_sqft: profile.lot_size_sqft,
        roof_type: profile.roof_type,
        roof_pitch: profile.roof_pitch,
        siding_material: profile.siding_material,
        estimated_roof_sqft: profile.estimated_roof_sqft,
        estimated_siding_sqft: profile.estimated_siding_sqft,
        estimated_window_count: profile.estimated_window_count,
        data_source: profile.data_source,
        confidence: profile.confidence,
        notes: profile.notes,
        raw_data: { generated_for_demo: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await mutateDemoState((next) => {
        next.properties = next.properties.filter((item) => item.lead_id !== leadId);
        next.properties.push(record);
      });
      revalidatePath("/app/quote-tool");
      return { success: true, data: record };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Lookup failed" };
    }
  }
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { data: lead } = await supabase
      .from("leads")
      .select("id, street_address, city, state")
      .eq("id", leadId)
      .single();
    if (!lead) return { success: false, error: "Lead not found" };

    const address =
      [lead.street_address, lead.city, lead.state].filter(Boolean).join(", ") ||
      `Lead ${leadId.slice(0, 8)}`;
    const profile = await getPropertyProvider().lookupByAddress(address);

    const { data: existing } = await supabase
      .from("property_research")
      .select("id")
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle();

    const record = {
      lead_id: leadId,
      address: profile.address,
      year_built: profile.year_built,
      finished_sqft: profile.finished_sqft,
      stories: profile.stories,
      lot_size_sqft: profile.lot_size_sqft,
      roof_type: profile.roof_type,
      roof_pitch: profile.roof_pitch,
      siding_material: profile.siding_material,
      estimated_roof_sqft: profile.estimated_roof_sqft,
      estimated_siding_sqft: profile.estimated_siding_sqft,
      estimated_window_count: profile.estimated_window_count,
      data_source: profile.data_source,
      confidence: profile.confidence,
      notes: profile.notes,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = existing
      ? await supabase
          .from("property_research")
          .update(record)
          .eq("id", existing.id)
          .select("*")
          .single()
      : await supabase.from("property_research").insert(record).select("*").single();
    if (error || !data) return { success: false, error: error?.message ?? "Save failed" };

    revalidatePath("/app/quote-tool");
    return { success: true, data: data as PropertyResearch };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Lookup failed" };
  }
}

const quoteRequestSchema = z.object({
  lead_id: z.string().uuid(),
  service_type: z.string(),
  material_tier: z.enum(["good", "better", "best"]),
  complexity: z.enum(["simple", "moderate", "complex"]),
  finished_sqft: z.number().optional(),
  stories: z.number().optional(),
  roof_pitch: z.enum(["low", "moderate", "steep"]).optional(),
  roof_age_years: z.number().optional(),
  estimated_roof_sqft: z.number().optional(),
  estimated_siding_sqft: z.number().optional(),
  window_count: z.number().optional(),
  gutter_linear_feet: z.number().optional(),
  tearoff_needed: z.boolean().optional(),
  active_leak: z.boolean().optional(),
  leaf_protection: z.boolean().optional(),
  bath_type: z.enum(["tub_to_shower", "shower_update", "full_remodel", "accessibility"]).optional(),
  weather: z
    .object({
      recent_hail: z.boolean(),
      recent_high_wind: z.boolean(),
      heavy_rain: z.boolean(),
      storm_date: z.string().nullable(),
      reported_severity: z.enum(["none", "minor", "moderate", "severe"]),
      neighborhood_storm_volume: z.enum(["low", "medium", "high"]),
    })
    .optional(),
  internal_notes: z.string().max(2000).optional(),
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

const QuoteSummarySchema = z.object({
  summary: z.string(),
  talking_points: z.array(z.string()),
});

/**
 * Generates an internal ballpark estimate: deterministic calculators for the
 * numbers, optional AI for the narrative summary and sales talking points.
 */
export async function generateQuoteEstimate(input: QuoteRequest): Promise<
  ActionResult<{
    id: string;
    result: ReturnType<typeof calculateQuote>;
    ai_summary: string | null;
    talking_points: string[];
  }>
> {
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid quote inputs" };

  if (isLocalDemoMode()) {
    try {
      const state = await readDemoState();
      const lead = state.leads.find((item) => item.id === parsed.data.lead_id);
      if (!lead) return { success: false, error: "Lead not found" };
      const weather: WeatherContext = parsed.data.weather ?? DEFAULT_WEATHER;
      const inputs: QuoteInputs = { ...parsed.data };
      const result = calculateQuote(inputs, weather);
      const aiSummary = `Internal ballpark for ${lead.first_name} ${lead.last_name}: $${result.estimate_low.toLocaleString()}-$${result.estimate_high.toLocaleString()} (${result.confidence} confidence). Final scope requires an on-site inspection.`;
      const talkingPoints = [
        "Use this range as a planning number, not a final customer quote",
        "Explain which material, access, and scope assumptions drive the range",
        "Confirm measurements and hidden conditions during the inspection",
      ];
      const id = demoId();
      await mutateDemoState((next) => {
        next.quotes.push({
          id,
          lead_id: lead.id,
          created_by: demoAdminId(next),
          service_type: parsed.data.service_type,
          estimate_low: result.estimate_low,
          estimate_high: result.estimate_high,
          confidence: result.confidence,
          assumptions: result.assumptions,
          line_items: result.line_items,
          missing_info: result.missing_info,
          inspection_questions: result.inspection_questions,
          weather_adjustment: { ...weather, note: result.weather_note },
          property_inputs: inputs as unknown as Record<string, unknown>,
          ai_summary: aiSummary,
          internal_notes: parsed.data.internal_notes ?? null,
          created_at: new Date().toISOString(),
        });
        next.activities.push({
          id: demoId(), lead_id: lead.id, user_id: demoAdminId(next), type: "quote",
          title: `Internal ballpark estimate generated: $${result.estimate_low.toLocaleString()}-$${result.estimate_high.toLocaleString()}`,
          description: aiSummary, metadata: { quote_id: id, confidence: result.confidence }, created_at: new Date().toISOString(),
        });
      });
      revalidatePath("/app", "layout");
      return { success: true, data: { id, result, ai_summary: aiSummary, talking_points: talkingPoints } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Quote generation failed" };
    }
  }

  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { data: lead } = await supabase
      .from("leads")
      .select("id, first_name, last_name, service_type, description, active_leak, urgency")
      .eq("id", parsed.data.lead_id)
      .single();
    if (!lead) return { success: false, error: "Lead not found" };

    const weather: WeatherContext = parsed.data.weather ?? DEFAULT_WEATHER;
    const inputs: QuoteInputs = { ...parsed.data };
    const result = calculateQuote(inputs, weather);

    let aiSummary: string | null = null;
    let talkingPoints: string[] = [];
    if (isAIConfigured()) {
      try {
        const ai = await callStructuredAI({
          system:
            'You write short internal notes for a home improvement sales team. Given a ballpark estimate, write a 2-3 sentence internal summary and 3-4 sales talking points. Never call it a final quote — it always requires an inspection. Never promise insurance coverage. Respond with JSON: {"summary": string, "talking_points": string[]}.',
          user: JSON.stringify({
            customer: `${lead.first_name} ${lead.last_name}`,
            request: lead.description,
            urgency: lead.urgency,
            estimate: result,
            weather,
          }),
          schema: QuoteSummarySchema,
          maxTokens: 500,
        });
        aiSummary = ai.summary;
        talkingPoints = ai.talking_points;
      } catch (err) {
        console.error("AI quote summary failed:", err);
      }
    }
    if (!aiSummary) {
      aiSummary = `Internal ballpark for ${lead.first_name} ${lead.last_name}: $${result.estimate_low.toLocaleString()}–$${result.estimate_high.toLocaleString()} (${result.confidence} confidence). ${
        result.missing_info.length > 0
          ? `Missing: ${result.missing_info.join(", ")}. `
          : ""
      }Final scope requires an on-site inspection.`;
      talkingPoints = [
        "Frame the range as a planning number, not a quote — the inspection sets the real scope",
        "Walk through what drives the range (area, material tier, complexity)",
        ...(result.weather_note ? ["Document storm damage with photos during the visit"] : []),
      ];
    }

    const { data: saved, error } = await supabase
      .from("quote_estimates")
      .insert({
        lead_id: lead.id,
        created_by: user.id,
        service_type: parsed.data.service_type,
        estimate_low: result.estimate_low,
        estimate_high: result.estimate_high,
        confidence: result.confidence,
        assumptions: result.assumptions,
        line_items: result.line_items,
        missing_info: result.missing_info,
        inspection_questions: result.inspection_questions,
        weather_adjustment: { ...weather, note: result.weather_note },
        property_inputs: inputs as unknown as Record<string, unknown>,
        ai_summary: aiSummary,
        internal_notes: parsed.data.internal_notes ?? null,
      })
      .select("id")
      .single();
    if (error || !saved) return { success: false, error: error?.message ?? "Save failed" };

    await supabase.from("activities").insert({
      lead_id: lead.id,
      user_id: user.id,
      type: "quote",
      title: `Internal ballpark estimate generated: $${result.estimate_low.toLocaleString()}–$${result.estimate_high.toLocaleString()}`,
      description: aiSummary,
      metadata: { quote_id: saved.id, confidence: result.confidence },
    });

    revalidatePath("/app", "layout");
    return {
      success: true,
      data: { id: saved.id, result, ai_summary: aiSummary, talking_points: talkingPoints },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Quote generation failed" };
  }
}
