"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cable, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncLeadToHubSpot } from "@/lib/actions/crm";

export function SyncLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setDone] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncLeadToHubSpot(leadId);
          if (result.success) {
            setDone(true);
            toast.success(
              result.data.mode === "dry_run"
                ? "Dry run successful — payload logged in CRM Sync, no external CRM updated"
                : "Synced to HubSpot"
            );
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cable className="h-3.5 w-3.5" />}
      Sync to HubSpot
    </Button>
  );
}
