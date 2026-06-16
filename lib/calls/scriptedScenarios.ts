import type { CallScenario } from "@/types/app";
import { customerServiceLabel } from "@/lib/utils/statuses";

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
            lead ? customerServiceLabel(lead.service_type).toLowerCase() : "storm damage"
          } request here — you'd mentioned hail damage and a water spot upstairs. How can I help?`,
          options: [
            "I wanted to confirm someone is actually coming out tomorrow.",
            "I need to reschedule — something came up tomorrow.",
          ],
        },
        {
          ai: "Of course! I show an inspection on the books for tomorrow at 2:30 PM. Does that still work, or would another time be easier? We also do evenings and weekends if that's better for you.",
          options: [
            "Tomorrow at 2:30 works. Also, the ceiling spot looks a little bigger today.",
            "Actually, could we do an evening? I work until 5.",
          ],
        },
        {
          ai: "Absolutely — how about tomorrow at 5:30 PM instead? I'll move you to that.",
          options: ["That's perfect, thank you. The ceiling spot is a bit bigger today, though."],
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
          ai: `Hi${lead ? ` ${first}` : ""}, this is Riley, the scheduling assistant over at Northstar Exterior & Home — thanks for reaching out just now! I saw your note${
            lead ? ` about ${customerServiceLabel(lead.service_type).toLowerCase()}` : ""
          } and wanted to make sure we take good care of you. Do you have a quick minute?`,
          options: ["Sure, that was fast!", "Okay, but I only have a minute."],
        },
        {
          ai: "Of course, I'll be quick! So I can picture it — is water actually coming into the house right now, or are you seeing damage from the outside?",
          options: [
            "There's a water spot on the ceiling upstairs and it looks fresh.",
            "No active water, but shingles are missing after the hail.",
          ],
        },
        {
          ai: "Oh, that ceiling spot is worth jumping on — I'll flag this as urgent so we get out there fast. Have you had a chance to call your insurance yet?",
          options: ["No, not yet.", "Yes, I started a claim."],
        },
        {
          ai: "Totally fine — our inspector will document everything with photos that homeowners often use for a claim. Let's get you on the calendar: I've got tomorrow evening at 5:30, or Saturday morning at 10:30 — anything work better for your schedule?",
          options: [
            "Evenings are better, I work until 5. Tomorrow at 5:30 works.",
            "Saturday morning at 10:30 is perfect.",
          ],
        },
        {
          ai: "Perfect, you're booked! You'll get a confirmation text shortly, and the inspector will give you a call when they're on the way. Is this the best number to reach you?",
          options: ["Yes, call or text this number."],
        },
        {
          ai: "Wonderful — you're all set, and I really appreciate you reaching out to us. We'll take good care of you. Talk soon!",
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
        appointment_time: "tomorrow at 5:30 PM",
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
        ai: "Thanks for calling Northstar Exterior & Home, this is Riley — what can I help you with today?",
        options: [
          "Hi, we had hail last week and now there's a water stain on the upstairs ceiling.",
          "Hi, I'm looking at replacing some old windows before winter.",
        ],
      },
      {
        ai: "Oh no, a ceiling stain after hail — let's definitely get someone out to look. I can help with that. Can I grab your name?",
        options: ["Sure, it's Marcus Webb."],
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
        ai: "Totally reasonable question — our inspector documents the damage with photos that homeowners often use when they file. Now, I know a lot of folks work during the day, so we also do evenings and weekends. I've got tomorrow at 5:30pm or Saturday at 10:30am — would either be easier?",
        options: ["Tomorrow at 5:30 after work is perfect."],
      },
      {
        ai: "Great, you're booked for tomorrow at 5:30! You'll get a confirmation text shortly, and the inspector will call when they're on the way. Is this the best number for you?",
        options: ["Yes, call or text is fine."],
      },
      {
        ai: "You're all set, Marcus — we'll take good care of you. Thanks so much for calling Northstar, and we'll see you tomorrow evening!",
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
      appointment_time: "tomorrow at 5:30 PM",
      service_type: "storm_damage",
      urgency: "emergency",
      summary_hint: "called in about hail damage with a fresh ceiling water stain",
    },
  };
}
