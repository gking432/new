"use client";

import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { createTask, generateFollowup } from "@/lib/actions";
import type { FollowupOutput } from "@/lib/ai/schemas";
import { fullName } from "@/lib/utils/format";
import { SERVICE_LABELS } from "@/lib/utils/statuses";
import type { FollowupType, Lead } from "@/types/app";

const TYPE_OPTIONS: Array<[FollowupType, string]> = [
  ["sms", "SMS"],
  ["email", "Email"],
  ["call_script", "Call script"],
  ["voicemail", "Voicemail"],
  ["appointment_confirmation", "Appointment confirmation"],
  ["estimate_followup", "Estimate follow-up"],
  ["review_response", "Review response"],
];

const TONE_OPTIONS = [
  ["professional", "Professional"],
  ["friendly", "Friendly"],
  ["urgent", "Urgent"],
  ["reassuring", "Reassuring"],
  ["concise", "Concise"],
] as const;

const GOAL_OPTIONS = [
  ["book_appointment", "Book appointment"],
  ["confirm_details", "Confirm details"],
  ["follow_up_estimate", "Follow up on estimate"],
  ["reengage_cold_lead", "Re-engage cold lead"],
  ["handle_concern", "Handle concern"],
  ["thank_customer", "Thank customer"],
] as const;

export function FollowupComposer({ leads }: { leads: Lead[] }) {
  const [leadId, setLeadId] = useState<string>(leads[0]?.id ?? "");
  const [type, setType] = useState<FollowupType>("sms");
  const [tone, setTone] = useState<string>("professional");
  const [goal, setGoal] = useState<string>("book_appointment");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ followup: FollowupOutput; aiUsed: boolean } | null>(null);
  const [body, setBody] = useState("");

  async function generate() {
    if (!leadId) {
      toast.error("Select a lead first");
      return;
    }
    setGenerating(true);
    const response = await generateFollowup({
      lead_id: leadId,
      type,
      tone: tone as "professional",
      goal: goal as "book_appointment",
      notes,
    });
    setGenerating(false);
    if (response.success && response.data) {
      setResult({ followup: response.data.followup, aiUsed: response.data.aiUsed });
      setBody(response.data.followup.body);
      toast.success("Draft generated and saved to the lead");
    } else if (!response.success) {
      toast.error(response.error);
    }
  }

  async function createFollowupTask() {
    if (!result) return;
    const response = await createTask({
      lead_id: leadId,
      title: `Send ${type.replace(/_/g, " ")} to customer`,
      description: body.slice(0, 1500),
      type: type === "call_script" ? "call" : type === "sms" ? "sms" : "email",
      priority: "medium",
      due_in_hours: 4,
    });
    if (response.success) toast.success("Task created from this draft");
    else toast.error(response.error);
  }

  const followup = result?.followup;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>
            Pick a lead, choose the message type, and generate an editable draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Lead</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a lead…" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {fullName(lead.first_name, lead.last_name)} — {SERVICE_LABELS[lead.service_type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Communication type</Label>
              <Select value={type} onValueChange={(value) => setType(value as FollowupType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Goal</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Additional notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the message should mention — e.g. 'We can inspect Thursday morning.'"
              rows={3}
            />
          </div>

          <Button onClick={generate} disabled={generating || !leadId} className="w-full">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Draft
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Draft</CardTitle>
            {result ? (
              <Badge variant="outline" className="text-xs">
                {result.aiUsed ? "Schema-validated AI draft — review before sending" : "Rule-based template fallback"}
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            Edit freely. Drafts are saved to the lead&apos;s history automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!followup ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              The generated draft will appear here.
            </p>
          ) : (
            <>
              {followup.subject ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subject
                  </p>
                  <p className="mt-1 text-sm font-medium">{followup.subject}</p>
                </div>
              ) : null}
              {followup.call_opening ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Opening
                  </p>
                  <p className="mt-1 text-sm">{followup.call_opening}</p>
                </div>
              ) : null}
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={type === "sms" ? 5 : 10}
              />
              {type === "sms" ? (
                <p className="text-xs text-muted-foreground">{body.length} / 320 characters</p>
              ) : null}
              {followup.discovery_questions.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Discovery questions
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {followup.discovery_questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
              {followup.talking_points.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Talking points
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                    {followup.talking_points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {followup.closing_line ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Close
                  </p>
                  <p className="mt-1 text-sm">{followup.closing_line}</p>
                </div>
              ) : null}
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(body);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={createFollowupTask}>
                  Create task from message
                </Button>
              </div>
              {followup.internal_note ? (
                <p className="text-xs text-muted-foreground">Note: {followup.internal_note}</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
