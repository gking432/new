"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Communication, Lead } from "@/types/app";

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Demo Center: simulates Sarah Mitchell texting in an update. Matches the
 * seeded phone number to her lead, classifies the message, creates an urgent
 * task, drafts a reply for approval, and logs the timeline entry.
 */
export async function simulateInboundText(): Promise<
  ActionResult<{ communicationId: string; leadId: string | null; events: string[] }>
> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const events: string[] = [];

    const phone = "(414) 555-0188";
    const body =
      "Hi this is Sarah. Tomorrow after 2 works for the roof inspection. Also the ceiling spot got a little bigger overnight.";

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    events.push(
      lead
        ? `Matched ${phone} to CRM record: ${lead.first_name} ${lead.last_name}`
        : `No CRM match for ${phone} — saved as unmatched`
    );

    const { data: comm, error } = await supabase
      .from("communications")
      .insert({
        lead_id: lead?.id ?? null,
        channel: "sms",
        direction: "inbound",
        status: "received",
        from_value: phone,
        to_value: "Northstar Exterior & Home",
        body,
        ai_summary:
          "Customer confirmed tomorrow afternoon works for the inspection and reported the ceiling water stain has grown overnight — urgent update.",
        suggested_next_action:
          "Confirm the 2:30 PM inspection and flag the worsening stain for the inspector.",
        ai_generated: false,
      })
      .select("id")
      .single();
    if (error || !comm) return { success: false, error: "Could not save the text" };
    events.push("Inbound text saved and classified as an urgent update");

    if (lead) {
      await supabase.from("tasks").insert({
        lead_id: lead.id,
        title: `Urgent: ceiling stain growing — confirm tomorrow's inspection (${lead.first_name})`,
        description:
          "Customer texted that the water stain grew overnight. Confirm the 2:30 PM inspection and let the inspector know to prioritize the affected area.",
        type: "call",
        priority: "urgent",
        status: "open",
        due_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
      events.push("Urgent task created for the assigned rep");

      await supabase.from("activities").insert({
        lead_id: lead.id,
        type: "sms",
        title: "Inbound text received",
        description: body,
        metadata: { communication_id: comm.id },
      });
      events.push("Timeline entry added to the lead");
    }

    const { data: draft } = await supabase
      .from("communications")
      .insert({
        lead_id: lead?.id ?? null,
        channel: "sms",
        direction: "outbound",
        status: "draft",
        from_value: "Northstar Exterior & Home",
        to_value: phone,
        subject: "Re: inspection confirmation",
        body: `Hi ${lead?.first_name ?? "Sarah"}, you're confirmed for tomorrow at 2:30 PM. Thanks for the heads-up about the ceiling — we've flagged it for the inspector so they check that area first. If anything changes before then, just reply here.`,
        ai_generated: true,
        human_approved: false,
      })
      .select("id")
      .single();
    if (draft) events.push("AI reply drafted — waiting for human approval");

    revalidatePath("/app", "layout");
    return {
      success: true,
      data: { communicationId: comm.id, leadId: lead?.id ?? null, events },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Simulation failed" };
  }
}

/**
 * Demo Center: simulates a new-prospect email, creates the lead, drafts a
 * reply for approval, and creates the follow-up task.
 */
export async function simulateInboundEmail(): Promise<
  ActionResult<{ communicationId: string; leadId: string | null; events: string[] }>
> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const events: string[] = [];

    const fromEmail = "greg.tomlinson@example.com";
    const subject = "Window estimate";
    const body =
      "Hi, we are looking to replace 12 windows before winter. The house was built in 1988 and most of the windows are original. We'd like to understand the process and rough timing.";

    let lead: Lead | null = null;
    const { data: existing } = await supabase
      .from("leads")
      .select("*")
      .eq("email", fromEmail)
      .limit(1)
      .maybeSingle();
    if (existing) {
      lead = existing as Lead;
      events.push(`Matched email to existing lead: ${lead.first_name} ${lead.last_name}`);
    } else {
      const { data: created } = await supabase
        .from("leads")
        .insert({
          first_name: "Greg",
          last_name: "Tomlinson",
          email: fromEmail,
          service_type: "windows",
          description: body,
          timeframe: "1_3_months",
          source: "email",
          stage: "new",
          urgency: "medium",
          lead_quality: "warm",
          ai_status: "completed",
        })
        .select("*")
        .single();
      lead = (created as Lead | null) ?? null;
      if (lead) {
        events.push("New lead created: Greg Tomlinson (Windows · Warm)");
        await supabase.from("activities").insert({
          lead_id: lead.id,
          type: "lead_created",
          title: "Lead created from inbound email",
          description: body,
        });
      }
    }

    const { data: comm, error } = await supabase
      .from("communications")
      .insert({
        lead_id: lead?.id ?? null,
        channel: "email",
        direction: "inbound",
        status: "received",
        from_value: fromEmail,
        to_value: "hello@northstar-demo.com",
        subject,
        body,
        ai_summary:
          "New prospect wants 12 original (1988) windows replaced before winter and is asking about process and timing. Classified as Windows / warm / medium urgency.",
        suggested_next_action:
          "Reply with the process overview and offer an in-home measurement appointment.",
      })
      .select("id")
      .single();
    if (error || !comm) return { success: false, error: "Could not save the email" };
    events.push("Inbound email saved — AI classified service type as Windows");

    if (lead) {
      await supabase.from("tasks").insert({
        lead_id: lead.id,
        title: "Reply to window estimate inquiry (12 windows, 1988 build)",
        description:
          "Send process overview and offer an in-home measurement. Customer wants the project done before winter.",
        type: "email",
        priority: "high",
        status: "open",
        due_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
      });
      events.push("Follow-up task created (due in 4 hours)");
    }

    const { data: draft } = await supabase
      .from("communications")
      .insert({
        lead_id: lead?.id ?? null,
        channel: "email",
        direction: "outbound",
        status: "draft",
        from_value: "hello@northstar-demo.com",
        to_value: fromEmail,
        subject: "Re: Window estimate — here's how the process works",
        body: `Hi Greg,\n\nThanks for reaching out — replacing original 1988 windows before winter is a very common project for us, and 12 windows is typically a 1–2 day installation.\n\nHere's how it works: we start with a free in-home visit to measure and walk through material and glass options, then you get a written quote with no obligation. Lead times right now support a comfortable before-winter install.\n\nWould a measurement visit this week or next work for you? I'm happy to set that up.\n\nBest,\nNorthstar Exterior & Home`,
        ai_generated: true,
        human_approved: false,
      })
      .select("id")
      .single();
    if (draft) events.push("AI reply drafted — waiting for human approval");

    revalidatePath("/app", "layout");
    return {
      success: true,
      data: { communicationId: comm.id, leadId: lead?.id ?? null, events },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Simulation failed" };
  }
}

