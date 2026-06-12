import type {
  LeadQuality,
  LeadStage,
  RiskLevel,
  Sentiment,
  ServiceType,
  TaskPriority,
  TaskStatus,
  Urgency,
} from "@/types/app";

type BadgeStyle = { label: string; className: string };

export const URGENCY_STYLES: Record<Urgency, BadgeStyle> = {
  emergency: { label: "Emergency", className: "bg-red-100 text-red-800 border-red-200" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 border-orange-200" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-800 border-blue-200" },
  low: { label: "Low", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

export const QUALITY_STYLES: Record<LeadQuality, BadgeStyle> = {
  hot: { label: "Hot", className: "bg-green-100 text-green-800 border-green-200" },
  warm: { label: "Warm", className: "bg-amber-100 text-amber-800 border-amber-200" },
  cold: { label: "Cold", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

export const STAGE_STYLES: Record<LeadStage, BadgeStyle> = {
  new: { label: "New", className: "bg-blue-100 text-blue-800 border-blue-200" },
  contacted: { label: "Contacted", className: "bg-purple-100 text-purple-800 border-purple-200" },
  appointment_scheduled: { label: "Appointment Scheduled", className: "bg-green-100 text-green-800 border-green-200" },
  estimate_sent: { label: "Estimate Sent", className: "bg-amber-100 text-amber-800 border-amber-200" },
  follow_up_needed: { label: "Follow-Up Needed", className: "bg-orange-100 text-orange-800 border-orange-200" },
  won: { label: "Won", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  lost: { label: "Lost", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export const LEAD_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "appointment_scheduled",
  "estimate_sent",
  "follow_up_needed",
  "won",
  "lost",
];

export const PRIORITY_STYLES: Record<TaskPriority, BadgeStyle> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 border-red-200" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 border-orange-200" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-800 border-blue-200" },
  low: { label: "Low", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

export const TASK_STATUS_STYLES: Record<TaskStatus, BadgeStyle> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800 border-amber-200" },
  complete: { label: "Complete", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export const SENTIMENT_STYLES: Record<Sentiment, BadgeStyle> = {
  positive: { label: "Positive", className: "bg-green-100 text-green-800 border-green-200" },
  neutral: { label: "Neutral", className: "bg-gray-100 text-gray-700 border-gray-200" },
  negative: { label: "Negative", className: "bg-red-100 text-red-800 border-red-200" },
  mixed: { label: "Mixed", className: "bg-amber-100 text-amber-800 border-amber-200" },
};

export const RISK_STYLES: Record<RiskLevel, BadgeStyle> = {
  low: { label: "Low Risk", className: "bg-gray-100 text-gray-700 border-gray-200" },
  medium: { label: "Medium Risk", className: "bg-blue-100 text-blue-800 border-blue-200" },
  high: { label: "High Risk", className: "bg-orange-100 text-orange-800 border-orange-200" },
  urgent: { label: "Urgent Risk", className: "bg-red-100 text-red-800 border-red-200" },
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  roofing: "Roofing",
  siding: "Siding",
  windows: "Windows",
  doors: "Doors",
  bath: "Bath",
  gutters: "Gutters",
  leaf_protection: "Leaf Protection",
  storm_damage: "Storm Damage",
  not_sure: "Not Sure",
};

export const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  referral: "Referral",
  yard_sign: "Yard Sign",
  previous_customer: "Previous Customer",
  event: "Event",
  other: "Other",
};

export const TIMEFRAME_LABELS: Record<string, string> = {
  emergency: "Emergency",
  this_week: "This week",
  this_month: "This month",
  "1_3_months": "1–3 months",
  researching: "Just researching",
};

export const BUDGET_LABELS: Record<string, string> = {
  under_5k: "Under $5,000",
  "5k_15k": "$5,000–$15,000",
  "15k_30k": "$15,000–$30,000",
  "30k_plus": "$30,000+",
  not_sure: "Not sure",
};

export const PROJECT_REASON_LABELS: Record<string, string> = {
  damage_repair: "Damage / repair",
  replacement: "Replacement",
  upgrade: "Upgrade",
  leak_urgent: "Leak / urgent issue",
  insurance_claim: "Insurance claim",
  maintenance: "Maintenance",
  other: "Other",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin / Owner",
  sales_manager: "Sales Manager",
  sales_rep: "Sales Rep",
  operations_manager: "Operations Manager",
};

export const CATEGORY_LABELS: Record<string, string> = {
  communication: "Communication",
  scheduling: "Scheduling",
  crew_quality: "Crew Quality",
  cleanup: "Cleanup",
  pricing: "Pricing",
  sales_experience: "Sales Experience",
  installation_quality: "Installation Quality",
  warranty: "Warranty",
  unknown: "Unknown",
};

export function labelFor(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return "—";
  return map[key] ?? key;
}
