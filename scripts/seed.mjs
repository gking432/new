/**
 * Demo data seeder for Home Service AI Command Center.
 *
 * Creates demo auth users + profiles, 25 realistic leads with AI analyses,
 * tasks, feedback, and activity history. Safe to re-run: existing demo users
 * are reused and operational tables are cleared first.
 *
 * Usage:
 *   npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local or the environment.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// Minimal .env.local loader so the script runs without extra dependencies.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local first."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "demo-password";

const DEMO_USERS = [
  { email: "admin@northstar-demo.com", full_name: "Dana Whitfield", role: "admin" },
  { email: "manager@northstar-demo.com", full_name: "Marcus Teal", role: "sales_manager" },
  { email: "sales@northstar-demo.com", full_name: "Jess Romero", role: "sales_rep" },
  { email: "ops@northstar-demo.com", full_name: "Priya Natarajan", role: "operations_manager" },
];

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}
function daysAgo(d) {
  return hoursAgo(d * 24);
}
function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

async function ensureUsers() {
  const profiles = {};
  for (const user of DEMO_USERS) {
    let userId;
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      // User likely already exists — look them up.
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const existing = list?.users?.find((u) => u.email === user.email);
      if (!existing) throw new Error(`Could not create or find user ${user.email}: ${error.message}`);
      userId = existing.id;
    } else {
      userId = created.user.id;
    }
    await supabase.from("profiles").upsert({
      id: userId,
      full_name: user.full_name,
      role: user.role,
    });
    profiles[user.role] = userId;
    console.log(`✓ user ${user.email} (${user.role})`);
  }
  return profiles;
}

async function clearOperationalData() {
  for (const table of ["automation_runs", "activities", "followups", "tasks", "lead_ai_analyses", "feedback", "leads"]) {
    await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }
  console.log("✓ cleared operational tables");
}

// ── Leads ────────────────────────────────────────────────────────────────────
// [first, last, service, description, timeframe, budget, source, reason, leak,
//  insurance, stage, urgency, quality, valMin, valMax, ageHours, city, assigned]
const LEADS = [
  ["Sarah", "Mitchell", "storm_damage", "We had hail last week and now I'm seeing missing shingles and a brown water spot on the upstairs bedroom ceiling.", "emergency", "not_sure", "google", "damage_repair", "yes", "not_sure", "new", "emergency", "hot", 10000, 25000, 1, "Maple Grove", "sales_rep"],
  ["David", "Carlson", "windows", "We have old drafty windows and want to replace most of the first floor before winter.", "1_3_months", "15k_30k", "referral", "replacement", "no", "not_applicable", "contacted", "medium", "hot", 15000, 28000, 26, "Plymouth", "sales_manager"],
  ["Mike", "Anderson", "leaf_protection", "I'm tired of cleaning gutters. Looking for gutter guards before fall.", "this_month", "5k_15k", "facebook", "upgrade", "no", "not_applicable", "new", "medium", "warm", 3000, 6500, 5, "Blaine", "sales_rep"],
  ["Janet", "Brooks", "bath", "Want to replace an old tub with a walk-in shower for easier access.", "this_month", "15k_30k", "previous_customer", "upgrade", "no", "not_applicable", "appointment_scheduled", "medium", "hot", 16000, 26000, 50, "Edina", "sales_manager"],
  ["Eric", "Nelson", "siding", "Wind damaged a section of siding on the west side of the house. Also considering full replacement if price makes sense.", "this_week", "not_sure", "yard_sign", "damage_repair", "no", "not_sure", "contacted", "high", "hot", 12000, 24000, 30, "Coon Rapids", "sales_rep"],
  ["Alyssa", "Tran", "roofing", "Roof is about 22 years old and we found shingle granules in the gutters. Want to know if it needs replacement before we list the house next spring.", "1_3_months", "15k_30k", "google", "replacement", "no", "not_applicable", "estimate_sent", "medium", "warm", 14000, 21000, 96, "Woodbury", "sales_manager"],
  ["Robert", "Klein", "storm_damage", "Straight-line winds came through Tuesday. Several shingles in the yard and the neighbor's adjuster already came out.", "this_week", "not_sure", "referral", "insurance_claim", "no", "yes", "appointment_scheduled", "high", "hot", 12000, 26000, 70, "Anoka", "sales_rep"],
  ["Linda", "Okafor", "gutters", "Gutters are pulling away from the fascia at the back of the house and overflow every rain.", "this_week", "under_5k", "google", "damage_repair", "no", "not_applicable", "new", "high", "warm", 1800, 4200, 8, "Brooklyn Park", null],
  ["Tom", "Reyes", "doors", "Front entry door is warped and lets cold air in. Looking at a fiberglass replacement.", "this_month", "5k_15k", "google", "replacement", "no", "not_applicable", "contacted", "medium", "warm", 3500, 8000, 120, "Richfield", "sales_rep"],
  ["Grace", "Lindqvist", "bath", "Master bath is original to the 1998 build. Full remodel: shower, vanity, floor.", "1_3_months", "30k_plus", "google", "upgrade", "no", "not_applicable", "estimate_sent", "medium", "hot", 30000, 48000, 140, "Eden Prairie", "sales_manager"],
  ["Hector", "Alvarez", "roofing", "Water is dripping through the kitchen ceiling fan box when it rains hard. Need someone fast.", "emergency", "not_sure", "google", "leak_urgent", "yes", "no", "contacted", "emergency", "hot", 9000, 19000, 12, "St. Louis Park", "sales_rep"],
  ["Megan", "Foster", "windows", "Looking for quotes on 12 replacement windows. Comparing 3 companies.", "this_month", "15k_30k", "facebook", "replacement", "no", "not_applicable", "estimate_sent", "medium", "warm", 15000, 24000, 168, "Burnsville", "sales_manager"],
  ["Paul", "Jansen", "siding", "Considering switching from cedar to fiber cement. Whole house, two stories.", "1_3_months", "30k_plus", "referral", "replacement", "no", "not_applicable", "follow_up_needed", "medium", "hot", 30000, 52000, 240, "Minnetonka", "sales_manager"],
  ["Karen", "Whitman", "leaf_protection", "Saw your yard sign down the street. What does leaf protection run for about 160 feet of gutter?", "researching", "not_sure", "yard_sign", "upgrade", "no", "not_applicable", "new", "low", "cold", 2500, 5500, 18, "Champlin", null],
  ["Devon", "Marsh", "storm_damage", "Hail came through last night. No visible leaks yet but the gutters and a few vents look dented.", "this_week", "not_sure", "google", "insurance_claim", "not_sure", "not_sure", "new", "high", "hot", 10000, 24000, 3, "Otsego", "sales_rep"],
  ["Christine", "Bauer", "bath", "Tub-to-shower conversion for my mother. Grab bars and a low step are important.", "this_month", "5k_15k", "previous_customer", "upgrade", "no", "not_applicable", "contacted", "medium", "hot", 9000, 15000, 44, "Roseville", "sales_rep"],
  ["Frank", "Delgado", "roofing", "Just researching roof costs for a 1,800 sq ft rambler. No issues, roof is 15 years old.", "researching", "not_sure", "google", "maintenance", "no", "not_applicable", "new", "low", "cold", 9000, 16000, 200, "Fridley", null],
  ["Nina", "Patel", "windows", "Two bedroom windows have failed seals and fog up. Might do the whole upstairs while we're at it.", "this_month", "5k_15k", "google", "replacement", "no", "not_applicable", "appointment_scheduled", "medium", "warm", 6000, 14000, 75, "Shoreview", "sales_rep"],
  ["Gary", "Holm", "gutters", "New gutters and downspouts after ice dam damage last winter. Insurance claim already approved.", "this_month", "5k_15k", "referral", "insurance_claim", "no", "yes", "won", "medium", "hot", 4500, 6500, 400, "White Bear Lake", "sales_rep"],
  ["Sandra", "Liu", "siding", "North side of the house has green staining and a couple of cracked panels.", "1_3_months", "5k_15k", "facebook", "damage_repair", "no", "not_applicable", "follow_up_needed", "medium", "warm", 6000, 13000, 320, "Lakeville", "sales_rep"],
  ["Bill", "Hartman", "roofing", "Full roof replacement after hail claim was approved. Ready to schedule.", "this_week", "15k_30k", "previous_customer", "insurance_claim", "no", "yes", "won", "high", "hot", 17000, 22000, 460, "Apple Valley", "sales_manager"],
  ["Olivia", "Sorensen", "doors", "Patio slider sticks badly and the glass has condensation between panes.", "1_3_months", "under_5k", "google", "replacement", "no", "not_applicable", "new", "low", "warm", 2500, 5000, 90, "Savage", null],
  ["Ray", "Thompson", "storm_damage", "Tree limb went through the garage roof in the storm. Tarped it myself but it needs real repair.", "emergency", "not_sure", "google", "damage_repair", "yes", "yes", "appointment_scheduled", "emergency", "hot", 8000, 18000, 20, "Ham Lake", "sales_rep"],
  ["Beth", "Calloway", "windows", "Bay window in the living room is rotting at the sill. Would like options and pricing.", "this_month", "5k_15k", "facebook", "damage_repair", "no", "not_applicable", "lost", "medium", "warm", 4000, 9000, 600, "Inver Grove Heights", "sales_rep"],
  ["Sam", "Iverson", "not_sure", "House feels drafty and energy bills doubled. Not sure if it's windows, siding, or insulation. Would like someone to look.", "1_3_months", "not_sure", "event", "other", "no", "not_applicable", "new", "low", "warm", null, null, 60, "Hopkins", null],
];

const ANALYSIS_TEMPLATES = {
  storm_damage: {
    next_action: "Call within 15 minutes. Confirm when the storm occurred, whether leaking is active, whether an insurance claim has been started, and offer an inspection within 24–48 hours.",
    window: "Within 15 minutes",
    angle: "Free storm damage inspection with photo documentation the homeowner can use for an insurance claim. Do not promise claim approval.",
    questions: ["When did the storm come through?", "Is water actively coming in anywhere?", "Have you contacted your insurance company yet?", "Are you available for an inspection in the next 24–48 hours?"],
  },
  default: {
    next_action: "Call the same business day to confirm scope, answer questions, and book an inspection.",
    window: "Same business day",
    angle: "Free inspection and a clear written estimate, with financing options to discuss if helpful.",
    questions: ["What outcome are you hoping for with this project?", "Is there a timeline driving the decision?", "Have you gotten other quotes yet?", "When works best for an in-home visit?"],
  },
};

async function seedLeads(profiles) {
  const leadIds = [];
  for (const row of LEADS) {
    const [first, last, service, description, timeframe, budget, source, reason, leak, insurance, stage, urgency, quality, valMin, valMax, ageHours, city, assignedRole] = row;
    const emailHandle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        first_name: first,
        last_name: last,
        email: `${emailHandle}@example.com`,
        phone: `(555) 01${String(leadIds.length).padStart(2, "0")}-${String(1000 + leadIds.length * 37).slice(0, 4)}`,
        preferred_contact_method: ["phone", "text", "email"][leadIds.length % 3],
        best_time_to_contact: ["morning", "afternoon", "evening", "anytime"][leadIds.length % 4],
        street_address: `${1200 + leadIds.length * 53} ${["Birch", "Cedar", "Elm", "Oak", "Spruce"][leadIds.length % 5]} ${["Ln", "St", "Ave", "Ct"][leadIds.length % 4]}`,
        city,
        state: "MN",
        zip_code: String(55301 + (leadIds.length % 90)),
        homeowner_status: "owner",
        service_type: service,
        project_reason: reason,
        timeframe,
        budget_range: budget,
        description,
        insurance_started: insurance,
        active_leak: leak,
        source,
        stage,
        urgency,
        lead_quality: quality,
        estimated_value_min: valMin,
        estimated_value_max: valMax,
        assigned_to: assignedRole ? profiles[assignedRole] : null,
        ai_status: "completed",
        created_at: hoursAgo(ageHours),
        updated_at: hoursAgo(Math.max(ageHours - 2, 0)),
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(`Lead insert failed for ${first} ${last}: ${error.message}`);
    leadIds.push({ id: lead.id, row });

    const template = service === "storm_damage" ? ANALYSIS_TEMPLATES.storm_damage : ANALYSIS_TEMPLATES.default;
    await supabase.from("lead_ai_analyses").insert({
      lead_id: lead.id,
      summary: `${first} ${last} submitted a ${service.replace(/_/g, " ")} request: ${description.slice(0, 160)}${description.length > 160 ? "…" : ""}${leak === "yes" ? " Active leaking reported — time-sensitive." : ""}`,
      urgency,
      urgency_reasoning: leak === "yes" ? "Homeowner reports active water intrusion, which can escalate quickly." : `Based on the stated timeframe (${timeframe}) and service type.`,
      lead_quality: quality,
      lead_quality_reasoning: quality === "hot" ? "Strong urgency, budget, or source signal suggests high intent." : quality === "cold" ? "Early research stage with no budget signal." : "Reasonable intent but timing or budget is still open.",
      recommended_next_action: template.next_action,
      recommended_contact_window: template.window,
      recommended_service_angle: template.angle,
      sales_questions: template.questions,
      potential_objections: ["Wants multiple quotes before deciding", "Unsure about total cost and financing", "Scheduling around work hours"],
      tags: [service, source, ...(leak === "yes" ? ["active_leak"] : []), ...(budget === "30k_plus" || budget === "15k_30k" ? ["high_value"] : [])],
      created_at: hoursAgo(Math.max(ageHours - 0.2, 0)),
    });

    await supabase.from("activities").insert([
      {
        lead_id: lead.id,
        type: "lead_created",
        title: "Lead submitted",
        description: `Submitted through the public request form (source: ${source}).`,
        created_at: hoursAgo(ageHours),
      },
      {
        lead_id: lead.id,
        type: "ai_analysis",
        title: "AI analysis completed",
        description: template.next_action,
        metadata: { urgency, lead_quality: quality },
        created_at: hoursAgo(Math.max(ageHours - 0.2, 0)),
      },
    ]);

    if (stage !== "new") {
      await supabase.from("activities").insert({
        lead_id: lead.id,
        user_id: profiles[assignedRole ?? "sales_rep"],
        type: "stage_change",
        title: `Stage updated to ${stage.replace(/_/g, " ")}`,
        created_at: hoursAgo(Math.max(ageHours - 6, 0)),
      });
    }
  }
  console.log(`✓ ${leadIds.length} leads with analyses and activities`);
  return leadIds;
}

async function seedTasks(profiles, leads) {
  const byName = (first) => leads.find((l) => l.row[0] === first)?.id ?? null;
  const tasks = [
    { lead: "Sarah", title: "Urgent: call storm/leak lead within 15 minutes", type: "call", priority: "urgent", status: "open", due: hoursFromNow(0.25), assigned: "sales_rep" },
    { lead: "Hector", title: "Call back: active kitchen ceiling leak", type: "call", priority: "urgent", status: "open", due: hoursAgo(2), assigned: "sales_rep" },
    { lead: "Devon", title: "Call hail lead and book inspection", type: "call", priority: "high", status: "open", due: hoursFromNow(1), assigned: "sales_rep" },
    { lead: "Ray", title: "Confirm tarp is holding before Thursday inspection", type: "call", priority: "high", status: "open", due: hoursFromNow(4), assigned: "sales_rep" },
    { lead: "Alyssa", title: "Follow up on roofing estimate", type: "estimate_followup", priority: "high", status: "open", due: hoursAgo(20), assigned: "sales_manager" },
    { lead: "Megan", title: "Follow up on window estimate (comparing 3 companies)", type: "estimate_followup", priority: "high", status: "open", due: hoursFromNow(6), assigned: "sales_manager" },
    { lead: "Grace", title: "High-value lead: call today", type: "call", priority: "high", status: "complete", due: daysAgo(5), completed: daysAgo(5), assigned: "sales_manager" },
    { lead: "Paul", title: "Re-engage: fiber cement siding quote went quiet", type: "call", priority: "medium", status: "open", due: hoursFromNow(8), assigned: "sales_manager" },
    { lead: "Sandra", title: "Send siding repair photos and revised options", type: "email", priority: "medium", status: "open", due: hoursAgo(30), assigned: "sales_rep" },
    { lead: "Janet", title: "Inspection visit: walk-in shower conversion", type: "inspection", priority: "medium", status: "open", due: hoursFromNow(26), assigned: "sales_manager" },
    { lead: "Nina", title: "Inspection visit: failed window seals", type: "inspection", priority: "medium", status: "open", due: hoursFromNow(30), assigned: "sales_rep" },
    { lead: "Robert", title: "Prep insurance documentation packet for adjuster meeting", type: "admin", priority: "high", status: "in_progress", due: hoursFromNow(20), assigned: "operations_manager" },
    { lead: "Christine", title: "Text accessibility brochure and example photos", type: "sms", priority: "medium", status: "complete", due: daysAgo(1), completed: daysAgo(1), assigned: "sales_rep" },
    { lead: null, title: "Manager review: negative review about appointment communication", type: "manager_review", priority: "high", status: "open", due: hoursFromNow(12), assigned: "sales_manager" },
    { lead: "Karen", title: "Email leaf protection pricing overview", type: "email", priority: "low", status: "open", due: hoursFromNow(48), assigned: "sales_rep" },
  ];
  for (const t of tasks) {
    await supabase.from("tasks").insert({
      lead_id: t.lead ? byName(t.lead) : null,
      assigned_to: profiles[t.assigned],
      title: t.title,
      description: null,
      type: t.type,
      priority: t.priority,
      status: t.status,
      due_at: t.due,
      completed_at: t.completed ?? null,
    });
  }
  console.log(`✓ ${tasks.length} tasks`);
}

async function seedFeedback() {
  const items = [
    { name: "Carol Hendricks", source: "google_review", rating: 5, text: "The crew was professional, cleaned everything up, and the project manager kept us informed the whole time.", sentiment: "positive", risk: "low", category: "crew_quality", praise: ["Professional crew", "Thorough cleanup", "Proactive communication"], complaints: [], quote: "Professional crew, spotless cleanup, and we always knew what was happening next." },
    { name: "Jim Padilla", source: "google_review", rating: 2, text: "The roof looks good, but communication before the appointment was frustrating. I had to call twice to confirm when someone was coming.", sentiment: "negative", risk: "high", category: "communication", praise: ["Quality of finished roof"], complaints: ["Had to call twice to confirm appointment", "No proactive communication before visit"], quote: null },
    { name: "Renee Ostrowski", source: "survey", rating: 4, text: "Sales process was easy and the estimate was clear. Install got pushed back twice, which was frustrating, but the final work looks great.", sentiment: "mixed", risk: "medium", category: "scheduling", praise: ["Easy sales process", "Clear estimate", "Quality final work"], complaints: ["Install rescheduled twice"], quote: null },
    { name: "Marcus Bell", source: "google_review", rating: 5, text: "Storm crew was out within a day of my call, tarped the roof, and walked me through the insurance paperwork. Took a lot of stress out of a bad week.", sentiment: "positive", risk: "low", category: "communication", praise: ["Fast storm response", "Helped with insurance paperwork"], complaints: [], quote: "They were out within a day and took the stress out of a bad week." },
    { name: "Tina Vu", source: "call_note", rating: null, text: "Customer called asking why the crew left scrap siding behind the garage. Wants it picked up this week. Otherwise happy with the install.", sentiment: "mixed", risk: "medium", category: "cleanup", praise: ["Happy with install"], complaints: ["Scrap material left behind garage"], quote: null },
    { name: "Allen Briggs", source: "survey", rating: 5, text: "Window install team was on time, fast, and the house already feels warmer. Would recommend to neighbors.", sentiment: "positive", risk: "low", category: "installation_quality", praise: ["On time", "Fast install", "Noticeable comfort improvement"], complaints: [], quote: "The house already feels warmer. Would recommend to neighbors." },
    { name: "Donna Kessler", source: "email", rating: null, text: "Your estimate came in 30% higher than two others and nobody explained what justified the difference. Felt like a generic quote.", sentiment: "negative", risk: "high", category: "pricing", praise: [], complaints: ["Estimate felt generic", "Price difference not explained"], quote: null },
    { name: "Pete Solberg", source: "google_review", rating: 3, text: "Gutter work is fine. Scheduling was easy. The crew showed up an hour late without a heads-up, which threw off my morning.", sentiment: "mixed", risk: "medium", category: "scheduling", praise: ["Easy scheduling", "Solid gutter work"], complaints: ["Crew arrived an hour late without notice"], quote: null },
  ];
  let i = 0;
  for (const f of items) {
    await supabase.from("feedback").insert({
      customer_name: f.name,
      source: f.source,
      rating: f.rating,
      feedback_text: f.text,
      sentiment: f.sentiment,
      risk_level: f.risk,
      summary: f.text.length > 120 ? f.text.slice(0, 117) + "…" : f.text,
      key_praise: f.praise,
      key_complaints: f.complaints,
      operational_category: f.category,
      suggested_internal_action:
        f.sentiment === "negative"
          ? "Manager should contact the customer within one business day and review the process gap with the team."
          : f.sentiment === "mixed"
            ? "Address the specific complaint and confirm resolution with the customer."
            : "Thank the customer and request permission to use as a testimonial.",
      suggested_customer_response:
        f.sentiment === "negative" || f.sentiment === "mixed"
          ? "Thank you for the honest feedback — we're sorry the experience wasn't smooth. A manager will reach out directly to make it right."
          : "Thank you for the kind words! We'll share this with the crew — it means a lot.",
      marketing_quote_opportunity: f.quote,
      tags: [f.sentiment, f.category],
      created_at: daysAgo(2 + i * 4),
    });
    i += 1;
  }
  console.log(`✓ ${items.length} feedback records`);
}

async function main() {
  console.log("Seeding Home Service AI Command Center demo data…\n");
  const profiles = await ensureUsers();
  await clearOperationalData();
  const leads = await seedLeads(profiles);
  await seedTasks(profiles, leads);
  await seedFeedback();
  console.log("\nDone. Log in with admin@northstar-demo.com / demo-password");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
