import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AutomationAction,
  AutomationCondition,
  AutomationConditions,
  AutomationRule,
  Feedback,
  Lead,
} from "@/types/app";

/**
 * Evaluates stored automation rules against an event and executes their
 * actions. Actions write real records (tasks, lead updates, activity log)
 * and every evaluation is recorded in automation_runs so the Automations
 * page can show an auditable history.
 */

export interface AutomationContext {
  lead?: Lead | null;
  feedback?: Feedback | null;
}

export interface AutomationResult {
  ruleId: string;
  ruleName: string;
  status: "success" | "failed" | "skipped";
  actionsTaken: string[];
  error?: string;
}

const BUDGET_MIN_VALUES: Record<string, number> = {
  under_5k: 0,
  "5k_15k": 5000,
  "15k_30k": 15000,
  "30k_plus": 30000,
  not_sure: 0,
};

function resolveField(field: string, ctx: AutomationContext): unknown {
  if (field === "budget_min" && ctx.lead) {
    return BUDGET_MIN_VALUES[ctx.lead.budget_range ?? "not_sure"] ?? 0;
  }
  if (ctx.lead && field in ctx.lead) {
    return ctx.lead[field as keyof Lead];
  }
  if (ctx.feedback && field in ctx.feedback) {
    return ctx.feedback[field as keyof Feedback];
  }
  return undefined;
}

function evaluateCondition(condition: AutomationCondition, ctx: AutomationContext): boolean {
  const actual = resolveField(condition.field, ctx);
  switch (condition.op) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(String(actual));
    case "gte":
      return typeof actual === "number" && actual >= Number(condition.value);
    case "lte":
      return typeof actual === "number" && actual <= Number(condition.value);
    case "contains":
      return typeof actual === "string" &&
        actual.toLowerCase().includes(String(condition.value).toLowerCase());
    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: AutomationConditions,
  ctx: AutomationContext
): boolean {
  const allPass = !conditions.all || conditions.all.every((c) => evaluateCondition(c, ctx));
  const anyPass = !conditions.any || conditions.any.some((c) => evaluateCondition(c, ctx));
  return allPass && anyPass;
}

async function executeAction(
  supabase: SupabaseClient,
  action: AutomationAction,
  ctx: AutomationContext,
  ruleName: string
): Promise<string> {
  const leadId = ctx.lead?.id ?? null;

  switch (action.type) {
    case "create_task": {
      const dueInMinutes = Number(action.due_in_minutes ?? 60);
      const dueAt = new Date(Date.now() + dueInMinutes * 60_000).toISOString();
      let assignedTo: string | null = null;
      if (action.assign_role) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", action.assign_role)
          .limit(1)
          .maybeSingle();
        assignedTo = profile?.id ?? null;
      }
      await supabase.from("tasks").insert({
        lead_id: leadId,
        assigned_to: assignedTo,
        title: String(action.title ?? "Automation task"),
        description: String(action.description ?? `Created by automation rule "${ruleName}"`),
        type: (action.task_type as string) ?? "call",
        priority: (action.priority as string) ?? "medium",
        status: "open",
        due_at: dueAt,
      });
      return `Created ${action.priority ?? "medium"}-priority ${action.task_type ?? "call"} task: "${action.title}"`;
    }
    case "set_lead_quality": {
      if (!leadId) return "Skipped set_lead_quality: no lead in context";
      await supabase.from("leads").update({ lead_quality: action.value }).eq("id", leadId);
      return `Set lead quality to ${action.value}`;
    }
    case "set_urgency": {
      if (!leadId) return "Skipped set_urgency: no lead in context";
      await supabase.from("leads").update({ urgency: action.value }).eq("id", leadId);
      return `Set urgency to ${action.value}`;
    }
    case "assign_role": {
      if (!leadId) return "Skipped assign_role: no lead in context";
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", action.role)
        .limit(1)
        .maybeSingle();
      if (!profile) return `No user with role ${action.role} found to assign`;
      await supabase.from("leads").update({ assigned_to: profile.id }).eq("id", leadId);
      return `Assigned lead to ${profile.full_name}`;
    }
    case "set_risk_level": {
      if (!ctx.feedback?.id) return "Skipped set_risk_level: no feedback in context";
      await supabase
        .from("feedback")
        .update({ risk_level: action.value })
        .eq("id", ctx.feedback.id);
      return `Set feedback risk level to ${action.value}`;
    }
    case "add_tag":
    case "log_note": {
      const message = String(action.message ?? action.value ?? "");
      await supabase.from("activities").insert({
        lead_id: leadId,
        type: "automation",
        title: action.type === "add_tag" ? `Tagged: ${action.value}` : "Automation note",
        description: message || `Rule "${ruleName}" triggered`,
        metadata: { rule: ruleName, action: action.type, value: action.value ?? null },
      });
      return action.type === "add_tag" ? `Tagged lead as ${action.value}` : `Logged note: ${message}`;
    }
    default:
      return `Unknown action type: ${(action as { type: string }).type}`;
  }
}

export async function runAutomationRules(
  supabase: SupabaseClient,
  triggerEvent: string,
  ctx: AutomationContext
): Promise<AutomationResult[]> {
  const { data: settings } = await supabase
    .from("company_settings")
    .select("automations_enabled")
    .limit(1)
    .maybeSingle();
  if (settings && settings.automations_enabled === false) {
    return [];
  }

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("trigger_event", triggerEvent)
    .eq("is_active", true);

  const results: AutomationResult[] = [];

  for (const rule of (rules ?? []) as AutomationRule[]) {
    const base = {
      rule_id: rule.id,
      lead_id: ctx.lead?.id ?? null,
      feedback_id: ctx.feedback?.id ?? null,
      trigger_event: triggerEvent,
    };

    try {
      if (!evaluateConditions(rule.conditions ?? {}, ctx)) {
        await supabase.from("automation_runs").insert({
          ...base,
          status: "skipped",
          actions_taken: [],
        });
        results.push({ ruleId: rule.id, ruleName: rule.name, status: "skipped", actionsTaken: [] });
        continue;
      }

      const actionsTaken: string[] = [];
      for (const action of rule.actions ?? []) {
        actionsTaken.push(await executeAction(supabase, action, ctx, rule.name));
      }

      await supabase.from("automation_runs").insert({
        ...base,
        status: "success",
        actions_taken: actionsTaken,
      });
      await supabase
        .from("automation_rules")
        .update({
          times_triggered: (rule.times_triggered ?? 0) + 1,
          last_triggered_at: new Date().toISOString(),
        })
        .eq("id", rule.id);

      if (ctx.lead?.id) {
        await supabase.from("activities").insert({
          lead_id: ctx.lead.id,
          type: "automation",
          title: `Automation rule triggered: ${rule.name}`,
          description: actionsTaken.join(" · "),
          metadata: { rule_id: rule.id, trigger: triggerEvent },
        });
      }

      results.push({ ruleId: rule.id, ruleName: rule.name, status: "success", actionsTaken });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await supabase.from("automation_runs").insert({
        ...base,
        status: "failed",
        actions_taken: [],
        error_message: message,
      });
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: "failed",
        actionsTaken: [],
        error: message,
      });
    }
  }

  return results;
}
