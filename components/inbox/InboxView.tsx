"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
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

export function InboxView({ communications }: { communications: CommunicationWithLead[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("messages");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const live = communications.filter((c) => c.status !== "discarded");

  // The left list shows conversations, not raw rows: inbound messages and
  // calls. Outbound drafts/sends appear inside the thread on the right.
  const listItems = useMemo(() => {
    let list =
      tab === "approvals"
        ? live.filter((c) => c.direction === "outbound" && c.status === "draft")
        : live.filter((c) => c.direction === "inbound" || c.channel === "call");
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
  }, [live, tab, channelFilter, search]);

  const selected = listItems.find((c) => c.id === selectedId) ?? listItems[0] ?? null;

  // Thread for the selected conversation: every message on the same channel
  // for the same lead (or same phone/email when unmatched), oldest first.
  const thread = useMemo(() => {
    if (!selected || selected.channel === "call") return [];
    return live
      .filter((c) => {
        if (c.channel !== selected.channel) return false;
        if (selected.lead_id) return c.lead_id === selected.lead_id;
        const key = selected.direction === "inbound" ? selected.from_value : selected.to_value;
        return c.from_value === key || c.to_value === key;
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [live, selected]);

  const pendingDraft = thread.find((c) => c.direction === "outbound" && c.status === "draft");
  const approvalsCount = live.filter(
    (c) => c.direction === "outbound" && c.status === "draft"
  ).length;

  function approveAndSend(draftId: string) {
    startTransition(async () => {
      const approved = await approveCommunication(draftId, editedBody ?? undefined);
      if (!approved.success) {
        toast.error(approved.error ?? "Approval failed");
        return;
      }
      const sent = await simulateSendCommunication(draftId);
      if (sent.success) {
        toast.success("Approved & sent (simulated — nothing real was sent)");
        setEditedBody(null);
        router.refresh();
      } else {
        toast.error(sent.error ?? "Send failed");
      }
    });
  }

  function discard(draftId: string) {
    startTransition(async () => {
      const result = await discardCommunication(draftId);
      if (result.success) {
        toast.success("Draft discarded");
        setEditedBody(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Discard failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="messages">Conversations</TabsTrigger>
            <TabsTrigger value="approvals">
              Approval queue
              {approvalsCount > 0 && (
                <Badge className="ml-1.5 bg-red-500 text-white" variant="secondary">
                  {approvalsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5">
          {["call", "sms", "email"].map((channel) => (
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
        {/* Conversation list */}
        <Card className="lg:col-span-2">
          <CardContent className="max-h-[68vh] space-y-1 overflow-y-auto p-2">
            {listItems.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                Nothing here yet. Use the Demo Center to simulate an inbound text or email.
              </p>
            ) : (
              listItems.map((comm) => {
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
                      {tab === "approvals" && (
                        <Badge className="bg-amber-100 text-amber-800 text-[10px]" variant="secondary">
                          needs approval
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {comm.subject ? `${comm.subject} — ` : ""}
                      {comm.body}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {formatRelative(comm.created_at)}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Conversation detail */}
        <Card className="lg:col-span-3">
          {selected ? (
            <CardContent className="flex max-h-[68vh] flex-col p-0">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <h3 className="text-base font-semibold">
                  {selected.lead
                    ? `${selected.lead.first_name} ${selected.lead.last_name}`
                    : (selected.from_value ?? "Unknown")}
                </h3>
                <Badge variant="secondary" className="capitalize">
                  {selected.channel}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {selected.direction === "inbound"
                    ? selected.from_value
                    : selected.to_value}
                </span>
                <span className="flex-1" />
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

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {selected.channel === "call" ? (
                  <div className="space-y-3">
                    <div className="whitespace-pre-wrap rounded-lg border bg-secondary/30 p-3 text-sm">
                      {selected.body}
                    </div>
                    {selected.ai_summary && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
                          <Bot className="h-3.5 w-3.5" />
                          AI call note
                        </p>
                        <p className="mt-1 text-sm">{selected.ai_summary}</p>
                      </div>
                    )}
                  </div>
                ) : selected.channel === "sms" ? (
                  /* iMessage-style thread */
                  <div className="space-y-2">
                    {thread
                      .filter((c) => c.status !== "draft")
                      .map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.direction === "inbound" ? "justify-start" : "justify-end"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                              msg.direction === "inbound"
                                ? "rounded-bl-sm bg-secondary"
                                : "rounded-br-sm bg-primary text-primary-foreground"
                            )}
                          >
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                            <p
                              className={cn(
                                "mt-1 text-[10px]",
                                msg.direction === "inbound"
                                  ? "text-muted-foreground"
                                  : "text-primary-foreground/60"
                              )}
                            >
                              {formatRelative(msg.created_at)}
                              {msg.status === "simulated_sent" ? " · sent (simulated)" : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  /* Email thread */
                  <div className="space-y-3">
                    {thread
                      .filter((c) => c.status !== "draft")
                      .map((msg) => (
                        <div key={msg.id} className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">
                            {msg.direction === "inbound" ? "From" : "To"}:{" "}
                            {msg.direction === "inbound" ? msg.from_value : msg.to_value} ·{" "}
                            {formatRelative(msg.created_at)}
                            {msg.status === "simulated_sent" ? " · sent (simulated)" : ""}
                          </p>
                          {msg.subject && <p className="mt-1 text-sm font-medium">{msg.subject}</p>}
                          <p className="mt-1.5 whitespace-pre-wrap text-sm">{msg.body}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* AI draft composer */}
              {pendingDraft && (
                <div className="border-t bg-secondary/30 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                    AI-drafted reply — review before sending
                    {pendingDraft.subject && selected.channel === "email" && (
                      <span className="normal-case">· {pendingDraft.subject}</span>
                    )}
                  </p>
                  <Textarea
                    value={editedBody ?? pendingDraft.body ?? ""}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={selected.channel === "email" ? 7 : 4}
                    className="bg-background"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" disabled={pending} onClick={() => approveAndSend(pendingDraft.id)}>
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Approve &amp; send (simulated)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => discard(pendingDraft.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Discard
                    </Button>
                    <span className="self-center text-[11px] text-muted-foreground">
                      Demo mode — nothing real is sent.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          ) : (
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Select a conversation to view it.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
