import Link from "next/link";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCalls } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";
import { isLocalDemoMode } from "@/lib/demo/mode";
import { getLocalCalls } from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  scripted_fallback: "bg-blue-100 text-blue-800",
  missed: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  ringing: "bg-secondary text-secondary-foreground",
  connected: "bg-emerald-100 text-emerald-800",
  created: "bg-secondary text-secondary-foreground",
};

export default async function CallsPage() {
  const calls = isLocalDemoMode() ? await getLocalCalls() : await getCalls(await createClient());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>AI Call Log</CardTitle>
            <CardDescription>
              Every simulated call, its AI summary, and the hidden full transcript. Run new call
              demos from the Demo Center.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/demo-center">
              <Phone className="h-3.5 w-3.5" />
              Run a call demo
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No calls yet. Open the{" "}
              <Link href="/app/demo-center" className="font-medium text-primary underline">
                Demo Center
              </Link>{" "}
              to simulate an inbound call, a customer callback, or a speed-to-lead call.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Call</TableHead>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => {
                  const name =
                    call.direction === "inbound"
                      ? (call.caller_name ?? "Unknown caller")
                      : (call.callee_name ?? "Homeowner");
                  return (
                    <TableRow key={call.id}>
                      <TableCell>
                        <Link
                          href={`/app/calls/${call.id}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          {call.status === "missed" ? (
                            <PhoneMissed className="h-4 w-4 text-amber-600" />
                          ) : call.direction === "inbound" ? (
                            <PhoneIncoming className="h-4 w-4 text-primary" />
                          ) : (
                            <PhoneOutgoing className="h-4 w-4 text-primary" />
                          )}
                          {name}
                        </Link>
                        {call.summary?.summary && (
                          <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">
                            {call.summary.summary}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {call.scenario.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {call.lead ? (
                          <Link href={`/app/leads/${call.lead.id}`} className="hover:underline">
                            {call.lead.first_name} {call.lead.last_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[call.status] ?? ""} variant="secondary">
                          {call.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {call.duration_seconds
                          ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, "0")}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(call.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
