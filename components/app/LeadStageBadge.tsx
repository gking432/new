import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STAGE_STYLES } from "@/lib/utils/statuses";
import type { LeadStage } from "@/types/app";

export function LeadStageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  const style = STAGE_STYLES[stage] ?? STAGE_STYLES.new;
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      {style.label}
    </Badge>
  );
}
