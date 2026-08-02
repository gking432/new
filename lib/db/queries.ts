import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity,
  AutomationRule,
  AutomationRun,
  CompanySettings,
  Feedback,
  Followup,
  Lead,
  LeadAnalysis,
  LeadWithRelations,
  Profile,
  TaskWithLead,
} from "@/types/app";
import { estimatedValueMidpoint } from "@/lib/utils/format";

const LEAD_WITH_PROFILE = "*, assigned_profile:profiles!leads_assigned_to_fkey(id, full_name, role, avatar_url, created_at, updated_at)";

export async function getProfiles(supabase: SupabaseClient): Promise<Profile[]> {
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  return (data ?? []) as Profile[];
}

export interface LeadFilters {
  search?: string;
  service_type?: string;
  urgency?: string;
  quality?: string;
  stage?: string;
  source?: string;
  assigned_to?: string;
}

export async function getLeads(
  supabase: SupabaseClient,
  filters: LeadFilters = {}
): Promise<LeadWithRelations[]> {
  let query = supabase
    .from("leads")
    .select(LEAD_WITH_PROFILE)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.service_type) query = query.eq("service_type", filters.service_type);
  if (filters.urgency) query = query.eq("urgency", filters.urgency);
  if (filters.quality) query = query.eq("lead_quality", filters.quality);
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term},street_address.ilike.${term},city.ilike.${term},description.ilike.${term}`
    );
  }

  const { data } = await query;
  return (data ?? []) as unknown as LeadWithRelations[];
}

export async function getLeadDetail(
  supabase: SupabaseClient,
  id: string
): Promise<LeadWithRelations | null> {
  const { data: lead } = await supabase
    .from("leads")
    .select(LEAD_WITH_PROFILE)
    .eq("id", id)
    .maybeSingle();

  if (!lead) return null;

  const [
    { data: analysis },
    { data: tasks },
    { data: activities },
    { data: followups },
    { data: secondaryContact },
  ] =
    await Promise.all([
      supabase
        .from("lead_ai_analyses")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("tasks").select("*").eq("lead_id", id).order("due_at"),
      supabase
        .from("activities")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("followups")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("contacts")
        .select("*")
        .eq("external_crm_provider", "northstar_secondary_contact")
        .eq("external_crm_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    ...(lead as unknown as LeadWithRelations),
    secondary_contact: secondaryContact ?? null,
    analysis: (analysis as LeadAnalysis | null) ?? null,
    tasks: (tasks ?? []) as LeadWithRelations["tasks"],
    activities: (activities ?? []) as Activity[],
    followups: (followups ?? []) as Followup[],
  };
}

export async function getTasks(supabase: SupabaseClient): Promise<TaskWithLead[]> {
  const { data } = await supabase
    .from("tasks")
    .select(
      "*, lead:leads(id, first_name, last_name, service_type, urgency), assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name, role)"
    )
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);
  return (data ?? []) as unknown as TaskWithLead[];
}

export interface DashboardData {
  newLeadsToday: number;
  hotLeads: number;
  overdueTasks: number;
  appointmentsScheduled: number;
  pipelineValue: number;
  wonRevenueThisMonth: number;
  priorityQueue: LeadWithRelations[];
  todaysTasks: TaskWithLead[];
  pipelineCounts: Record<string, number>;
}

const URGENCY_RANK: Record<string, number> = { emergency: 0, high: 1, medium: 2, low: 3 };
const QUALITY_RANK: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

export async function getDashboardData(supabase: SupabaseClient): Promise<DashboardData> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const [leadsRes, tasksRes, analysesRes] = await Promise.all([
    supabase.from("leads").select(LEAD_WITH_PROFILE).order("created_at", { ascending: false }).limit(500),
    supabase
      .from("tasks")
      .select(
        "*, lead:leads(id, first_name, last_name, service_type, urgency), assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name, role)"
      )
      .neq("status", "complete")
      .neq("status", "cancelled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("lead_ai_analyses")
      .select("lead_id, recommended_next_action, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const leads = (leadsRes.data ?? []) as unknown as LeadWithRelations[];
  const openTasks = (tasksRes.data ?? []) as unknown as TaskWithLead[];
  const analyses = (analysesRes.data ?? []) as Pick<
    LeadAnalysis,
    "lead_id" | "recommended_next_action" | "created_at"
  >[];

  const actionByLead = new Map<string, string>();
  for (const a of analyses) {
    if (!actionByLead.has(a.lead_id) && a.recommended_next_action) {
      actionByLead.set(a.lead_id, a.recommended_next_action);
    }
  }

  const openStages = new Set(["new", "contacted", "appointment_scheduled", "estimate_sent", "follow_up_needed"]);
  const openLeads = leads.filter((l) => openStages.has(l.stage));

  const priorityQueue = [...openLeads]
    .sort(
      (a, b) =>
        URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
        QUALITY_RANK[a.lead_quality] - QUALITY_RANK[b.lead_quality] ||
        b.created_at.localeCompare(a.created_at)
    )
    .slice(0, 5)
    .map((lead) => ({
      ...lead,
      analysis: actionByLead.has(lead.id)
        ? ({ recommended_next_action: actionByLead.get(lead.id) } as LeadAnalysis)
        : null,
    }));

  const now = new Date();
  const pipelineCounts: Record<string, number> = {};
  for (const lead of leads) {
    pipelineCounts[lead.stage] = (pipelineCounts[lead.stage] ?? 0) + 1;
  }

  return {
    newLeadsToday: leads.filter((l) => new Date(l.created_at) >= startOfToday).length,
    hotLeads: openLeads.filter((l) => l.lead_quality === "hot").length,
    overdueTasks: openTasks.filter((t) => t.due_at && new Date(t.due_at) < now).length,
    appointmentsScheduled: leads.filter((l) => l.stage === "appointment_scheduled").length,
    pipelineValue: openLeads.reduce(
      (sum, l) => sum + estimatedValueMidpoint(l.estimated_value_min, l.estimated_value_max),
      0
    ),
    wonRevenueThisMonth: leads
      .filter((l) => l.stage === "won" && new Date(l.updated_at) >= startOfMonth)
      .reduce((sum, l) => sum + estimatedValueMidpoint(l.estimated_value_min, l.estimated_value_max), 0),
    priorityQueue,
    todaysTasks: openTasks
      .filter((t) => t.due_at && new Date(t.due_at) < endOfToday)
      .slice(0, 8),
    pipelineCounts,
  };
}

export async function getFeedbackList(supabase: SupabaseClient): Promise<Feedback[]> {
  const { data } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as Feedback[];
}

export async function getAutomationRules(supabase: SupabaseClient): Promise<AutomationRule[]> {
  const { data } = await supabase
    .from("automation_rules")
    .select("*")
    .order("created_at");
  return (data ?? []) as AutomationRule[];
}

export async function getAutomationRuns(supabase: SupabaseClient): Promise<AutomationRun[]> {
  const { data } = await supabase
    .from("automation_runs")
    .select("*, lead:leads(id, first_name, last_name, service_type, stage, urgency)")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as AutomationRun[];
}

export async function getSettings(supabase: SupabaseClient): Promise<CompanySettings | null> {
  const { data } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
  return data as CompanySettings | null;
}

export interface ReportData {
  leads: Lead[];
  tasks: TaskWithLead[];
  feedback: Feedback[];
  profiles: Profile[];
}

export async function getReportData(supabase: SupabaseClient): Promise<ReportData> {
  const [leadsRes, tasksRes, feedbackRes, profilesRes] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase
      .from("tasks")
      .select("*, assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name, role)")
      .limit(500),
    supabase.from("feedback").select("*").limit(500),
    supabase.from("profiles").select("*"),
  ]);
  return {
    leads: (leadsRes.data ?? []) as Lead[],
    tasks: (tasksRes.data ?? []) as unknown as TaskWithLead[],
    feedback: (feedbackRes.data ?? []) as Feedback[],
    profiles: (profilesRes.data ?? []) as Profile[],
  };
}

// No-login demo: there's no authenticated user, so return the first seeded
// profile if one exists, otherwise a generic demo profile for the header/UI.
const DEMO_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000000",
  full_name: "Demo User",
  role: "admin",
  avatar_url: null,
  created_at: "",
  updated_at: "",
};

export async function getCurrentProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").limit(1).maybeSingle();
  return (data as Profile | null) ?? DEMO_PROFILE;
}
