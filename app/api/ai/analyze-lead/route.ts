import { NextResponse } from "next/server";
import { analyzeAndSaveLead } from "@/lib/ai/analyzeLead";
import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/types/app";

/** Server-only AI lead analysis (no-login demo). */
export async function POST(request: Request) {
  const supabase = await createClient();

  let body: { lead_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.lead_id) {
    return NextResponse.json({ success: false, error: "lead_id is required" }, { status: 422 });
  }

  const { data: lead } = await supabase.from("leads").select("*").eq("id", body.lead_id).single();
  if (!lead) {
    return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
  }

  const result = await analyzeAndSaveLead(supabase, lead as Lead);
  return NextResponse.json({ success: true, ai_status: result.aiStatus, analysis: result.analysis });
}
