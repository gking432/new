"use server";

import { submitLead } from "@/lib/actions";
import { findExistingLead } from "@/lib/calls/completeCall";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface DemoLatestLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  stage: string;
  urgency: string;
  service_type: string;
}

/**
 * Context the demo guide needs. With the blank-slate demo, existing-customer
 * and inbound-text scenarios reference the most recent lead the demoer
 * actually created.
 */
export async function getDemoGuideContext(): Promise<{ latestLead: DemoLatestLead | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone, stage, urgency, service_type")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { latestLead: (data as DemoLatestLead | null) ?? null };
}

const DEMO_HOMEOWNERS = [
  { first: "Jordan", last: "Avery", phone: "(414) 555-0123", city: "Pewaukee", street: "418 Lakeview Ct" },
  { first: "Maria", last: "Castillo", phone: "(414) 555-0167", city: "Waukesha", street: "902 Hillcrest Dr" },
  { first: "Tyler", last: "Brennan", phone: "(262) 555-0190", city: "Brookfield", street: "1377 Stonefield Rd" },
];

/**
 * Demo Center helper: submits a storm-damage lead through the real public
 * pipeline (insert → AI analysis → automations), then the UI runs the
 * speed-to-lead AI call against it. Dedupes by phone: re-running the demo
 * with the same homeowner reuses their existing lead instead of creating a
 * duplicate.
 */
export async function createDemoSpeedToLead(): Promise<
  | { success: true; data: { leadId: string; name: string; phone: string; reused: boolean } }
  | { success: false; error: string }
> {
  const homeowner = DEMO_HOMEOWNERS[Math.floor(Math.random() * DEMO_HOMEOWNERS.length)];

  try {
    const supabase = createAdminClient();
    const existing = await findExistingLead(supabase, homeowner.phone);
    if (existing) {
      await supabase
        .from("leads")
        .update({ stage: "new", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      await supabase.from("activities").insert({
        lead_id: existing.id,
        type: "lead_created",
        title: "Repeat website submission matched to this existing record",
        description: "Demo speed-to-lead run reused the existing lead (matched by phone number).",
      });
      return {
        success: true,
        data: {
          leadId: existing.id,
          name: `${existing.first_name} ${existing.last_name}`,
          phone: existing.phone ?? homeowner.phone,
          reused: true,
        },
      };
    }
  } catch {
    // Admin client unavailable — fall through to the normal pipeline, which
    // reports a friendly configuration error.
  }

  const result = await submitLead({
    first_name: homeowner.first,
    last_name: homeowner.last,
    email: `${homeowner.first.toLowerCase()}.${homeowner.last.toLowerCase()}@example.com`,
    phone: homeowner.phone,
    preferred_contact_method: "phone",
    best_time_to_contact: "afternoon",
    street_address: homeowner.street,
    city: homeowner.city,
    state: "WI",
    zip_code: "53089",
    homeowner_status: "owner",
    service_type: "storm_damage",
    project_reason: "damage_repair",
    timeframe: "emergency",
    budget_range: "not_sure",
    description:
      "We had hail last week and now I'm seeing missing shingles and a water spot on the ceiling upstairs. It looks like it's getting bigger.",
    insurance_started: "no",
    active_leak: "yes",
    source: "google",
  });

  if (!result.success || !result.data) {
    return { success: false, error: !result.success ? result.error : "Lead creation failed" };
  }
  return {
    success: true,
    data: {
      leadId: result.data.leadId,
      name: `${homeowner.first} ${homeowner.last}`,
      phone: homeowner.phone,
      reused: false,
    },
  };
}
