import { NextResponse } from "next/server";
import { runDueScheduledReminders } from "@/lib/communications/reminders";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDueScheduledReminders(supabase);
  return NextResponse.json({ success: true, ...result });
}
