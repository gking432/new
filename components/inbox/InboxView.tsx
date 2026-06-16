"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Clock,
  Loader2,
  Mail,
  MessageSquareText,
  Reply,
  Send,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  approveAndSimulateCommunication,
  draftSoonerInspectionSms,
  discardCommunication,
  sendConversationReply,
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

type InboxTab = "conversations" | "approvals" | "automated";

declare global {
  interface Window {
    __northstarInboxTab?: InboxTab;
  }
}

function normalizeTab(value?: string): InboxTab {
  if (value === "approvals") return "approvals";
  if (value === "automated" || value === "scheduled") return "automated";
  return "conversations";
}

function messageSortTime(message: CommunicationWithLead) {
  if (message.status === "approved" && message.scheduled_send_at) {
    return new Date(message.scheduled_send_at).getTime();
  }
  if (message.direction === "outbound" && message.status === "simulated_sent" && message.updated_at) {
    return new Date(message.updated_at).getTime();
  }
  return new Date(message.created_at).getTime();
}

export function InboxView({
  communications,
  initialLeadId,
  initialTab,
}: {
  communications: CommunicationWithLead[];
  initialLeadId?: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<InboxTab>(normalizeTab(initialTab));
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Preselect the conversation for the customer we arrived from (Open Inbox on
  // a lead) so you don't have to hunt for them again.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Inbox = SMS + email only (phone calls live in the Calls tab). Group every
  // message into a conversation by lead+channel (or the other party's address
  // when unmatched) so outbound-only threads — like a proactive confirmation
  // text — still show up.
  const automatedMessages = useMemo(
    () =>
      communications.filter(
        (c) =>
          (c.channel === "sms" || c.channel === "email") &&
          c.status === "approved" &&
          Boolean(c.scheduled_send_at)
      ),
    [communications]
  );

  function buildConversations(messages: CommunicationWithLead[]) {
    const map = new Map<string, Conversation>();
    for (const c of messages) {
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
    const grouped = [...map.values()];
    for (const convo of grouped) {
      convo.messages.sort((a, b) => messageSortTime(a) - messageSortTime(b));
      convo.latest = convo.messages[convo.messages.length - 1];
      convo.needsApproval = convo.messages.some(
        (m) => m.direction === "outbound" && m.status === "draft"
      );
    }
    return grouped.sort((a, b) => messageSortTime(b.latest) - messageSortTime(a.latest));
  }

  const inboxMessages = useMemo(
    () =>
      communications.filter(
        (c) =>
          (c.channel === "sms" || c.channel === "email") &&
          c.status !== "discarded" &&
          !(c.status === "approved" && Boolean(c.scheduled_send_at))
      ),
    [communications]
  );

  const conversations = useMemo(() => {
    const realConversationMessages = inboxMessages.filter(
      (c) =>
        !(c.direction === "outbound" && c.status === "draft") ||
        ((c.metadata ?? {}) as Record<string, unknown>).demo_action === "jordan_reschedule_offer"
    );
    return buildConversations(realConversationMessages);
  }, [inboxMessages]);

  const approvalConversations = useMemo(() => {
    return buildConversations(inboxMessages).filter((c) => c.needsApproval);
  }, [inboxMessages]);

  useEffect(() => {
    setTab(normalizeTab(initialTab));
  }, [initialTab]);

  const conversationsForSelection = useMemo(() => {
    const relevant = communications.filter(
      (c) =>
        (c.channel === "sms" || c.channel === "email") &&
        c.status !== "discarded" &&
        !(c.status === "approved" && Boolean(c.scheduled_send_at))
    );
    return buildConversations(relevant);
  }, [communications]);

  const scheduledConversations = useMemo(
    () => buildConversations(automatedMessages),
    [automatedMessages]
  );

  const filtered = useMemo(() => {
    let list =
      tab === "approvals"
        ? approvalConversations
        : tab === "automated"
          ? scheduledConversations
          : conversations;
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
  }, [approvalConversations, conversations, scheduledConversations, tab, channelFilter, search]);

  useEffect(() => {
    if (autoSelected || !initialLeadId) return;
    const match = conversationsForSelection.find((c) => c.lead?.id === initialLeadId);
    if (match) {
      setSelectedKey(match.key);
      setAutoSelected(true);
    }
  }, [conversationsForSelection, initialLeadId, autoSelected]);

  const selected = filtered.find((c) => c.key === selectedKey) ?? filtered[0] ?? null;
  const pendingDraft = selected?.messages.find(
    (m) => m.direction === "outbound" && m.status === "draft"
  );
  const approvalsCount = approvalConversations.length;
  const scheduledCount = automatedMessages.length;
  const attentionCount = conversations.reduce(
    (count, convo) => count + (convo.messages.some(needsAttention) ? 1 : 0),
    0
  );

  useEffect(() => {
    setReplyOpen(false);
    setReplyBody("");
    setReplyToId(null);
  }, [selected?.key]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filtered.some((c) => c.key === selectedKey)) {
      setSelectedKey(filtered[0].key);
    }
  }, [filtered, selectedKey]);

  function isScheduled(msg: CommunicationWithLead) {
    return msg.status === "approved" && Boolean(msg.scheduled_send_at);
  }

  function needsAttention(msg: CommunicationWithLead) {
    const meta = (msg.metadata ?? {}) as Record<string, unknown>;
    return msg.direction === "inbound" && msg.status === "received" && meta.needs_attention === true;
  }

  function statusLabel(msg: CommunicationWithLead) {
    if (isScheduled(msg)) {
      const due = new Date(msg.scheduled_send_at!).getTime() <= Date.now();
      return due
        ? "automated reminder · due now"
        : `automated reminder · ${formatRelative(msg.scheduled_send_at!)}`;
    }
    if (msg.status === "simulated_sent") return "sent (simulated)";
    if (msg.status === "approved") return "approved";
    return msg.status;
  }

  function approveAndSend(draftId: string) {
    startTransition(async () => {
      const draft = selected?.messages.find((message) => message.id === draftId);
      const meta = (draft?.metadata ?? {}) as Record<string, unknown>;
      const sent = await approveAndSimulateCommunication(draftId, editedBody ?? undefined);
      if (sent.success) {
        setEditedBody(null);
        window.dispatchEvent(new CustomEvent("northstar-comm-sent"));
        if (meta.demo_action === "jordan_reschedule_offer") {
          toast("Appointment moved", {
            description:
              "AI: Jordan accepted the earlier opening. Jess was notified and the calendar was blocked.",
            position: "top-center",
            duration: 9000,
            action: { label: "Open Appointments", onClick: () => router.push("/app/appointments") },
          });
        }
        router.refresh();
      } else {
        toast.error(sent.error ?? "Send failed");
      }
    });
  }

  function draftSoonerOffer(communicationId: string) {
    startTransition(async () => {
      const result = await draftSoonerInspectionSms(communicationId);
      if (result.success) {
        window.dispatchEvent(new CustomEvent("northstar-reschedule-offer-drafted"));
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not draft the SMS");
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

  function openReply(mode: "draft" | "blank") {
    const inbound = [...(selected?.messages ?? [])].reverse().find((m) => m.direction === "inbound");
    if (!inbound) return;
    const meta = (inbound.metadata ?? {}) as Record<string, unknown>;
    setReplyToId(inbound.id);
    setReplyBody(mode === "draft" && typeof meta.suggested_reply === "string" ? meta.suggested_reply : "");
    setReplyOpen(true);
    if (mode === "draft") {
      window.dispatchEvent(new CustomEvent("northstar-email-draft-opened"));
    }
  }

  function sendReply() {
    if (!replyToId) return;
    startTransition(async () => {
      const sent = await sendConversationReply({ replyToId, body: replyBody });
      if (sent.success) {
        setReplyOpen(false);
        setReplyBody("");
        setReplyToId(null);
        window.dispatchEvent(new CustomEvent("northstar-comm-sent"));
        router.refresh();
      } else {
        toast.error(sent.error ?? "Reply failed");
      }
    });
  }

  function selectTab(value: InboxTab) {
    setTab(value);
    setSelectedKey(null);
    setEditedBody(null);
    setReplyOpen(false);
    if (value === "approvals") {
      window.dispatchEvent(new CustomEvent("northstar-inbox-approvals-opened"));
    } else if (value === "conversations") {
      window.dispatchEvent(new CustomEvent("northstar-inbox-conversations-opened"));
    }
  }

  useEffect(() => {
    window.__northstarInboxTab = tab;
    if (tab === "conversations") {
      window.dispatchEvent(new CustomEvent("northstar-inbox-conversations-opened"));
    }
  }, [tab]);

  return (
    <div className="space-y-4" data-tour="inbox-root">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md bg-secondary p-1">
          {(
            [
              ["conversations", "Conversations", attentionCount, "bg-red-500", "inbox-conversations"],
              ["approvals", "Approval queue", approvalsCount, "bg-red-500", "inbox-approvals"],
              ["automated", "Automated", scheduledCount, "bg-blue-500", "inbox-scheduled"],
            ] as Array<[InboxTab, string, number, string, string]>
          ).map(([value, label, count, badgeClass, tour]) => (
            <button
              key={value}
              type="button"
              data-tour={tour}
              aria-pressed={tab === value}
              onClick={() => selectTab(value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors",
                tab === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              {label}
              {count > 0 && (
                <Badge className={cn("ml-0.5 text-white", badgeClass)} variant="secondary">
                  {count}
                </Badge>
              )}
            </button>
          ))}
        </div>
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
                {tab === "automated"
                  ? "No automated reminders yet."
                  : "No conversations yet. Use the demo guide to simulate an inbound text or email."}
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
                      {convo.messages.some(needsAttention) && (
                        <Badge className="bg-red-100 text-red-800 text-[10px]" variant="secondary">
                          new
                        </Badge>
                      )}
                      {!convo.needsApproval && convo.messages.some(isScheduled) && (
                        <Badge className="bg-blue-100 text-blue-800 text-[10px]" variant="secondary">
                          automated
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
        <Card className="lg:col-span-3" data-tour="inbox-thread">
          {selected ? (
            <CardContent className="flex max-h-[68vh] flex-col p-0">
              <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <h3 className="text-base font-semibold">{selected.participant}</h3>
                <Badge variant="secondary" className="uppercase">
                  {selected.channel}
                </Badge>
                {tab === "automated" && (
                  <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-800">
                    <Clock className="h-3 w-3" />
                    automated reminders
                  </Badge>
                )}
                <span className="flex-1" />
                {selected.channel === "email" && tab === "conversations" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" data-tour="inbox-email-reply">
                        <Reply className="h-3.5 w-3.5" />
                        Reply
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openReply("draft")}>
                        <Wand2 className="h-3.5 w-3.5" />
                        Draft a response
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openReply("blank")}>
                        <Reply className="h-3.5 w-3.5" />
                        Type a response
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
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
                        <div key={msg.id} className="space-y-2">
                          <div
                            className={cn("flex", msg.direction === "inbound" ? "justify-start" : "justify-end")}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                                msg.direction === "inbound"
                                  ? "rounded-bl-sm bg-secondary"
                                  : isScheduled(msg)
                                    ? "rounded-br-sm border border-blue-200 bg-blue-50 text-blue-950"
                                    : "rounded-br-sm bg-primary text-primary-foreground"
                              )}
                            >
                              <p className="whitespace-pre-wrap">{msg.body}</p>
                              <p
                                className={cn(
                                  "mt-1 text-[10px]",
                                  msg.direction === "inbound"
                                    ? "text-muted-foreground"
                                    : isScheduled(msg)
                                      ? "text-blue-800/70"
                                      : "text-primary-foreground/60"
                                )}
                              >
                                {formatRelative(msg.created_at)}
                                {msg.direction === "outbound" ? ` · ${statusLabel(msg)}` : ""}
                              </p>
                            </div>
                          </div>
                          <AiAvailabilityInsight
                            message={msg}
                            pending={pending}
                            onDraft={draftSoonerOffer}
                            offerDrafted={selected.messages.some((candidate) => {
                              const meta = (candidate.metadata ?? {}) as Record<string, unknown>;
                              return (
                                candidate.direction === "outbound" &&
                                candidate.status === "draft" &&
                                meta.demo_action === "jordan_reschedule_offer" &&
                                meta.source_communication_id === msg.id
                              );
                            })}
                          />
                        </div>
                      ))
                  : selected.messages
                      .filter((m) => m.status !== "draft")
                      .map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "overflow-hidden rounded-lg border bg-background",
                            msg.direction === "inbound" && needsAttention(msg) && "border-red-200 bg-red-50/30"
                          )}
                        >
                          <div className="border-b bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">
                                {msg.direction === "inbound" ? "From" : "To"}:{" "}
                                {msg.direction === "inbound" ? msg.from_value : msg.to_value}
                              </span>
                              {needsAttention(msg) && (
                                <Badge className="bg-red-100 text-red-800" variant="secondary">
                                  new
                                </Badge>
                              )}
                              <span className="ml-auto">{formatRelative(msg.created_at)}</span>
                            </div>
                            {msg.direction === "outbound" && (
                              <p className="mt-1">Status: {statusLabel(msg)}</p>
                            )}
                          </div>
                          <div className="px-3 py-3">
                            {msg.subject && <p className="text-sm font-semibold">{msg.subject}</p>}
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{msg.body}</p>
                          </div>
                        </div>
                      ))}
                {selected.messages.filter((m) => m.status !== "draft").length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sent messages yet — the AI-drafted reply below is waiting for your approval.
                  </p>
                )}
              </div>

              {replyOpen && selected.channel === "email" && (
                <div className="border-t bg-secondary/30 p-4" data-tour="inbox-email-composer">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Reply className="h-3.5 w-3.5 text-primary" />
                    Email reply
                  </p>
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={7}
                    placeholder="Draft a response or type a response…"
                    className="bg-background"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" disabled={pending || !replyBody.trim()} onClick={sendReply}>
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send reply (simulated)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setReplyOpen(false);
                        setReplyBody("");
                        setReplyToId(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <span className="self-center text-[11px] text-muted-foreground">
                      Demo mode — nothing real is sent.
                    </span>
                  </div>
                </div>
              )}

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

function AiAvailabilityInsight({
  message,
  pending,
  onDraft,
  offerDrafted,
}: {
  message: CommunicationWithLead;
  pending: boolean;
  onDraft: (communicationId: string) => void;
  offerDrafted?: boolean;
}) {
  const router = useRouter();
  if (offerDrafted) return null;
  if (message.direction !== "inbound") return null;
  const meta = (message.metadata ?? {}) as Record<string, unknown>;
  if (meta.demo_action !== "jordan_urgent_reschedule") return null;
  const estimatorName =
    typeof meta.suggested_estimator_name === "string" ? meta.suggested_estimator_name : "Jess Romero";
  const label =
    typeof meta.suggested_label === "string" ? meta.suggested_label : "today";
  const estimatorParam =
    typeof meta.suggested_estimator_id === "string"
      ? meta.suggested_estimator_id
      : estimatorName.toLowerCase().replace(/\s+/g, "-");
  const suggestedStart =
    typeof meta.suggested_start_time === "string" ? meta.suggested_start_time : null;

  return (
    <div
      className="ml-4 max-w-[86%] rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm shadow-sm"
      data-tour="inbox-ai-availability"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
        <Bot className="h-3.5 w-3.5" />
        AI scheduling note
      </p>
      <p className="mt-1 text-amber-950">
        {estimatorName} is available {label}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() =>
            router.push(
              `/app/appointments?estimator=${encodeURIComponent(estimatorParam)}${
                suggestedStart ? `&slot=${encodeURIComponent(suggestedStart)}` : ""
              }`
            )
          }
          data-tour="inbox-ai-insight-check"
        >
          Check {estimatorName.split(" ")[0]} availability
        </Button>
        <Button
          size="sm"
          onClick={() => onDraft(message.id)}
          disabled={pending}
          data-tour="inbox-ai-insight-draft"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Draft SMS asking if {label} works
        </Button>
      </div>
    </div>
  );
}
