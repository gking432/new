"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Check,
  FileText,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  approveCommunication,
  discardCommunication,
  simulateSendCommunication,
} from "@/lib/actions/inbox";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/format";
import type { CommunicationWithLead } from "@/types/app";

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: MessageSquareText,
  email: Mail,
  call: Phone,
  form: FileText,
  crm_import: FileText,
  manual: FileText,
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  simulated_sent: "bg-green-100 text-green-800",
  sent: "bg-green-100 text-green-800",
  received: "bg-secondary text-secondary-foreground",
  failed: "bg-red-100 text-red-800",
  discarded: "bg-secondary text-muted-foreground",
};

export function InboxView({ communications }: { communications: CommunicationWithLead[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(communications[0]?.id ?? null);
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = communications.filter((c) => c.status !== "discarded");
    if (tab === "approvals") {
      list = list.filter(
        (c) => c.direction === "outbound" && (c.status === "draft" || c.status === "approved")
      );
    }
    if (channelFilter) list = list.filter((c) => c.channel === channelFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.body?.toLowerCase().includes(term) ||
          c.subject?.toLowerCase().includes(term) ||
          c.from_value?.toLowerCase().includes(term) ||
          `${c.lead?.first_name ?? ""} ${c.lead?.last_name ?? ""}`.toLowerCase().includes(term)
      );
    }
    return list;
  }, [communications, tab, channelFilter, search]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const approvalsCount = communications.filter(
    (c) => c.direction === "outbound" && c.status === "draft"
  ).length;

  function runAction(action: () => Promise<{ success: boolean; error?: string }>, okMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(okMessage);
        setEditedBody(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Action failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All messages</TabsTrigger>
            <TabsTrigger value="approvals">
              Approval queue
              {approvalsCount > 0 && (
                <Badge className="ml-1.5 bg-amber-100 text-amber-800" variant="secondary">
                  {approvalsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5">
          {["call", "sms", "email", "form"].map((channel) => (
            <Button
              key={channel}
              variant={channelFilter === channel ? "default" : "outline"}
              size="sm"
              onClick={() => setChannelFilter(channelFilter === channel ? null : channel)}
              className="capitalize"
            >
              {channel}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search customer or message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Message list */}
        <Card className="lg:col-span-2">
          <CardContent className="max-h-[65vh] space-y-1 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                No messages match. Use the Demo Center to simulate an inbound text or email.
              </p>
            ) : (
              filtered.map((comm) => {
                const Icon = CHANNEL_ICONS[comm.channel] ?? FileText;
                return (
                  <button
                    key={comm.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(comm.id);
                      setEditedBody(null);
                    }}
                    className={cn(
                      "w-full rounded-md p-3 text-left transition-colors hover:bg-secondary/70",
                      selected?.id === comm.id && "bg-secondary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {comm.direction === "inbound" ? (
                        <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {comm.lead
                          ? `${comm.lead.first_name} ${comm.lead.last_name}`
                          : (comm.from_value ?? "Unknown")}
                      </span>
                      <Badge className={cn("text-[10px]", STATUS_STYLES[comm.status])} variant="secondary">
                        {comm.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {comm.subject ? `${comm.subject} — ` : ""}
                      {comm.body}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {formatRelative(comm.created_at)}
                      {comm.ai_generated ? " · AI draft" : ""}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card className="lg:col-span-3">
          {selected ? (
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">
                  {selected.subject ??
                    `${selected.channel.toUpperCase()} ${selected.direction === "inbound" ? "from" : "to"} ${
                      selected.direction === "inbound"
                        ? (selected.from_value ?? "unknown")
                        : (selected.to_value ?? "customer")
                    }`}
                </h3>
                <Badge className={STATUS_STYLES[selected.status]} variant="secondary">
                  {selected.status.replace(/_/g, " ")}
                </Badge>
                {selected.ai_generated && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Bot className="h-3 w-3" />
                    AI draft — human approval required
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {selected.from_value && <span>From: {selected.from_value} · </span>}
                {selected.to_value && <span>To: {selected.to_value} · </span>}
                {formatRelative(selected.created_at)}
              </div>

              {selected.status === "draft" && selected.direction === "outbound" ? (
                <Textarea
                  value={editedBody ?? selected.body ?? ""}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={7}
                />
              ) : (
                <div className="whitespace-pre-wrap rounded-lg border bg-secondary/30 p-3 text-sm">
                  {selected.body}
                </div>
              )}

              {selected.ai_summary && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
                    <Bot className="h-3.5 w-3.5" />
                    AI summary
                  </p>
                  <p className="mt-1 text-sm">{selected.ai_summary}</p>
                  {selected.suggested_next_action && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Suggested next action: {selected.suggested_next_action}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-4">
                {selected.status === "draft" && selected.direction === "outbound" && (
                  <>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        runAction(
                          () => approveCommunication(selected.id, editedBody ?? undefined),
                          "Draft approved"
                        )
                      }
                    >
                      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        runAction(() => discardCommunication(selected.id), "Draft discarded")
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Discard
                    </Button>
                  </>
                )}
                {selected.status === "approved" && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        () => simulateSendCommunication(selected.id),
                        "Send simulated (demo mode — nothing real was sent)"
                      )
                    }
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Simulate send
                  </Button>
                )}
                {selected.lead && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/app/leads/${selected.lead.id}`}>Open lead</Link>
                  </Button>
                )}
                {selected.call_id && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/app/calls/${selected.call_id}`}>View call</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          ) : (
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Select a message to view it.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
