"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlarmClock, Check, ExternalLink, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { snoozeTask, updateTaskStatus } from "@/lib/actions";
import { formatTaskDueDate, fullName, isPastDue } from "@/lib/utils/format";
import { PRIORITY_STYLES, SERVICE_LABELS } from "@/lib/utils/statuses";
import type { TaskWithLead } from "@/types/app";

export function TaskList({
  tasks,
  emptyMessage = "No tasks here. Nice work.",
  compact = false,
  highlightTaskId,
}: {
  tasks: TaskWithLead[];
  emptyMessage?: string;
  compact?: boolean;
  highlightTaskId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function complete(taskId: string) {
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, "complete");
      if (result.success) {
        toast.success("Task completed");
        window.dispatchEvent(new CustomEvent("northstar-task-completed"));
      } else {
        toast.error(result.error);
      }
    });
  }

  function snooze(taskId: string, hours: number, label: string) {
    startTransition(async () => {
      const result = await snoozeTask(taskId, hours);
      if (result.success) toast.success(`Snoozed until ${label}`);
      else toast.error(result.error);
    });
  }

  function taskHref(task: TaskWithLead) {
    const opensApprovalQueue =
      task.status !== "complete" &&
      (task.type === "sms" ||
        /confirmation|sms|text|approval queue|secondary contact/i.test(
          `${task.title} ${task.description ?? ""}`
        ));
    if (opensApprovalQueue) {
      return `/app/inbox?tab=approvals${task.lead ? `&lead=${task.lead.id}` : ""}`;
    }
    if (task.lead) return `/app/leads/${task.lead.id}`;
    return null;
  }

  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y">
      {tasks.map((task, index) => {
        const overdue = task.status !== "complete" && isPastDue(task.due_at);
        const priority = PRIORITY_STYLES[task.priority];
        const href = taskHref(task);
        const opensApprovalQueue = href?.startsWith("/app/inbox") ?? false;
        return (
          <li
            key={task.id}
            className={cn(
              "flex items-start gap-3 py-3",
              href && "cursor-pointer rounded-md px-2 transition-colors hover:bg-secondary/60",
              task.id === highlightTaskId && "ring-2 ring-brand-gold"
            )}
            onClick={() => {
              if (href) router.push(href);
            }}
          >
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "mt-0.5 h-6 w-6 shrink-0 rounded-full",
                task.status === "complete" && "bg-status-success text-white border-status-success"
              )}
              disabled={pending || task.status === "complete"}
              onClick={(event) => {
                event.stopPropagation();
                complete(task.id);
              }}
              title="Mark complete"
              data-tour={index === 0 && task.status !== "complete" ? "task-complete-button" : undefined}
            >
              <Check className="h-3 w-3" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {opensApprovalQueue && task.status !== "complete" ? (
                  <Badge className="h-5 min-w-5 justify-center rounded-full bg-red-500 px-1.5 text-white">
                    !
                  </Badge>
                ) : null}
                <span
                  className={cn(
                    "font-medium",
                    task.status === "complete" && "text-muted-foreground line-through"
                  )}
                >
                  {task.title}
                </span>
                <Badge variant="outline" className={priority.className}>
                  {priority.label}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {task.lead ? (
                  <>
                    {fullName(task.lead.first_name, task.lead.last_name)} ·{" "}
                    {SERVICE_LABELS[task.lead.service_type]} ·{" "}
                  </>
                ) : null}
                {task.assigned_profile ? <>{task.assigned_profile.full_name} · </> : null}
                <span className={cn(overdue && "font-medium text-status-urgent")}>
                  {overdue ? "Overdue — due " : "Due "}
                  {formatTaskDueDate(task.due_at)}
                </span>
              </p>
              {!compact && task.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {task.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {task.status !== "complete" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Snooze"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <AlarmClock className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => snooze(task.id, 1, "in 1 hour")}>
                      Snooze 1 hour
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => snooze(task.id, 24, "tomorrow")}>
                      Snooze 1 day
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => snooze(task.id, 72, "in 3 days")}>
                      Snooze 3 days
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {opensApprovalQueue ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  asChild
                  title="Review draft"
                  data-tour={index === 0 ? "task-confirmation-link" : undefined}
                >
                  <Link
                    href={href ?? `/app/inbox${task.lead ? `?lead=${task.lead.id}` : ""}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
              {task.lead ? (
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Open lead">
                  <Link
                    href={`/app/leads/${task.lead.id}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
