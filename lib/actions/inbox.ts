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
export interface InboundResult {
  communicationId: string;
  leadId: string | null;
  leadName: string;
  events: string[];
  // AI-assigned importance for the on-screen notification.
  urgency: "urgent" | "high" | "medium" | "low";
  headline: string;
}

export async function simulateInboundText(): Promise<ActionResult<InboundResult>> {
  const supabase = await createClient();
  try {
    await requireUser(supabase);
    const events: string[] = [];

    // Blank-slate demo: the "existing customer" texting in is the most recent
    // lead the demoer created (not a hardcoded Sarah).
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lead) {
      return {
        success: false,
        error: "No customers yet — run the speed-to-lead demo first so there's someone to text.",
      };
    }

    const phone = lead.phone ?? "(unknown)";
    const firstName = lead.first_name;
    const body = `Hi, it's ${firstName}. Following up on my request — is someone still able to come out soon? Things seem to be getting worse since we talked.`;
    events.push(`Matched ${phone} to CRM record: ${lead.first_name} ${lead.last_name}`);

    const { data: comm, error } = await supabase
      .from("communications")
      .insert({
        lead_id: lead.id,
        channel: "sms",
        direction: "inbound",
        status: "received",
        from_value: phone,
        to_value: "Northstar Exterior & Home",
        body,
        ai_summary:
          "Existing customer following up on their request and reporting the situation is worsening — time-sensitive.",
        suggested_next_action: "Call them back today to confirm the inspection and reassure them.",
        ai_generated: false,
      })
      .select("id")
      .single();
    if (error || !comm) return { success: false, error: "Could not save the text" };
    events.push("Inbound text saved and classified as an urgent update");

    await supabase.from("tasks").insert({
      lead_id: lead.id,
      title: `Urgent: ${firstName} texted — situation worsening, confirm the inspection`,
      description:
        "Customer texted that things are getting worse and asked when someone can come out. Call back today to confirm and reassure.",
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
      created_at: new Date().toISOString(),
    });
    events.push("Timeline entry added to the lead");

    const { data: draft } = await supabase
      .from("communications")
      .insert({
        lead_id: lead.id,
        channel: "sms",
        direction: "outbound",
        status: "draft",
        from_value: "Northstar Exterior & Home",
        to_value: phone,
        subject: "Re: your request",
        body: `Hi ${firstName}, thanks for the update — we've got you flagged as a priority and someone will reach out today to lock in a time. Reply here if anything changes in the meantime.`,
        ai_generated: true,
        human_approved: false,
      })
      .select("id")
      .single();
    if (draft) events.push("AI reply drafted — waiting for human approval");
    events.push("AI reviewed the message and scored importance: HIGH (existing customer, worsening)");

    revalidatePath("/app", "layout");
    return {
      success: true,
      data: {
        communicationId: comm.id,
        leadId: lead.id,
        leadName: `${lead.first_name} ${lead.last_name}`,
        events,
        urgency: "high",
        headline: `New text · ${lead.first_name} ${lead.last_name} · situation worsening — High priority`,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Simulation failed" };
  }
}

/**
 * Demo Center: simulates a new-prospect email, creates the lead, drafts a
 * reply for approval, and creates the follow-up task.
 */
export async function simulateInboundEmail(): Promise<ActionResult<InboundResult>> {
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
          urgency: "high",
          lead_quality: "hot",
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
    events.push("AI reviewed the email and scored importance: URGENT (new hot lead)");

    revalidatePath("/app", "layout");
    return {
      success: true,
      data: {
        communicationId: comm.id,
        leadId: lead?.id ?? null,
        leadName: lead ? `${lead.first_name} ${lead.last_name}` : "Greg Tomlinson",
        events,
        // A brand-new lead is the most urgent kind of inbound — speed to lead wins jobs.
        urgency: "urgent",
        headline: "New email · New lead · 12-window project before winter — Urgent, hot lead",
      },
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
        title: `${record.channel === "email" ? "Email" : "Text"} sent to customer (simulated)`,
        description: record.body,
        metadata: { communication_id: id, simulated: true },
        created_at: new Date().toISOString(),
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
