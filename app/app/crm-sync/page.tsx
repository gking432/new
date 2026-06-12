import { Cable, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadSyncPanel } from "@/components/crm-sync/LeadSyncPanel";
import { HUBSPOT_FIELD_MAPPING } from "@/lib/integrations/hubspot/client";
import { getCrmConnection, getCrmSyncEvents } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatRelative } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const EVENT_STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  dry_run: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-amber-100 text-amber-800",
  skipped: "bg-secondary text-muted-foreground",
};

export default async function CrmSyncPage() {
  const supabase = await createClient();
  const [connection, events, leadsRes] = await Promise.all([
    getCrmConnection(supabase),
    getCrmSyncEvents(supabase),
    supabase
      .from("leads")
      .select("id, first_name, last_name, service_type, stage, urgency")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const liveConfigured = process.env.ENABLE_HUBSPOT_LIVE_SYNC === "true" && Boolean(process.env.HUBSPOT_PRIVATE_APP_TOKEN);
  const mode = liveConfigured ? "live" : "dry_run";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">CRM Sync</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          This demo includes a lightweight CRM interface so the workflow can be shown end-to-end.
          In a real implementation, the same AI-generated summaries, tasks, lead scores,
          appointments, and notes can be pushed into an existing CRM through APIs or webhooks.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Two ways to run it</AlertTitle>
        <AlertDescription>
          Use this system as the primary workspace, or use it as an AI layer that keeps your
          current CRM cleaner and more up to date.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connection status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cable className="h-4 w-4 text-primary" />
              Connection status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{connection?.name ?? "HubSpot"}</p>
                <p className="text-xs text-muted-foreground">
                  Provider: HubSpot · Private app token{" "}
                  {process.env.HUBSPOT_PRIVATE_APP_TOKEN ? "configured" : "not configured"}
                </p>
              </div>
              <Badge
                className={mode === "live" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}
                variant="secondary"
              >
                {mode === "live" ? "Live" : "Dry-run mode"}
              </Badge>
            </div>
            {mode === "dry_run" && (
              <p className="text-xs text-muted-foreground">
                External CRM sync is in dry-run mode: every sync builds the real payload, logs it
                below with mock HubSpot IDs, and touches nothing external. Add
                <code className="mx-1 rounded bg-secondary px-1 py-0.5">HUBSPOT_PRIVATE_APP_TOKEN</code>
                and set
                <code className="mx-1 rounded bg-secondary px-1 py-0.5">ENABLE_HUBSPOT_LIVE_SYNC=true</code>
                to sync for real.
              </p>
            )}
            {connection?.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                Last sync: {formatRelative(connection.last_sync_at)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Field mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Field mapping</CardTitle>
            <CardDescription>
              If a custom HubSpot property doesn&apos;t exist in the portal, the detail is carried
              in the note body instead of failing the sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local field</TableHead>
                  <TableHead>External CRM field</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HUBSPOT_FIELD_MAPPING.map((row) => (
                  <TableRow key={row.local}>
                    <TableCell className="font-mono text-xs">{row.local}</TableCell>
                    <TableCell className="font-mono text-xs">{row.external}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <LeadSyncPanel leads={leadsRes.data ?? []} />

      {/* Sync events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent sync events</CardTitle>
          <CardDescription>Every outbound sync attempt is logged — dry runs included.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sync events yet. Sync a lead above or run the HubSpot dry sync from the Demo
              Center.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">{event.action.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm capitalize">{event.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{event.external_id ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={EVENT_STATUS_STYLES[event.status]} variant="secondary">
                        {event.status.replace(/_/g, " ")}
                      </Badge>
                      {event.error_message && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-red-600">
                          {event.error_message}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
