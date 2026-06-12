import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "urgent" | "success";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-semibold tracking-tight",
              tone === "urgent" && "text-status-urgent",
              tone === "success" && "text-status-success"
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            tone === "urgent"
              ? "bg-red-50 text-status-urgent"
              : tone === "success"
                ? "bg-green-50 text-status-success"
                : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  );
}
