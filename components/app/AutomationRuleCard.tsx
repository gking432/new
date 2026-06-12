"use client";

import { useState, useTransition } from "react";
import { FlaskConical, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { testAutomationRule, toggleAutomationRule } from "@/lib/actions";
import { formatRelative } from "@/lib/utils/format";
import type { AutomationCondition, AutomationRule } from "@/types/app";

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "When a lead is created",
  stage_changed_to_estimate_sent: "When a lead moves to Estimate Sent",
  feedback_submitted: "When customer feedback is submitted",
};

const FIELD_LABELS: Record<string, string> = {
  service_type: "service type",
  active_leak: "active leak",
  timeframe: "timeframe",
  source: "source",
  budget_min: "budget (minimum)",
  sentiment: "sentiment",
  rating: "rating",
};

function describeCondition(condition: AutomationCondition) {
  const field = FIELD_LABELS[condition.field] ?? condition.field.replace(/_/g, " ");
  const value = Array.isArray(condition.value)
    ? condition.value.join(" or ")
    : String(condition.value);
  switch (condition.op) {
    case "eq":
      return `${field} is ${value}`;
    case "neq":
      return `${field} is not ${value}`;
    case "in":
      return `${field} is ${value}`;
    case "gte":
      return `${field} is at least ${Number(condition.value).toLocaleString()}`;
    case "lte":
      return `${field} is at most ${value}`;
    case "contains":
      return `${field} contains "${value}"`;
    default:
      return `${field} ${condition.op} ${value}`;
  }
}

function describeConditions(rule: AutomationRule) {
  const parts: string[] = [];
  if (rule.conditions.all?.length) {
    parts.push(rule.conditions.all.map(describeCondition).join(" AND "));
  }
  if (rule.conditions.any?.length) {
    parts.push(rule.conditions.any.map(describeCondition).join(" OR "));
  }
  return parts.length > 0 ? parts.join(", and ") : "Always (no conditions)";
}

function describeAction(action: AutomationRule["actions"][number]) {
  switch (action.type) {
    case "create_task":
      return `Create ${action.priority ?? "medium"}-priority ${String(
        action.task_type ?? "call"
      ).replace(/_/g, " ")} task: "${action.title}"`;
    case "set_lead_quality":
      return `Tag lead as ${action.value}`;
    case "set_urgency":
      return `Set urgency to ${action.value}`;
    case "assign_role":
      return `Assign lead to the ${String(action.role).replace(/_/g, " ")}`;
    case "set_risk_level":
      return `Flag feedback risk level as ${action.value}`;
    case "add_tag":
      return `Tag as ${action.value}`;
    case "log_note":
      return `Log note: ${action.message}`;
    default:
      return action.type;
  }
}

export function AutomationRuleCard({ rule }: { rule: AutomationRule }) {
  const [active, setActive] = useState(rule.is_active);
  const [testing, setTesting] = useState(false);
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    setActive(next);
    startTransition(async () => {
      const result = await toggleAutomationRule(rule.id, next);
      if (result.success) {
        toast.success(`Rule ${next ? "activated" : "deactivated"}`);
      } else {
        setActive(!next);
        toast.error(result.error);
      }
    });
  }

  async function runTest() {
    setTesting(true);
    const result = await testAutomationRule(rule.id);
    setTesting(false);
    if (result.success && result.data) {
      if (result.data.status === "success") {
        toast.success(
          `Rule fired. ${result.data.actionsTaken.length} action(s): ${result.data.actionsTaken.join("; ")}`
        );
      } else {
        toast.info(
          "Rule evaluated but conditions did not match the most recent record — logged as skipped."
        );
      }
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  return (
    <Card className={!active ? "opacity-70" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-brand-gold" />
              {rule.name}
            </CardTitle>
            {rule.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
            ) : null}
          </div>
          <Switch checked={active} onCheckedChange={toggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Trigger
            </p>
            <p className="mt-1">{TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conditions
            </p>
            <p className="mt-1">{describeConditions(rule)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {rule.actions.map((action, index) => (
                <li key={index}>{describeAction(action)}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs">
              Triggered {rule.times_triggered}×
            </Badge>
            {rule.last_triggered_at ? (
              <span>Last run {formatRelative(rule.last_triggered_at)}</span>
            ) : (
              <span>Never run</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={runTest} disabled={testing || !active}>
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FlaskConical className="h-3.5 w-3.5" />
            )}
            Run test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
