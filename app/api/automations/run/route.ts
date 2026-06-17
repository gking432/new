import { NextResponse } from "next/server";
import { runAutomationRules } from "@/lib/automations/runner";
import { createClient } from "@/lib/supabase/server";
import type { Feedback, Lead } from "@/types/app";

/**
 * Simulated automation runner. Replays a trigger event against a specific
 * lead or feedback record and returns which rules fired and what they did.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  let body: { event?: string; lead_id?: string; feedback_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const validEvents = ["lead_created", "stage_changed_to_estimate_sent", "feedback_submitted"];
  if (!body.event || !validEvents.includes(body.event)) {
    return NextResponse.json(
      { success: false, error: `event must be one of: ${validEvents.join(", ")}` },
      { status: 422 }
    );
  }

  let lead: Lead | null = null;
  let feedback: Feedback | null = null;

  if (body.lead_id) {
    const { data } = await supabase.from("leads").select("*").eq("id", body.lead_id).single();
    lead = data as Lead | null;
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }
  }
  if (body.feedback_id) {
    const { data } = await supabase
      .from("feedback")
      .select("*")
      .eq("id", body.feedback_id)
      .single();
    feedback = data as Feedback | null;
    if (!feedback) {
      return NextResponse.json({ success: false, error: "Feedback not found" }, { status: 404 });
    }
  }
  if (!lead && !feedback) {
    return NextResponse.json(
      { success: false, error: "Provide lead_id or feedback_id" },
      { status: 422 }
    );
  }

  const results = await runAutomationRules(supabase, body.event, { lead, feedback });
  return NextResponse.json({ success: true, results });
}
