import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskList } from "@/components/app/TaskList";
import { getTasks } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithLead } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const { task: highlightTaskId } = await searchParams;
  const supabase = await createClient();
  const tasks = await getTasks(supabase);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const active = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  const overdue = active.filter((t) => t.due_at && new Date(t.due_at) < startOfToday);
  const dueToday = active.filter(
    (t) => t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) <= endOfToday
  );
  const upcoming = active.filter((t) => !t.due_at || new Date(t.due_at) > endOfToday);
  const completed = tasks.filter((t) => t.status === "complete");
  const highlightedTab = dueToday.some((t) => t.id === highlightTaskId)
    ? "today"
    : overdue.some((t) => t.id === highlightTaskId)
      ? "overdue"
      : upcoming.some((t) => t.id === highlightTaskId)
        ? "upcoming"
        : completed.some((t) => t.id === highlightTaskId)
          ? "completed"
          : "today";

  const byRep = new Map<string, TaskWithLead[]>();
  for (const task of active) {
    const name = task.assigned_profile?.full_name ?? "Unassigned";
    byRep.set(name, [...(byRep.get(name) ?? []), task]);
  }

  return (
    <Tabs defaultValue={highlightedTab}>
      <TabsList>
        <TabsTrigger value="today">Due Today ({dueToday.length})</TabsTrigger>
        <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        <TabsTrigger value="by-rep">By Rep</TabsTrigger>
      </TabsList>

      {(
        [
          ["today", dueToday, "Nothing due today."],
          ["overdue", overdue, "No overdue tasks. Good discipline."],
          ["upcoming", upcoming, "No upcoming tasks scheduled."],
          ["completed", completed, "No completed tasks yet."],
        ] as Array<[string, TaskWithLead[], string]>
      ).map(([value, list, empty]) => (
        <TabsContent key={value} value={value}>
          <Card>
            <CardContent className="pt-5">
              <TaskList tasks={list} emptyMessage={empty} highlightTaskId={highlightTaskId} />
            </CardContent>
          </Card>
        </TabsContent>
      ))}

      <TabsContent value="by-rep">
        <div className="space-y-4">
          {[...byRep.entries()].map(([name, repTasks]) => (
            <Card key={name}>
              <CardContent className="pt-5">
                <h3 className="mb-2 font-semibold">
                  {name} <span className="text-sm font-normal text-muted-foreground">({repTasks.length})</span>
                </h3>
                <TaskList tasks={repTasks} compact highlightTaskId={highlightTaskId} />
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
