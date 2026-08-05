import "server-only";

import { demoDatePlusDays, demoDayOfWeek, demoWallClockParts } from "@/lib/utils/demoTime";
import { slotLabel, type AppointmentSlot } from "@/lib/integrations/calendar/internalCalendar";
import { estimatedValueMidpoint } from "@/lib/utils/format";
import type { LeadFilters, DashboardData, ReportData } from "@/lib/db/queries";
import type {
  AppointmentWithLead,
  CallWithRelations,
  CommunicationWithLead,
  LeadWithRelations,
  TaskWithLead,
} from "@/types/app";
import { readDemoState, type DemoState } from "@/lib/demo/serverStore";

function relationLead(state: DemoState, leadId: string | null) {
  if (!leadId) return null;
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return null;
  const { id, first_name, last_name, service_type, stage, urgency } = lead;
  return { id, first_name, last_name, service_type, stage, urgency };
}

export async function getLocalProfiles() {
  return (await readDemoState()).profiles;
}

export async function getLocalSettings() {
  return (await readDemoState()).settings;
}

export async function getLocalCrmSyncEvents() {
  return (await readDemoState()).crmSyncEvents
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getLocalAutomationRuns() {
  const state = await readDemoState();
  return state.automationRuns
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((run) => ({ ...run, lead: relationLead(state, run.lead_id) }));
}

export async function getLocalAvailabilityWindows() {
  return (await readDemoState()).availability.filter((window) => window.active);
}

export async function getLocalLeads(filters: LeadFilters = {}): Promise<LeadWithRelations[]> {
  const state = await readDemoState();
  let leads = [...state.leads];
  if (filters.search) {
    const search = filters.search.toLowerCase();
    leads = leads.filter((lead) =>
      `${lead.first_name} ${lead.last_name} ${lead.email ?? ""} ${lead.phone ?? ""}`
        .toLowerCase()
        .includes(search)
    );
  }
  for (const key of ["service_type", "urgency", "stage", "source", "assigned_to"] as const) {
    const value = filters[key];
    if (value) leads = leads.filter((lead) => lead[key] === value);
  }
  if (filters.quality) leads = leads.filter((lead) => lead.lead_quality === filters.quality);
  return leads
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((lead) => ({
      ...lead,
      assigned_profile: state.profiles.find((profile) => profile.id === lead.assigned_to) ?? null,
      analysis:
        state.analyses
          .filter((analysis) => analysis.lead_id === lead.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
    }));
}

export async function getLocalLeadDetail(id: string): Promise<LeadWithRelations | null> {
  const state = await readDemoState();
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return null;
  return {
    ...lead,
    assigned_profile: state.profiles.find((profile) => profile.id === lead.assigned_to) ?? null,
    secondary_contact:
      state.contacts.find(
        (contact) => contact.external_crm_provider === "northstar_secondary_contact" && contact.external_crm_id === id
      ) ?? null,
    analysis:
      state.analyses
        .filter((analysis) => analysis.lead_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
    tasks: state.tasks.filter((task) => task.lead_id === id),
    activities: state.activities
      .filter((activity) => activity.lead_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    communications: state.communications.filter((communication) => communication.lead_id === id),
    appointments: state.appointments.filter((appointment) => appointment.lead_id === id),
  };
}

export async function getLocalTasks(): Promise<TaskWithLead[]> {
  const state = await readDemoState();
  return state.tasks
    .slice()
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"))
    .map((task) => ({
      ...task,
      lead: relationLead(state, task.lead_id),
      assigned_profile: state.profiles.find((profile) => profile.id === task.assigned_to) ?? null,
    }));
}

export async function getLocalFeedback() {
  return (await readDemoState()).feedback;
}

export async function getLocalCommunications(): Promise<CommunicationWithLead[]> {
  const state = await readDemoState();
  return state.communications
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((communication) => ({ ...communication, lead: relationLead(state, communication.lead_id) }));
}

export async function getLocalAppointments(): Promise<AppointmentWithLead[]> {
  const state = await readDemoState();
  return state.appointments
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((appointment) => ({
      ...appointment,
      lead: relationLead(state, appointment.lead_id),
      assigned_profile: state.profiles.find((profile) => profile.id === appointment.assigned_to) ?? null,
    }));
}

export async function getLocalCalls(): Promise<CallWithRelations[]> {
  const state = await readDemoState();
  return state.calls
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((call) => ({
      ...call,
      lead: relationLead(state, call.lead_id),
      summary:
        state.callSummaries
          .filter((summary) => summary.call_id === call.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
    }));
}

export async function getLocalCallDetail(id: string): Promise<CallWithRelations | null> {
  const state = await readDemoState();
  const call = state.calls.find((item) => item.id === id);
  if (!call) return null;
  return {
    ...call,
    lead: relationLead(state, call.lead_id),
    summary:
      state.callSummaries
        .filter((summary) => summary.call_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
    transcript:
      state.callTranscripts
        .filter((transcript) => transcript.call_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
  };
}

export async function getLocalLeadPhase2(leadId: string) {
  const state = await readDemoState();
  const calls = state.calls
    .filter((call) => call.lead_id === leadId)
    .map((call) => ({
      ...call,
      summary: state.callSummaries.find((summary) => summary.call_id === call.id) ?? null,
    })) as CallWithRelations[];
  return {
    calls,
    communications: state.communications.filter((communication) => communication.lead_id === leadId),
    appointments: state.appointments.filter((appointment) => appointment.lead_id === leadId),
    quote:
      state.quotes
        .filter((quote) => quote.lead_id === leadId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null,
    syncEvents: state.crmSyncEvents
      .filter((event) => event.entity_id === leadId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

export async function getLocalDashboardData(): Promise<DashboardData> {
  const state = await readDemoState();
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const openTasks = state.tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const pipelineCounts: Record<string, number> = {};
  state.leads.forEach((lead) => (pipelineCounts[lead.stage] = (pipelineCounts[lead.stage] ?? 0) + 1));
  const priorityQueue = (await getLocalLeads()).filter((lead) => !["won", "lost"].includes(lead.stage)).slice(0, 8);
  return {
    newLeadsToday: state.leads.filter((lead) => new Date(lead.created_at) >= start).length,
    hotLeads: state.leads.filter((lead) => lead.lead_quality === "hot" && !["won", "lost"].includes(lead.stage)).length,
    overdueTasks: openTasks.filter((task) => task.due_at && new Date(task.due_at) < start).length,
    appointmentsScheduled: state.appointments.filter((appointment) =>
      ["scheduled", "confirmed", "rescheduled"].includes(appointment.status)
    ).length,
    pipelineValue: state.leads
      .filter((lead) => !["won", "lost"].includes(lead.stage))
      .reduce((sum, lead) => sum + estimatedValueMidpoint(lead.estimated_value_min, lead.estimated_value_max), 0),
    wonRevenueThisMonth: state.leads
      .filter((lead) => lead.stage === "won")
      .reduce((sum, lead) => sum + estimatedValueMidpoint(lead.estimated_value_min, lead.estimated_value_max), 0),
    priorityQueue,
    todaysTasks: (await getLocalTasks()).filter(
      (task) => task.status !== "complete" && task.due_at && new Date(task.due_at) <= end
    ).slice(0, 8),
    pipelineCounts,
  };
}

const CANONICAL_STARTS = ["09:00", "10:30", "12:00", "13:00", "14:30", "16:00", "17:30", "18:00", "18:30"];

export async function getLocalAvailableSlots(days = 14, limit = 24): Promise<AppointmentSlot[]> {
  const state = await readDemoState();
  const now = new Date();
  const booked = state.appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .map((appointment) => ({ start: new Date(appointment.start_time).getTime(), end: new Date(appointment.end_time).getTime() }));
  const slots: AppointmentSlot[] = [];
  for (let dayOffset = 0; dayOffset < days && slots.length < limit; dayOffset += 1) {
    const day = demoDatePlusDays(dayOffset, 12, 0);
    const windows = state.availability.filter((window) => window.active && window.day_of_week === demoDayOfWeek(day));
    for (const startText of CANONICAL_STARTS) {
      const [hour, minute] = startText.split(":").map(Number);
      const start = demoDatePlusDays(dayOffset, hour, minute);
      if (start.getTime() < now.getTime() + 60 * 60_000) continue;
      const startMinutes = hour * 60 + minute;
      const window = windows.find((candidate) => {
        const [fromH, fromM] = candidate.start_time.split(":").map(Number);
        const [toH, toM] = candidate.end_time.split(":").map(Number);
        return startMinutes >= fromH * 60 + fromM && startMinutes + candidate.slot_minutes <= toH * 60 + toM;
      });
      if (!window) continue;
      const end = new Date(start.getTime() + window.slot_minutes * 60_000);
      if (booked.some((item) => start.getTime() < item.end && end.getTime() > item.start)) continue;
      slots.push({ start, end, label: slotLabel(start) });
      if (slots.length >= limit) break;
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function getLocalReportData(): Promise<ReportData> {
  const state = await readDemoState();
  return { leads: state.leads, tasks: await getLocalTasks(), feedback: state.feedback, profiles: state.profiles };
}

export async function getLocalPropertyResearch(leadId: string) {
  const state = await readDemoState();
  return state.properties
    .filter((property) => property.lead_id === leadId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}

export async function getLocalQuotesForLead(leadId: string) {
  const state = await readDemoState();
  return state.quotes
    .filter((quote) => quote.lead_id === leadId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function demoMinutes(date: Date) {
  const parts = demoWallClockParts(date);
  return parts.hour * 60 + parts.minute;
}
