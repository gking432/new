"use server";

import { submitLead } from "@/lib/actions";
import { findExistingLead } from "@/lib/calls/completeCall";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { demoId, mutateDemoState, readDemoState } from "@/lib/demo/serverStore";
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
 * Resolves the lead used by the current demo story. Explicit identity always
 * wins; recency is only a convenience for opening the guide after a visitor
 * has already created a lead.
 */
export async function getDemoGuideContext(
  preferredLeadId?: string | null
): Promise<{ latestLead: DemoLatestLead | null }> {
  if (isLocalDemoMode()) {
    const state = await readDemoState();
    const lead = preferredLeadId
      ? state.leads.find((candidate) => candidate.id === preferredLeadId) ?? null
      : [...state.leads].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    if (!lead) return { latestLead: null };
    return {
      latestLead: {
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        stage: lead.stage,
        urgency: lead.urgency,
        service_type: lead.service_type,
      },
    };
  }
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, first_name, last_name, phone, stage, urgency, service_type");
  query = preferredLeadId
    ? query.eq("id", preferredLeadId)
    : query.order("created_at", { ascending: false });
  const { data } = await query.limit(1).maybeSingle();
  return { latestLead: (data as DemoLatestLead | null) ?? null };
}

const DEMO_HOMEOWNER = {
  first: "Jordan",
  last: "Avery",
  phone: "(414) 555-0123",
  city: "Pewaukee",
  street: "418 Lakeview Ct",
};

export async function ensureDemoStorylineLead(
  preferredLeadId?: string | null
): Promise<
  | { success: true; data: { lead: DemoLatestLead; created: boolean } }
  | { success: false; error: string }
> {
  const current = await getDemoGuideContext(preferredLeadId);
  if (current.latestLead) {
    return { success: true, data: { lead: current.latestLead, created: false } };
  }
  const created = await createDemoSpeedToLead();
  if (!created.success) return created;
  const resolved = await getDemoGuideContext(created.data.leadId);
  if (!resolved.latestLead) {
    return { success: false, error: "The demo lead was created but could not be reloaded" };
  }
  return { success: true, data: { lead: resolved.latestLead, created: true } };
}

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
  const homeowner = DEMO_HOMEOWNER;
  const localMode = isLocalDemoMode();

  if (localMode) {
    const state = await readDemoState();
    const targetPhone = homeowner.phone.replace(/\D/g, "").slice(-10);
    const existing = state.leads.find(
      (candidate) => (candidate.phone ?? "").replace(/\D/g, "").slice(-10) === targetPhone
    );
    if (existing) {
      await mutateDemoState((next) => {
        const lead = next.leads.find((candidate) => candidate.id === existing.id);
        if (!lead) return;
        lead.stage = "new";
        lead.updated_at = new Date().toISOString();
        next.activities.push({
          id: demoId(),
          lead_id: lead.id,
          user_id: null,
          type: "lead_created",
          title: "Repeat website submission matched to this existing record",
          description: "Demo speed-to-lead run reused the existing lead (matched by phone number).",
          metadata: { identity_match: "normalized_phone" },
          created_at: new Date().toISOString(),
        });
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
  }

  if (!localMode) {
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
