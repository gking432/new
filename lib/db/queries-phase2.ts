import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Appointment,
  AppointmentWithLead,
  AvailabilityWindow,
  CallSummary,
  CallTranscript,
  CallWithRelations,
  Communication,
  CommunicationWithLead,
  CrmConnection,
  CrmSyncEvent,
  Lead,
  PropertyResearch,
  QuoteEstimate,
} from "@/types/app";

const LEAD_MINI = "lead:leads(id, first_name, last_name, service_type, stage, urgency)";

export async function getCalls(supabase: SupabaseClient): Promise<CallWithRelations[]> {
  const { data: calls } = await supabase
    .from("calls")
    .select(`*, ${LEAD_MINI}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!calls || calls.length === 0) return [];

  const ids = calls.map((c) => c.id);
  const { data: summaries } = await supabase
    .from("call_summaries")
    .select("*")
    .in("call_id", ids);
  const byCall = new Map((summaries ?? []).map((s) => [s.call_id, s as CallSummary]));
  return (calls as unknown as CallWithRelations[]).map((c) => ({
    ...c,
    summary: byCall.get(c.id) ?? null,
  }));
}

export async function getCallDetail(
  supabase: SupabaseClient,
  id: string
): Promise<CallWithRelations | null> {
  const { data: call } = await supabase
    .from("calls")
    .select(`*, ${LEAD_MINI}`)
    .eq("id", id)
    .maybeSingle();
  if (!call) return null;

  const [{ data: summary }, { data: transcript }] = await Promise.all([
    supabase
      .from("call_summaries")
      .select("*")
      .eq("call_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("call_transcripts")
      .select("*")
      .eq("call_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    ...(call as unknown as CallWithRelations),
    summary: (summary as CallSummary | null) ?? null,
    transcript: (transcript as CallTranscript | null) ?? null,
  };
}

export interface InboxFilters {
  channel?: string;
  status?: string;
  search?: string;
}

export async function getCommunications(
  supabase: SupabaseClient,
  filters: InboxFilters = {}
): Promise<CommunicationWithLead[]> {
  let query = supabase
    .from("communications")
    .select(`*, ${LEAD_MINI}`)
    .order("created_at", { ascending: false })
    .limit(150);
  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`body.ilike.${term},subject.ilike.${term},from_value.ilike.${term}`);
  }
  const { data } = await query;
  return (data ?? []) as unknown as CommunicationWithLead[];
}

export async function getApprovalQueue(
  supabase: SupabaseClient
): Promise<CommunicationWithLead[]> {
  const { data } = await supabase
    .from("communications")
    .select(`*, ${LEAD_MINI}`)
    .in("status", ["draft", "approved"])
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as CommunicationWithLead[];
}

export async function getAppointments(
  supabase: SupabaseClient
): Promise<AppointmentWithLead[]> {
  const { data } = await supabase
    .from("appointments")
    .select(
      `*, lead:leads(id, first_name, last_name, service_type, urgency), assigned_profile:profiles!appointments_assigned_to_fkey(id, full_name, role)`
    )
    .order("start_time", { ascending: true })
    .limit(100);
  return (data ?? []) as unknown as AppointmentWithLead[];
}

export async function getAvailabilityWindows(
  supabase: SupabaseClient
): Promise<AvailabilityWindow[]> {
  const { data } = await supabase
    .from("availability_windows")
    .select("*")
    .eq("active", true)
    .order("day_of_week")
    .order("start_time");
  return (data ?? []) as AvailabilityWindow[];
}

export async function getCrmConnection(supabase: SupabaseClient): Promise<CrmConnection | null> {
  const { data } = await supabase
    .from("crm_connections")
    .select("*")
    .eq("provider", "hubspot")
    .limit(1)
    .maybeSingle();
  return (data as CrmConnection | null) ?? null;
}

export async function getCrmSyncEvents(supabase: SupabaseClient): Promise<CrmSyncEvent[]> {
  const { data } = await supabase
    .from("crm_sync_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as CrmSyncEvent[];
}

export async function getPropertyResearch(
  supabase: SupabaseClient,
  leadId: string
): Promise<PropertyResearch | null> {
  const { data } = await supabase
    .from("property_research")
    .select("*")
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PropertyResearch | null) ?? null;
}

export async function getQuotesForLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<QuoteEstimate[]> {
  const { data } = await supabase
    .from("quote_estimates")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []) as QuoteEstimate[];
}

/** Phase 2 relations for the lead detail page, fetched in one round. */
export async function getLeadPhase2(
  supabase: SupabaseClient,
  leadId: string
): Promise<{
  calls: CallWithRelations[];
  communications: Communication[];
  appointments: Appointment[];
  quote: QuoteEstimate | null;
  syncEvents: CrmSyncEvent[];
}> {
  const [callsRes, commsRes, apptsRes, quoteRes, syncRes] = await Promise.all([
    supabase
      .from("calls")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("communications")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("appointments")
      .select("*")
      .eq("lead_id", leadId)
      .order("start_time", { ascending: false })
      .limit(5),
    supabase
      .from("quote_estimates")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("crm_sync_events")
      .select("*")
      .eq("entity_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const calls = (callsRes.data ?? []) as CallWithRelations[];
  if (calls.length > 0) {
    const { data: summaries } = await supabase
      .from("call_summaries")
      .select("*")
      .in(
        "call_id",
        calls.map((c) => c.id)
      );
    const byCall = new Map((summaries ?? []).map((s) => [s.call_id, s as CallSummary]));
    for (const call of calls) call.summary = byCall.get(call.id) ?? null;
  }

  return {
    calls,
    communications: (commsRes.data ?? []) as Communication[],
    appointments: (apptsRes.data ?? []) as Appointment[],
    quote: (quoteRes.data as QuoteEstimate | null) ?? null,
    syncEvents: (syncRes.data ?? []) as CrmSyncEvent[],
  };
}

export async function getLeadsForPicker(
  supabase: SupabaseClient
): Promise<Pick<Lead, "id" | "first_name" | "last_name" | "service_type" | "stage" | "phone" | "city" | "urgency">[]> {
  const { data } = await supabase
    .from("leads")
    .select("id, first_name, last_name, service_type, stage, phone, city, urgency")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
