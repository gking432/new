import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallSummaryCard } from "@/components/calls/CallSummaryCard";
import { CallTranscriptPanel } from "@/components/calls/CallTranscriptPanel";
import { getCallDetail } from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const call = await getCallDetail(supabase, id);
  if (!call) notFound();

  const name =
    call.direction === "inbound"
      ? (call.caller_name ?? "Unknown caller")
      : (call.callee_name ?? "Homeowner");
  const phone = call.direction === "inbound" ? call.caller_phone : call.callee_phone;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/calls">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {call.direction === "inbound" ? (
              <PhoneIncoming className="h-5 w-5 text-primary" />
            ) : (
              <PhoneOutgoing className="h-5 w-5 text-primary" />
            )}
            <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
            <Badge variant="secondary" className="capitalize">
              {call.scenario.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {call.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {phone ? `${phone} · ` : ""}
            {formatDateTime(call.created_at)}
            {call.duration_seconds
              ? ` · ${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, "0")} long`
              : ""}
            {call.ai_status === "fallback" ? " · rule-based summary" : ""}
          </p>
        </div>
        {call.lead && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/leads/${call.lead.id}`}>
              Open lead: {call.lead.first_name} {call.lead.last_name}
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {call.summary ? (
            <CallSummaryCard summary={call.summary} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No summary was generated for this call
                {call.status === "missed" ? " — it was declined or missed." : "."}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcript</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {call.transcript ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    The full transcript is stored separately from the CRM note and opens in a
                    searchable viewer.
                  </p>
                  <CallTranscriptPanel transcript={call.transcript} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No transcript captured.</p>
              )}
            </CardContent>
          </Card>

          {call.summary && call.summary.recommended_tasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommended tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {call.summary.recommended_tasks.map((task) => (
                    <li key={task.title} className="rounded-md border p-2.5 text-sm">
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {task.priority} · due in {task.due_in_minutes} min
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
