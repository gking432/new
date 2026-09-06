"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildHubSpotPayload,
  buildHubSpotSyncEntries,
  mockHubSpotIds,
  syncToHubSpotLive,
  type HubSpotSyncPayload,
} from "@/lib/integrations/hubspot/client";
import { createClient } from "@/lib/supabase/server";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { demoId, mutateDemoState } from "@/lib/demo/serverStore";
import type { Lead, LeadAnalysis } from "@/types/app";

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

export interface SyncResult {
  mode: "dry_run" | "live";
  payload: HubSpotSyncPayload;
  contactId: string;
  dealId: string | null;
  noteId: string;
}

/**
 * Syncs a lead to HubSpot. Without a private app token (or with live sync
 * disabled) this is a dry run: the exact payload is built, logged to
 * crm_sync_events with mock IDs, and shown in the UI — no external CRM is
 * touched. With a token and ENABLE_HUBSPOT_LIVE_SYNC=true it calls the real
 * HubSpot API.
 */
export async function syncLeadToHubSpot(leadId: string): Promise<ActionResult<SyncResult>> {
  if (isLocalDemoMode()) {
    try {
      const result = await mutateDemoState((state) => {
        const lead = state.leads.find((item) => item.id === leadId);
        if (!lead) throw new Error("Lead not found");
        const analysis = state.analyses
          .filter((item) => item.lead_id === leadId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
        const payload = buildHubSpotPayload(lead, analysis);
        const ids = mockHubSpotIds(payload);
        const createdAt = new Date().toISOString();
        const entries = buildHubSpotSyncEntries(payload, ids, "dry_run");
        state.crmSyncEvents.unshift(
          ...entries.map((entry) => ({
            id: demoId(),
            connection_id: null,
            provider: "hubspot",
            entity_type: entry.entityType,
            entity_id: leadId,
            external_id: entry.externalId,
            direction: "outbound" as const,
            action: entry.action,
            status: entry.status,
            request_payload: entry.request as unknown as Record<string, unknown>,
            response_payload: entry.response,
            error_message: null,
            created_at: createdAt,
          }))
        );
        state.activities.unshift({
          id: demoId(),
          lead_id: leadId,
          user_id: null,
          type: "crm_sync",
          title: "HubSpot dry-run sync completed - no external CRM was updated",
          description: payload.dealSkipReason ?? "Contact, deal, and AI note payloads were generated and logged for inspection.",
          metadata: { mode: "dry_run", contact_id: ids.contactId, deal_id: ids.dealId },
          created_at: createdAt,
        });
        return { mode: "dry_run" as const, payload, ...ids };
      });
      revalidatePath("/app", "layout");
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Sync failed" };
    }
  }

  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const [{ data: lead }, { data: analysis }, { data: connection }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).single(),
      supabase
        .from("lead_ai_analyses")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("crm_connections").select("*").eq("provider", "hubspot").limit(1).maybeSingle(),
    ]);
    if (!lead) return { success: false, error: "Lead not found" };

    const payload = buildHubSpotPayload(lead as Lead, analysis as LeadAnalysis | null);
    const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const live = Boolean(token) && process.env.ENABLE_HUBSPOT_LIVE_SYNC === "true";

    const logEvent = async (args: {
      entityType: string;
      entityId: string | null;
      externalId: string | null;
      action: string;
      status: "success" | "failed" | "dry_run" | "skipped";
      request: unknown;
      response: unknown;
      error?: string;
    }) => {
      await supabase.from("crm_sync_events").insert({
        connection_id: connection?.id ?? null,
        provider: "hubspot",
        entity_type: args.entityType,
        entity_id: args.entityId,
        external_id: args.externalId,
        direction: "outbound",
        action: args.action,
        status: args.status,
        request_payload: args.request ?? {},
        response_payload: args.response ?? {},
        error_message: args.error ?? null,
      });
    };

    if (!live) {
      const ids = mockHubSpotIds(payload);
      for (const entry of buildHubSpotSyncEntries(payload, ids, "dry_run")) {
        await logEvent({ ...entry, entityId: leadId });
      }
      await supabase.from("activities").insert({
        lead_id: leadId,
        type: "crm_sync",
        title: "HubSpot dry-run sync completed — no external CRM was updated",
        description: payload.dealSkipReason,
        metadata: { mode: "dry_run", contact_id: ids.contactId, deal_id: ids.dealId },
      });
      if (connection) {
        await supabase
          .from("crm_connections")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", connection.id);
      }
      revalidatePath("/app", "layout");
      return { success: true, data: { mode: "dry_run", payload, ...ids } };
    }

    try {
      const outcome = await syncToHubSpotLive(token!, payload, (lead as Lead).email);
      for (const entry of buildHubSpotSyncEntries(payload, outcome, "live")) {
        await logEvent({ ...entry, entityId: leadId });
      }
      await supabase.from("activities").insert({
        lead_id: leadId,
        type: "crm_sync",
        title: "Lead synced to HubSpot (live)",
        description: payload.dealSkipReason,
        metadata: { mode: "live", contact_id: outcome.contactId, deal_id: outcome.dealId },
      });
      if (connection) {
        await supabase
          .from("crm_connections")
          .update({ last_sync_at: new Date().toISOString(), status: "connected", mode: "live" })
          .eq("id", connection.id);
      }
      revalidatePath("/app", "layout");
      return { success: true, data: { mode: "live", payload, ...outcome } };
    } catch (err) {
      const message = err instanceof Error ? err.message : "HubSpot sync failed";
      await logEvent({
        entityType: "contact",
        entityId: leadId,
        externalId: null,
        action: "create_or_update_contact",
        status: "failed",
        request: payload.contact,
        response: {},
        error: message,
      });
      revalidatePath("/app/crm-sync");
      return { success: false, error: message };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}
