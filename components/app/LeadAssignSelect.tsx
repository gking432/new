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
import { assignLead } from "@/lib/actions";
import type { Profile } from "@/types/app";

const UNASSIGNED = "__unassigned__";

export function LeadAssignSelect({
  leadId,
  assignedTo,
  profiles,
}: {
  leadId: string;
  assignedTo: string | null;
  profiles: Profile[];
}) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    startTransition(async () => {
      const result = await assignLead(leadId, value === UNASSIGNED ? null : value);
      if (result.success) toast.success("Assignment updated");
      else toast.error(result.error);
    });
  }

  return (
    <Select value={assignedTo ?? UNASSIGNED} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-auto gap-2">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {profiles.map((profile) => (
          <SelectItem key={profile.id} value={profile.id}>
            {profile.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