export async function approveCommunication(
  id: string,
  editedBody?: string
): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const updates: Record<string, unknown> = {
      status: "approved",
      human_approved: true,
      updated_at: new Date().toISOString(),
    };
    if (editedBody?.trim()) updates.body = editedBody.trim().slice(0, 5000);
    const { error } = await supabase.from("communications").update(updates).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/inbox");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Approval failed" };
  }
}

/** Demo mode: marks an approved draft as simulated-sent. Nothing real is sent. */
export async function simulateSendCommunication(id: string): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    const user = await requireUser(supabase);
    const { data: comm } = await supabase
      .from("communications")
      .select("*")
      .eq("id", id)
      .single();
    if (!comm) return { success: false, error: "Message not found" };
    const record = comm as Communication;
    if (!record.human_approved) {
      return { success: false, error: "Approve the draft before sending" };
    }

    const { error } = await supabase
      .from("communications")
      .update({ status: "simulated_sent", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { success: false, error: error.message };

    if (record.lead_id) {
      await supabase.from("activities").insert({
        lead_id: record.lead_id,
        user_id: user.id,
        type: record.channel,
        title: `${record.channel === "email" ? "Email" : "Text"} send simulated (demo mode)`,
        description: record.body,
        metadata: { communication_id: id, simulated: true },
      });
    }
    revalidatePath("/app", "layout");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

export async function discardCommunication(id: string): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const { error } = await supabase
      .from("communications")
      .update({ status: "discarded", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "draft");
    if (error) return { success: false, error: error.message };
    revalidatePath("/app/inbox");
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Discard failed" };
  }
}
