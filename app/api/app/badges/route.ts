import { NextResponse } from "next/server";
import { createClient, isAppConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAppConfigured()) {
    return NextResponse.json({ badges: {} });
  }

  const supabase = await createClient();
  const endOfTomorrow = new Date();
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);

  const [openTasksRes, inboxAttentionRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .not("due_at", "is", null)
      .lte("due_at", endOfTomorrow.toISOString()),
    supabase
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound")
      .eq("status", "received")
      .contains("metadata", { needs_attention: true }),
  ]);

  return NextResponse.json({
    badges: {
      "/app/inbox": inboxAttentionRes.count ?? 0,
      "/app/tasks": openTasksRes.count ?? 0,
    },
  });
}
