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

// ── Phase 2: calls, communications, appointments, CRM sync, quoting ─────────

export type CallScenario =
  | "new_inbound_call"
  | "existing_customer_call"
  | "speed_to_lead_outbound"
  | "manual_call_note";

export type CallStatus =
  | "created"
  | "ringing"
  | "connected"
  | "completed"
  | "missed"
  | "failed"
  | "scripted_fallback";

export interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  external_crm_id: string | null;
  external_crm_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  scenario: CallScenario;
  direction: "inbound" | "outbound";
  caller_name: string | null;
  caller_phone: string | null;
  callee_name: string | null;
  callee_phone: string | null;
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  ai_model: string | null;
  ai_status: "pending" | "completed" | "failed" | "fallback";
  created_at: string;
  updated_at: string;
}

export interface TranscriptTurn {
  speaker: "ai" | "customer" | "system";
  text: string;
  at?: number;
}

export interface CallTranscript {
  id: string;
  call_id: string;
  transcript_text: string;
  transcript_json: TranscriptTurn[];
  storage_visibility: "hidden" | "visible";
  created_at: string;
}

export interface CallSummary {
  id: string;
  call_id: string;
  lead_id: string | null;
  summary: string;
  crm_note: string;
  customer_intent: string | null;
  service_type: string | null;
  urgency: string | null;
  lead_quality: string | null;
  next_action: string | null;
  appointment_requested: boolean;
  appointment_time: string | null;
  objections: string[];
  extracted_fields: Record<string, string | null>;
  recommended_tasks: { title: string; description: string; priority: TaskPriority; due_in_minutes: number }[];
  raw_output: unknown;
  created_at: string;
}

export interface CallWithRelations extends Call {
  lead?: Pick<Lead, "id" | "first_name" | "last_name" | "service_type" | "stage" | "urgency"> | null;
  summary?: CallSummary | null;
  transcript?: CallTranscript | null;
}

export type CommunicationChannel = "form" | "call" | "sms" | "email" | "crm_import" | "manual";
export type CommunicationStatus =
  | "draft"
  | "approved"
  | "simulated_sent"
  | "sent"
  | "received"
  | "failed"
  | "discarded";

export interface Communication {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  call_id: string | null;
  channel: CommunicationChannel;
  direction: "inbound" | "outbound";
  status: CommunicationStatus;
  from_value: string | null;
  to_value: string | null;
  subject: string | null;
  body: string | null;
  ai_summary: string | null;
  suggested_next_action: string | null;
  ai_generated: boolean;
  human_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationWithLead extends Communication {
  lead?: Pick<Lead, "id" | "first_name" | "last_name" | "service_type" | "stage" | "urgency"> | null;
}

export type AppointmentStatus =
  | "suggested"
  | "scheduled"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed";

export interface Appointment {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  title: string;
  appointment_type: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  location: string | null;
  assigned_to: string | null;
  source: "internal" | "google_calendar" | "ai_call" | "manual";
  external_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentWithLead extends Appointment {
  lead?: Pick<Lead, "id" | "first_name" | "last_name" | "service_type" | "urgency"> | null;
  assigned_profile?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

export interface AvailabilityWindow {
  id: string;
  user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  appointment_type: string;
  slot_minutes: number;
  active: boolean;
  created_at: string;
}

export interface CrmConnection {
  id: string;
  provider: "hubspot" | "generic_webhook" | "demo_mock";
  name: string;
  status: "connected" | "disconnected" | "error" | "demo";
  mode: "demo" | "live" | "dry_run";
  access_token_encrypted: string | null;
  portal_id: string | null;
  base_url: string | null;
  webhook_url: string | null;
  sync_contacts: boolean;
  sync_deals: boolean;
  sync_notes: boolean;
  sync_tasks: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmSyncEvent {
  id: string;
  connection_id: string | null;
  provider: string;
  entity_type: string;
  entity_id: string | null;
  external_id: string | null;
  direction: "inbound" | "outbound";
  action: string;
  status: "pending" | "success" | "failed" | "skipped" | "dry_run";
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
}

export interface PropertyResearch {
  id: string;
  lead_id: string | null;
  address: string;
  year_built: number | null;
  finished_sqft: number | null;
  stories: number | null;
  lot_size_sqft: number | null;
  roof_type: string | null;
  roof_pitch: string | null;
  siding_material: string | null;
  estimated_roof_sqft: number | null;
  estimated_siding_sqft: number | null;
  estimated_window_count: number | null;
  data_source: string;
  confidence: "low" | "medium" | "high";
  notes: string | null;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  label: string;
  detail: string;
  low: number;
  high: number;
}

export interface QuoteEstimate {
  id: string;
  lead_id: string | null;
  created_by: string | null;
  service_type: string;
  estimate_low: number | null;
  estimate_high: number | null;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  line_items: QuoteLineItem[];
  missing_info: string[];
  inspection_questions: string[];
  weather_adjustment: Record<string, unknown>;
  property_inputs: Record<string, unknown>;
  ai_summary: string | null;
  internal_notes: string | null;
  created_at: string;
}

export interface LeadWithRelations extends Lead {
  assigned_profile?: Profile | null;
  analysis?: LeadAnalysis | null;
  tasks?: Task[];
  activities?: Activity[];
  followups?: Followup[];
  calls?: CallWithRelations[];
  communications?: Communication[];
  appointments?: Appointment[];
  quote?: QuoteEstimate | null;
  crm_sync_events?: CrmSyncEvent[];
}

export interface TaskWithLead extends Task {
  lead?: Pick<Lead, "id" | "first_name" | "last_name" | "service_type" | "urgency"> | null;
  assigned_profile?: Pick<Profile, "id" | "full_name" | "role"> | null;
}
