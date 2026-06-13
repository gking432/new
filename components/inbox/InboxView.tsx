"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Bot, Loader2, Mail, MessageSquareText, Send, Trash2 } from "lucide-react";
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
};

interface Conversation {
  key: string;
  channel: "sms" | "email";
  lead: CommunicationWithLead["lead"];
  participant: string;
  messages: CommunicationWithLead[];
  latest: CommunicationWithLead;
  needsApproval: boolean;
}

export function InboxView({ communications }: { communications: CommunicationWithLead[] }) {
  const router = useRouter();
  const [tab, setTab] = useState("conversations");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Inbox = SMS + email only (phone calls live in the Calls tab). Group every
  // message into a conversation by lead+channel (or the other party's address
  // when unmatched) so outbound-only threads — like a proactive confirmation
  // text — still show up.
  const conversations = useMemo(() => {
    const relevant = communications.filter(
      (c) => (c.channel === "sms" || c.channel === "email") && c.status !== "discarded"
    );
    const map = new Map<string, Conversation>();
    for (const c of relevant) {
      const channel = c.channel as "sms" | "email";
      const party = c.direction === "inbound" ? c.from_value : c.to_value;
      const key = c.lead_id ? `lead:${c.lead_id}:${channel}` : `addr:${party ?? "unknown"}:${channel}`;
      const existing = map.get(key);
      if (existing) {
        existing.messages.push(c);
      } else {
        map.set(key, {
          key,
          channel,
          lead: c.lead,
          participant: c.lead ? `${c.lead.first_name} ${c.lead.last_name}` : (party ?? "Unknown"),
          messages: [c],
          latest: c,
          needsApproval: false,
        });
      }
    }
    const list = [...map.values()];
    for (const convo of list) {
      convo.messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
      convo.latest = convo.messages[convo.messages.length - 1];
      convo.needsApproval = convo.messages.some(
        (m) => m.direction === "outbound" && m.status === "draft"
      );
    }
    return list.sort((a, b) => b.latest.created_at.localeCompare(a.latest.created_at));
  }, [communications]);

  const filtered = useMemo(() => {
    let list = tab === "approvals" ? conversations.filter((c) => c.needsApproval) : conversations;
    if (channelFilter) list = list.filter((c) => c.channel === channelFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.participant.toLowerCase().includes(term) ||
          c.messages.some((m) => m.body?.toLowerCase().includes(term))
      );
    }
    return list;
  }, [conversations, tab, channelFilter, search]);

  const selected = filtered.find((c) => c.key === selectedKey) ?? filtered[0] ?? null;
  const pendingDraft = selected?.messages.find(
    (m) => m.direction === "outbound" && m.status === "draft"
  );
  const approvalsCount = conversations.filter((c) => c.needsApproval).length;

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
        window.dispatchEvent(new CustomEvent("northstar-comm-sent"));
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
    <div className="space-y-4" data-tour="inbox-root">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="approvals" data-tour="inbox-approvals">
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
          {["sms", "email"].map((channel) => (
            <Button
              key={channel}
              variant={channelFilter === channel ? "default" : "outline"}
              size="sm"
              onClick={() => setChannelFilter(channelFilter === channel ? null : channel)}
              className="uppercase"
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
            {filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                No conversations yet. Use the demo guide to simulate an inbound text or email.
              </p>
            ) : (
              filtered.map((convo) => {
                const Icon = CHANNEL_ICONS[convo.channel] ?? MessageSquareText;
                return (
                  <button
                    key={convo.key}
                    type="button"
                    data-tour={selected?.key === convo.key ? "inbox-active-convo" : undefined}
                    onClick={() => {
                      setSelectedKey(convo.key);
                      setEditedBody(null);
                    }}
                    className={cn(
                      "w-full rounded-md p-3 text-left transition-colors hover:bg-secondary/70",
                      selected?.key === convo.key && "bg-secondary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {convo.latest.direction === "inbound" ? (
                        <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {convo.participant}
                      </span>
                      {convo.needsApproval && (
                        <Badge className="bg-amber-100 text-amber-800 text-[10px]" variant="secondary">
                          needs approval
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {convo.latest.subject ? `${convo.latest.subject} — ` : ""}
                      {convo.latest.body}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {formatRelative(convo.latest.created_at)}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Conversation thread */}
        <Card className="lg:col-span-3">
          {selected ? (
            <CardContent className="flex max-h-[68vh] flex-col p-0">
              <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <h3 className="text-base font-semibold">{selected.participant}</h3>
                <Badge variant="secondary" className="uppercase">
                  {selected.channel}
                </Badge>
                <span className="flex-1" />
                {selected.lead && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/app/leads/${selected.lead.id}`}>Open lead</Link>
                  </Button>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {selected.channel === "sms"
                  ? selected.messages
                      .filter((m) => m.status !== "draft")
                      .map((msg) => (
                        <div
                          key={msg.id}
                          className={cn("flex", msg.direction === "inbound" ? "justify-start" : "justify-end")}
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
                      ))
                  : selected.messages
                      .filter((m) => m.status !== "draft")
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
                {selected.messages.filter((m) => m.status !== "draft").length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sent messages yet — the AI-drafted reply below is waiting for your approval.
                  </p>
                )}
              </div>

              {pendingDraft && (
                <div className="border-t bg-secondary/30 p-4" data-tour="inbox-draft">
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
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => approveAndSend(pendingDraft.id)}
                      data-tour="inbox-approve"
                    >
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
