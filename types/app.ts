export type Role = "admin" | "sales_manager" | "sales_rep" | "operations_manager";

export type ServiceType =
  | "roofing"
  | "siding"
  | "windows"
  | "doors"
  | "bath"
  | "gutters"
  | "leaf_protection"
  | "storm_damage"
  | "not_sure";

export type LeadStage =
  | "new"
  | "contacted"
  | "appointment_scheduled"
  | "estimate_sent"
  | "follow_up_needed"
  | "won"
  | "lost";

export type Urgency = "emergency" | "high" | "medium" | "low";
export type LeadQuality = "hot" | "warm" | "cold";
export type AiStatus = "pending" | "completed" | "failed";

export type TaskType =
  | "call"
  | "sms"
  | "email"
  | "inspection"
  | "estimate_followup"
  | "review_response"
  | "manager_review"
  | "admin";

export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "open" | "in_progress" | "complete" | "cancelled";

export type FollowupType =
  | "sms"
  | "email"
  | "call_script"
  | "voicemail"
  | "appointment_confirmation"
  | "estimate_followup"
  | "review_response";

export type Sentiment = "positive" | "neutral" | "negative" | "mixed";
export type RiskLevel = "low" | "medium" | "high" | "urgent";

export type OperationalCategory =
  | "communication"
  | "scheduling"
  | "crew_quality"
  | "cleanup"
  | "pricing"
  | "sales_experience"
  | "installation_quality"
  | "warranty"
  | "unknown";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  preferred_contact_method: "phone" | "text" | "email" | null;
  best_time_to_contact: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  homeowner_status: string | null;
  service_type: ServiceType;
  project_reason: string | null;
  timeframe: string | null;
  budget_range: string | null;
  description: string;
  insurance_started: string | null;
  active_leak: string | null;
  source: string | null;
  stage: LeadStage;
  urgency: Urgency;
  lead_quality: LeadQuality;
  estimated_value_min: number | null;
  estimated_value_max: number | null;
  assigned_to: string | null;
  ai_status: AiStatus;
  created_at: string;
  updated_at: string;
}

export interface LeadAnalysis {
  id: string;
  lead_id: string;
  summary: string;
  urgency: Urgency;
  urgency_reasoning: string | null;
  lead_quality: LeadQuality;
  lead_quality_reasoning: string | null;
  recommended_next_action: string | null;
  recommended_contact_window: string | null;
  recommended_service_angle: string | null;
  sales_questions: string[];
  potential_objections: string[];
  tags: string[];
  raw_output: unknown;
  created_at: string;
}

export interface Task {
  id: string;
  lead_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  type: TaskType | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Followup {
  id: string;
  lead_id: string | null;
  created_by: string | null;
  type: FollowupType;
  tone: string | null;
  goal: string | null;
  subject: string | null;
  body: string;
  call_opening: string | null;
  discovery_questions: string[];
  talking_points: string[];
  closing_line: string | null;
  internal_note: string | null;
  raw_output: unknown;
  created_at: string;
}

export interface Activity {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Feedback {
  id: string;
  customer_name: string | null;
  source: string | null;
  rating: number | null;
  feedback_text: string;
  sentiment: Sentiment | null;
  risk_level: RiskLevel | null;
  summary: string | null;
  key_praise: string[];
  key_complaints: string[];
  operational_category: OperationalCategory | null;
  suggested_internal_action: string | null;
  suggested_customer_response: string | null;
  marketing_quote_opportunity: string | null;
  tags: string[];
  raw_output: unknown;
  created_at: string;
}

export type AutomationTrigger =
  | "lead_created"
  | "stage_changed_to_estimate_sent"
  | "feedback_submitted";

export interface AutomationCondition {
  field: string;
  op: "eq" | "neq" | "in" | "gte" | "lte" | "contains";
  value: string | number | boolean | string[];
}

export interface AutomationConditions {
  all?: AutomationCondition[];
  any?: AutomationCondition[];
}

export interface AutomationAction {
  type:
    | "create_task"
    | "set_lead_quality"
    | "set_urgency"
    | "add_tag"
    | "assign_role"
    | "set_risk_level"
    | "log_note";
  [key: string]: unknown;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  is_active: boolean;
  times_triggered: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  rule_id: string | null;
  lead_id: string | null;
  feedback_id: string | null;
  trigger_event: string;
  status: "success" | "failed" | "skipped";
  actions_taken: string[];
  error_message: string | null;
  created_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  service_area: string | null;
  timezone: string;
  business_hours: Record<string, string>;
  ai_enabled: boolean;
  automations_enabled: boolean;
  default_ai_model: string | null;
  default_tone: string;
  created_at: string;
  updated_at: string;
}

export interface LeadWithRelations extends Lead {
  assigned_profile?: Profile | null;
  analysis?: LeadAnalysis | null;
  tasks?: Task[];
  activities?: Activity[];
  followups?: Followup[];
}

export interface TaskWithLead extends Task {
  lead?: Pick<Lead, "id" | "first_name" | "last_name" | "service_type" | "urgency"> | null;
  assigned_profile?: Pick<Profile, "id" | "full_name" | "role"> | null;
}
