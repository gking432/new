"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { completeCall, type CompleteCallResult } from "@/lib/calls/completeCall";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

const finishCallSchema = z.object({
  callId: z.string().uuid(),
  transcriptTurns: z
    .array(
      z.object({
        speaker: z.enum(["ai", "customer", "system"]),
        text: z.string().max(4000),
        at: z.number().optional(),
      })
    )
    .max(200),
  durationSeconds: z.number().min(0).max(3600),
  mode: z.enum(["realtime", "scripted_fallback"]),
  // "customer" = the AI's lines are the homeowner's (you-answer mode).
  aiRole: z.enum(["agent", "customer"]).optional(),
  seedFields: z.record(z.string(), z.string().nullable()).optional(),
});

// The call pipeline is reachable from the public speed-to-lead demo, so it
// runs on the admin client with a light in-memory rate limit.
const completionTimestamps: number[] = [];
function rateLimited() {
  const now = Date.now();
  while (completionTimestamps.length && completionTimestamps[0] < now - 60_000) {
    completionTimestamps.shift();
  }
  if (completionTimestamps.length >= 15) return true;
  completionTimestamps.push(now);
  return false;
}

/**
 * Ends a call and runs the full post-call pipeline: transcript storage, AI
 * summary, CRM note, lead create/update, appointment booking, tasks, and the
 * human-approval confirmation draft.
 */
export async function finishCall(
  input: z.infer<typeof finishCallSchema>
): Promise<ActionResult<CompleteCallResult>> {
  const parsed = finishCallSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid call data" };
  if (rateLimited()) return { success: false, error: "Too many call completions right now" };

  try {
    const supabase = createAdminClient();
    const result = await completeCall(supabase, parsed.data);
    revalidatePath("/app", "layout");
    return { success: true, data: result };
  } catch (err) {
    console.error("Call completion failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Call completion failed",
    };
  }
}

/** Marks a call that was declined or never connected. */
export async function markCallMissed(callId: string): Promise<ActionResult<undefined>> {
  if (!z.string().uuid().safeParse(callId).success) {
    return { success: false, error: "Invalid call id" };
  }
  try {
    const supabase = createAdminClient();
    await supabase
      .from("calls")
      .update({ status: "missed", ended_at: new Date().toISOString() })
      .eq("id", callId)
      .eq("status", "ringing");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Update failed" };
  }
}
