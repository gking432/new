"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  PhoneCall,
  PhoneForwarded,
  Plus,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createTask,
  generateFollowup,
  rerunLeadAnalysis,
  sendLeadToWebhook,
  updateLeadStage,
} from "@/lib/actions";
import type { FollowupOutput } from "@/lib/ai/schemas";
import type { TaskPriority, TaskType } from "@/types/app";

type GeneratedDraft = {
  label: string;
  followup: FollowupOutput;
  aiUsed: boolean;
};

export function LeadActionPanel({ leadId, stage }: { leadId: string; stage: string }) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function generate(type: "sms" | "email" | "call_script", label: string) {
    setPendingAction(type);
    const result = await generateFollowup({
      lead_id: leadId,
      type,
      tone: "professional",
      goal: "book_appointment",
      notes: "",
    });
    setPendingAction(null);
    if (result.success && result.data) {
      setDraft({ label, followup: result.data.followup, aiUsed: result.data.aiUsed });
      setDraftBody(result.data.followup.body);
      toast.success(`${label} draft generated`);
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  function markContacted() {
    setPendingAction("contacted");
    startTransition(async () => {
      const result = await updateLeadStage(leadId, "contacted");
      setPendingAction(null);
      if (result.success) toast.success("Marked as contacted");
      else toast.error(result.error);
    });
  }

  function scheduleAppointment() {
    setPendingAction("appointment");
    startTransition(async () => {
      const result = await updateLeadStage(leadId, "appointment_scheduled");
      setPendingAction(null);
      if (result.success) toast.success("Appointment stage set");
      else toast.error(result.error);
    });
  }

  async function sendWebhook() {
    setPendingAction("webhook");
    const result = await sendLeadToWebhook(leadId);
    setPendingAction(null);
    if (result.success && result.data) {
      toast.success(
        result.data.simulated
          ? "Webhook send simulated (demo mode) — payload logged to activity"
          : "Lead sent to webhook"
      );
    } else if (!result.success) {
      toast.error(result.error);
    }
  }

  async function rerunAnalysis() {
    setPendingAction("analysis");
    const result = await rerunLeadAnalysis(leadId);
    setPendingAction(null);
    if (result.success) toast.success("Analysis re-run complete");
    else toast.error(result.error);
  }

  const actions = [
    { key: "sms", label: "Generate SMS", icon: MessageSquare, onClick: () => generate("sms", "SMS") },
    { key: "email", label: "Generate Email", icon: Mail, onClick: () => generate("email", "Email") },
    { key: "call_script", label: "Generate Call Script", icon: PhoneCall, onClick: () => generate("call_script", "Call script") },
    { key: "task", label: "Create Task", icon: Plus, onClick: () => setTaskOpen(true) },
    { key: "contacted", label: "Mark Contacted", icon: PhoneForwarded, onClick: markContacted, disabled: stage !== "new" },
    { key: "appointment", label: "Schedule Appointment", icon: PhoneCall, onClick: scheduleAppointment, hidden: true },
    { key: "webhook", label: "Send to Webhook", icon: Webhook, onClick: sendWebhook },
    { key: "analysis", label: "Re-run AI Analysis", icon: RefreshCw, onClick: rerunAnalysis },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {actions
          .filter((action) => !action.hidden)
          .map((action) => (
            <Button
              key={action.key}
              variant="outline"
              className="w-full justify-start"
              disabled={pendingAction !== null || action.disabled}
              onClick={action.onClick}
            >
              {pendingAction === action.key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <action.icon className="h-4 w-4" />
              )}
              {action.label}
            </Button>
          ))}
      </div>

      {draft && (
        <div className="space-y-2 rounded-lg border bg-secondary/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{draft.label} draft</p>
            <Badge variant="outline" className="text-[10px]">
              {draft.aiUsed ? "AI draft — review before sending" : "Template draft (AI offline)"}
            </Badge>
          </div>
          {draft.followup.subject ? (
            <p className="text-xs text-muted-foreground">Subject: {draft.followup.subject}</p>
          ) : null}
          {draft.followup.call_opening ? (
            <p className="text-xs text-muted-foreground">Opening: {draft.followup.call_opening}</p>
          ) : null}
          <Textarea
            value={draftBody}
            onChange={(event) => setDraftBody(event.target.value)}
            rows={6}
            className="text-sm"
          />
          {draft.followup.discovery_questions.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Discovery questions</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {draft.followup.discovery_questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(draftBody);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Dismiss
            </Button>
          </div>
          <Separator />
          <p className="text-[11px] text-muted-foreground">
            Saved to the lead&apos;s follow-up history and activity timeline.
          </p>
        </div>
      )}

      <CreateTaskDialog leadId={leadId} open={taskOpen} onOpenChange={setTaskOpen} />
    </div>
  );
}

function CreateTaskDialog({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("call");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueInHours, setDueInHours] = useState("24");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await createTask({
      lead_id: leadId,
      title,
      type,
      priority,
      due_in_hours: Number(dueInHours) || 24,
    });
    setSaving(false);
    if (result.success) {
      toast.success("Task created");
      setTitle("");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>Add a task linked to this lead.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Call to confirm inspection time"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["call", "sms", "email", "inspection", "estimate_followup", "manager_review", "admin"] as TaskType[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {value.replace(/_/g, " ")}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["urgent", "high", "medium", "low"] as TaskPriority[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due in (hours)</Label>
              <Input
                id="task-due"
                type="number"
                min="1"
                value={dueInHours}
                onChange={(event) => setDueInHours(event.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
