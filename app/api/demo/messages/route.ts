import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public, minimal read endpoint for the speed-to-lead demo: lets the
 * homeowner's phone UI on the success page "receive" the confirmation SMS the
 * team approved. Exposes only the body/timestamp of simulated-sent outbound
 * SMS for a specific lead UUID (which only the submitter's browser knows).
 */
export async function GET(request: Request) {
  const leadId = new URL(request.url).searchParams.get("lead");
  if (!leadId || !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ messages: [] });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ messages: [] });
  }

  const { data } = await supabase
    .from("communications")
    .select("id, body, created_at")
    .eq("lead_id", leadId)
    .eq("channel", "sms")
    .eq("direction", "outbound")
    .eq("status", "simulated_sent")
    .order("created_at", { ascending: true })
    .limit(5);

  return NextResponse.json({ messages: data ?? [] });
}
