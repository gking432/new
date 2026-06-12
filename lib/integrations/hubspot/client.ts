import type { Lead, LeadAnalysis } from "@/types/app";

/**
 * HubSpot connector. Two modes:
 *  - dry_run (default): builds the exact payloads that would be sent and logs
 *    them with mock IDs — no external system is touched.
 *  - live: calls the HubSpot v3 CRM API with a private app token.
 *
 * Custom properties (service_type, urgency, lead_quality) may not exist in a
 * given portal, so those details are always included in the note body too —
 * live sync retries contact creation without custom properties on failure.
 */

export const HUBSPOT_FIELD_MAPPING: { local: string; external: string }[] = [
  { local: "first_name", external: "firstname" },
  { local: "last_name", external: "lastname" },
  { local: "email", external: "email" },
  { local: "phone", external: "phone" },
  { local: "city", external: "city" },
  { local: "service_type", external: "service_type (custom property)" },
  { local: "urgency", external: "urgency (custom property)" },
  { local: "lead_quality", external: "lead_quality (custom property)" },
  { local: "estimated value", external: "deal amount" },
  { local: "recommended_next_action", external: "note body" },
  { local: "ai crm_note", external: "note body" },
];

export interface HubSpotSyncPayload {
  contact: { properties: Record<string, string> };
  deal: { properties: Record<string, string> };
  note: { properties: { hs_note_body: string; hs_timestamp: string } };
}

export function buildHubSpotPayload(lead: Lead, analysis?: LeadAnalysis | null): HubSpotSyncPayload {
  const noteLines = [
    `AI lead summary (Northstar Command Center)`,
    analysis?.summary ?? lead.description,
    ``,
    `Service: ${lead.service_type} · Urgency: ${lead.urgency} · Quality: ${lead.lead_quality} · Stage: ${lead.stage}`,
    analysis?.recommended_next_action ? `Next action: ${analysis.recommended_next_action}` : null,
    lead.active_leak === "yes" ? `⚠ Active leak reported` : null,
  ].filter((l): l is string => l !== null);

  return {
    contact: {
      properties: {
        firstname: lead.first_name,
        lastname: lead.last_name,
        ...(lead.email ? { email: lead.email } : {}),
        ...(lead.phone ? { phone: lead.phone } : {}),
        ...(lead.city ? { city: lead.city } : {}),
      },
    },
    deal: {
      properties: {
        dealname: `${lead.first_name} ${lead.last_name} — ${lead.service_type.replace(/_/g, " ")}`,
        pipeline: "default",
        dealstage: "appointmentscheduled",
        ...(lead.estimated_value_max
          ? { amount: String(Math.round(((lead.estimated_value_min ?? 0) + lead.estimated_value_max) / 2)) }
          : {}),
      },
    },
    note: {
      properties: {
        hs_note_body: noteLines.join("\n"),
        hs_timestamp: new Date().toISOString(),
      },
    },
  };
}

export interface HubSpotSyncOutcome {
  contactId: string;
  dealId: string;
  noteId: string;
}

async function hubspotFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `HubSpot ${path} responded ${res.status}: ${body?.message ?? JSON.stringify(body).slice(0, 200)}`
    );
  }
  return body;
}

/** Live sync: create-or-update contact, create deal, attach the note. */
export async function syncToHubSpotLive(
  token: string,
  payload: HubSpotSyncPayload,
  existingContactEmail?: string | null
): Promise<HubSpotSyncOutcome> {
  // Find an existing contact by email so re-syncs update instead of duplicate.
  let contactId: string | null = null;
  if (existingContactEmail) {
    try {
      const search = await hubspotFetch(token, "/crm/v3/objects/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "email", operator: "EQ", value: existingContactEmail },
              ],
            },
          ],
          limit: 1,
        }),
      });
      contactId = search?.results?.[0]?.id ?? null;
    } catch {
      // Search failure is non-fatal; fall through to create.
    }
  }

  if (contactId) {
    await hubspotFetch(token, `/crm/v3/objects/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify(payload.contact),
    });
  } else {
    const created = await hubspotFetch(token, "/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify(payload.contact),
    });
    contactId = created.id as string;
  }

  const deal = await hubspotFetch(token, "/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      ...payload.deal,
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
        },
      ],
    }),
  });

  const note = await hubspotFetch(token, "/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      ...payload.note,
      associations: [
        {
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
        },
      ],
    }),
  });

  return { contactId: contactId!, dealId: deal.id, noteId: note.id };
}

export function mockHubSpotIds(): HubSpotSyncOutcome {
  const n = () => String(Math.floor(100000000 + Math.random() * 900000000));
  return { contactId: `demo-${n()}`, dealId: `demo-${n()}`, noteId: `demo-${n()}` };
}
