import { NextResponse } from "next/server";
import { generateAndSaveFollowup } from "@/lib/ai/generateFollowup";
import { createClient } from "@/lib/supabase/server";
import { followupRequestSchema } from "@/lib/validations/followup";

/** Server-only follow-up generation (no-login demo). */
export async function POST(request: Request) {
  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = followupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  try {
    const result = await generateAndSaveFollowup(supabase, parsed.data, null);
    return NextResponse.json({ success: true, followup: result.followup, ai_used: result.aiUsed });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
