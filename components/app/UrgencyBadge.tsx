import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { URGENCY_STYLES } from "@/lib/utils/statuses";
import type { Urgency } from "@/types/app";

export function UrgencyBadge({ urgency, className }: { urgency: Urgency; className?: string }) {
  const style = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.medium;
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      {style.label}
    </Badge>
  );
}
