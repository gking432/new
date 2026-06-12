"use client";

import { useState, useTransition } from "react";
import {
  Bot,
  CircleDot,
  Loader2,
  MessageSquarePlus,
  Pencil,
  Send,
  UserCheck,
  Webhook,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addLeadNote } from "@/lib/actions";
import { formatDateTime } from "@/lib/utils/format";
import type { Activity } from "@/types/app";

const ACTIVITY_ICONS: Record<string, typeof CircleDot> = {
  lead_created: CircleDot,
  ai_analysis: Bot,
  automation: Workflow,
  task_created: Pencil,
  followup_generated: Send,
  stage_change: UserCheck,
  assignment: UserCheck,
  note: MessageSquarePlus,
  webhook: Webhook,
};

export function ActivityTimeline({
  leadId,
  activities,
}: {
  leadId: string;
  activities: Activity[];
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function saveNote() {
    startTransition(async () => {
      const result = await addLeadNote(leadId, note);
      if (result.success) {
        toast.success("Note added");
        setNote("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note to this lead…"
          rows={2}
          className="flex-1"
        />
        <Button onClick={saveNote} disabled={pending || !note.trim()} className="self-end">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </div>

      {activities.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="relative space-y-5 border-l pl-5">
          {activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type] ?? CircleDot;
            return (
              <li key={activity.id} className="relative">
                <span className="absolute -left-[29px] flex h-4 w-4 items-center justify-center rounded-full border bg-card">
                  <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">{activity.title}</p>
                {activity.description ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(activity.created_at)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
