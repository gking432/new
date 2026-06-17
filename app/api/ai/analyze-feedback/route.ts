import { NextResponse } from "next/server";
import { analyzeAndSaveFeedback } from "@/lib/ai/analyzeFeedback";
import { createClient } from "@/lib/supabase/server";
import { feedbackFormSchema } from "@/lib/validations/feedback";

/** Server-only feedback analysis (no-login demo). */
export async function POST(request: Request) {
  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  try {
    const result = await analyzeAndSaveFeedback(supabase, parsed.data);
    return NextResponse.json({ success: true, feedback: result.feedback, ai_used: result.aiUsed });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
