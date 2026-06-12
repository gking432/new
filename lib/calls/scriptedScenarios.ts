import type { CallScenario } from "@/types/app";

/**
 * Deterministic call scripts used when the OpenAI Realtime API is unavailable
 * (or disabled). The user clicks the customer's lines; the AI responses are
 * prewritten. The resulting transcript flows through the same completion
 * pipeline as a live Realtime call.
 */

export interface ScriptedStep {
  /** What the AI assistant says at this step. */
  ai: string;
  /** Customer reply options. Clicking one advances the script. Empty = call end. */
  options: string[];
}

export interface ScriptedScenario {
  steps: ScriptedStep[];
  /** Ground-truth facts the script establishes, used to seed the summary. */
  seedFields: Record<string, string | null>;
}

export function getScriptedScenario(
  scenario: CallScenario,
  lead?: {
    first_name: string;
    last_name: string;
    phone: string | null;
    city: string | null;
    service_type: string;
    description: string;
  } | null
): ScriptedScenario {
  if (scenario === "existing_customer_call") {
    const first = lead?.first_name ?? "Sarah";
    return {
      steps: [
        {
          ai: `Hi ${first}, thanks for calling back. I have your ${
            lead?.service_type.replace(/_/g, " ") ?? "storm damage"
          } request here — you'd mentioned hail damage and a water spot upstairs. How can I help?`,
          options: [
            "I wanted to confirm someone is actually coming out tomorrow.",
            "I need to reschedule — something came up tomorrow.",
          ],
        },
        {
          ai: "Of course. I show an inspection on the books for tomorrow at 2:30 PM. Does that still work, or would another time be better?",
          options: [
            "Tomorrow at 2:30 works. Also, the ceiling spot looks a little bigger today.",
            "Can we do later in the afternoon instead?",
          ],
        },
        {
          ai: "Thanks for letting me know — I've noted that the staining has grown, so the inspector will prioritize that area. One more thing: have you contacted your insurance company yet?",
          options: [
            "No, I haven't called insurance yet. Should I?",
            "Yes, I started a claim yesterday.",
          ],
        },
        {
          ai: "I can't speak to coverage, but our inspector will document everything with photos, which homeowners often use when they file. So you're all set: inspection tomorrow at 2:30 PM, and we'll send a confirmation message shortly. Anything else?",
          options: ["No, that's everything. Thank you!"],
        },
        {
          ai: "Perfect. Thanks for calling back — we'll see you tomorrow at 2:30. Take care!",
          options: [],
        },
      ],
      seedFields: {
        first_name: first,
        last_name: lead?.last_name ?? "Mitchell",
        phone: lead?.phone ?? "(414) 555-0188",
        active_leak: "yes",
        insurance_started: "no",
        appointment_time: "tomorrow at 2:30 PM",
        service_type: lead?.service_type ?? "storm_damage",
        urgency: "high",
        summary_hint:
          "called back to confirm the roof inspection and reported the ceiling water stain has grown",
      },
    };
  }

  if (scenario === "speed_to_lead_outbound") {
    const first = lead?.first_name ?? "there";
    return {
      steps: [
        {
          ai: `Hi${lead ? ` ${first}` : ""}, this is Northstar Exterior & Home's AI scheduling assistant. I saw the request you just sent${
            lead ? ` about ${lead.service_type.replace(/_/g, " ")}` : ""
          } and wanted to confirm a few details so we can get the right person out. Do you have a quick minute?`,
          options: ["Sure, that was fast!", "Okay, but I only have a minute."],
        },
        {
          ai: "Great, I'll keep it short. First — is water actively coming into the house right now?",
          options: [
            "There's a water spot on the ceiling upstairs and it looks fresh.",
            "No active water, but shingles are missing after the hail.",
          ],
        },
        {
          ai: "Understood — I've flagged that for the team. Have you contacted your insurance company about this yet?",
          options: ["No, not yet.", "Yes, I started a claim."],
        },
        {
          ai: "No problem. Our inspector documents everything with photos, which homeowners often use for claims — though I can't speak to coverage itself. For the inspection: I have tomorrow at 10:30 AM or 2:30 PM available. Would either of those work?",
          options: ["Tomorrow at 2:30 works.", "10:30 tomorrow is better for me."],
        },
        {
          ai: "You're booked. You'll get a confirmation message shortly, and the inspector will call when they're on the way. Is this number the best way to reach you?",
          options: ["Yes, call or text this number."],
        },
        {
          ai: "Perfect — you're all set. Thanks for choosing Northstar, and we'll see you tomorrow. Goodbye!",
          options: [],
        },
      ],
      seedFields: {
        first_name: lead?.first_name ?? null,
        last_name: lead?.last_name ?? null,
        phone: lead?.phone ?? null,
        active_leak: "yes",
        insurance_started: "no",
        preferred_contact_method: "phone",
        appointment_time: "tomorrow at 2:30 PM",
        service_type: lead?.service_type ?? "storm_damage",
        urgency: "emergency",
        summary_hint: "was called back moments after submitting the website request",
      },
    };
  }

  // new_inbound_call (default). The caller is a brand-new prospect (NOT a
  // seeded customer) so this demo always shows new-lead creation rather than
  // matching an existing record.
  return {
    steps: [
      {
        ai: "Thanks for calling Northstar Exterior & Home. I can help get the right information over to our team. Can I start with your name?",
        options: ["Hi, this is Marcus Webb."],
      },
      {
        ai: "Thanks, Marcus. What's going on with the house?",
        options: [
          "We had hail last week and now there's a water stain on the upstairs ceiling.",
          "I'm looking at replacing some old windows before winter.",
        ],
      },
      {
        ai: "I'm sorry to hear that — let's get this moving quickly. Is water actively coming in, or is it staining so far?",
        options: [
          "The stain looks fresh and a little bigger than yesterday.",
          "Just staining so far, no dripping.",
        ],
      },
      {
        ai: "Okay, I've marked this as urgent. What's the property address?",
        options: ["508 Granite Court in Pewaukee, Wisconsin."],
      },
      {
        ai: "Got it — 508 Granite Court, Pewaukee. And the best number and email to reach you?",
        options: ["This number, (262) 555-0114, and marcus.webb@example.com."],
      },
      {
        ai: "Perfect. Have you contacted your insurance company about the hail yet?",
        options: ["No, I wasn't sure if I should call them first or you."],
      },
      {
        ai: "Totally reasonable question — our inspector documents the damage with photos, which homeowners often use when they file. I can't speak to coverage itself. For the inspection: I have tomorrow at 10:30 AM or 2:30 PM. Would either work?",
        options: ["Tomorrow afternoon — 2:30 works."],
      },
      {
        ai: "Booked: tomorrow at 2:30 PM. You'll get a confirmation message shortly. Is calling this number the best way to reach you?",
        options: ["Yes, call or text is fine."],
      },
      {
        ai: "You're all set, Marcus. Our team will see you tomorrow at 2:30, and someone will call if anything changes. Thanks for calling Northstar!",
        options: [],
      },
    ],
    seedFields: {
      first_name: "Marcus",
      last_name: "Webb",
      phone: "(262) 555-0114",
      email: "marcus.webb@example.com",
      address: "508 Granite Ct",
      city: "Pewaukee",
      active_leak: "yes",
      insurance_started: "no",
      preferred_contact_method: "phone",
      appointment_time: "tomorrow at 2:30 PM",
      service_type: "storm_damage",
      urgency: "emergency",
      summary_hint: "called in about hail damage with a fresh ceiling water stain",
    },
  };
}
