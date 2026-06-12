import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QUALITY_STYLES } from "@/lib/utils/statuses";
import type { LeadQuality } from "@/types/app";

export function QualityBadge({ quality, className }: { quality: LeadQuality; className?: string }) {
  const style = QUALITY_STYLES[quality] ?? QUALITY_STYLES.warm;
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      {style.label}
    </Badge>
  );
}
