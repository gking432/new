"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLeadStage } from "@/lib/actions";
import { LEAD_STAGES, STAGE_STYLES } from "@/lib/utils/statuses";
import type { LeadStage } from "@/types/app";

export function LeadStageSelect({
  leadId,
  stage,
  size = "default",
}: {
  leadId: string;
  stage: LeadStage;
  size?: "default" | "sm";
}) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    startTransition(async () => {
      const result = await updateLeadStage(leadId, value);
      if (result.success) toast.success(`Stage updated to ${STAGE_STYLES[value as LeadStage].label}`);
      else toast.error(result.error);
    });
  }

  return (
    <Select value={stage} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className={size === "sm" ? "h-7 w-auto gap-1 px-2 text-xs" : "w-auto gap-2"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STAGES.map((value) => (
          <SelectItem key={value} value={value}>
            {STAGE_STYLES[value].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
