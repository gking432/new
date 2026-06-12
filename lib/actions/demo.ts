"use server";

import { submitLead } from "@/lib/actions";

const DEMO_HOMEOWNERS = [
  { first: "Sarah", last: "Mitchell", phone: "(414) 555-0188", city: "Sussex", street: "123 Demo Lane" },
  { first: "Jordan", last: "Avery", phone: "(414) 555-0123", city: "Pewaukee", street: "418 Lakeview Ct" },
  { first: "Maria", last: "Castillo", phone: "(414) 555-0167", city: "Waukesha", street: "902 Hillcrest Dr" },
];

/**
 * Demo Center helper: submits a storm-damage lead through the real public
 * pipeline (insert → AI analysis → automations), then the UI runs the
 * speed-to-lead AI call against it.
 */
export async function createDemoSpeedToLead(): Promise<
  | { success: true; data: { leadId: string; name: string; phone: string } }
  | { success: false; error: string }
> {
  const homeowner = DEMO_HOMEOWNERS[Math.floor(Math.random() * DEMO_HOMEOWNERS.length)];
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
    },
  };
}
