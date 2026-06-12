"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cable, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { syncLeadToHubSpot, type SyncResult } from "@/lib/actions/crm";

interface SyncableLead {
  id: string;
  first_name: string;
  last_name: string;
  service_type: string;
  stage: string;
  urgency: string;
}

export function LeadSyncPanel({ leads }: { leads: SyncableLead[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  function sync(leadId: string) {
    setBusyId(leadId);
    startTransition(async () => {
      const response = await syncLeadToHubSpot(leadId);
      setBusyId(null);
      if (response.success) {
        setResult(response.data);
        toast.success(
          response.data.mode === "dry_run"
            ? "Dry run successful — no external CRM was updated"
            : "Synced to HubSpot"
        );
        router.refresh();
      } else {
        toast.error(response.error);
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads ready to sync</CardTitle>
          <CardDescription>
            Each sync creates/updates the HubSpot contact, creates the deal, and attaches the AI
            summary as a note. The full payload is logged either way.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <Link href={`/app/leads/${lead.id}`} className="text-sm font-medium hover:underline">
                  {lead.first_name} {lead.last_name}
                </Link>
                <p className="text-xs text-muted-foreground capitalize">
                  {lead.service_type.replace(/_/g, " ")} · {lead.stage.replace(/_/g, " ")} ·{" "}
                  {lead.urgency}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => sync(lead.id)}
              >
                {busyId === lead.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Cable className="h-3.5 w-3.5" />
                )}
                Sync to HubSpot
              </Button>
            </div>
          ))}
          {leads.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No leads yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={result !== null} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-status-success" />
              {result?.mode === "dry_run" ? "Dry run successful" : "Live sync complete"}
            </DialogTitle>
            <DialogDescription>
              {result?.mode === "dry_run"
                ? "This is exactly what would be sent to HubSpot. No external CRM was updated."
                : "The records below were created in your HubSpot portal."}
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Contact: {result.contactId}</Badge>
                <Badge variant="secondary">Deal: {result.dealId}</Badge>
                <Badge variant="secondary">Note: {result.noteId}</Badge>
              </div>
              {(["contact", "deal", "note"] as const).map((key) => (
                <div key={key}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {key} payload
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-brand-dark p-3 text-xs text-emerald-200/90">
                    {JSON.stringify(result.payload[key], null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
