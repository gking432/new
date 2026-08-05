export const REPORT_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const REPORT_TIMEZONES = [
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
] as const;

export const REPORT_SECTIONS = [
  {
    id: "open_quotes",
    label: "Open quotes and pipeline",
    description: "Open value, aging estimates, close risk, and the best next actions.",
    metric: "$286,500 open",
    summary: "14 estimates are open. Three have had no customer response for seven or more days.",
    details: ["4 estimates above $25,000", "$74,800 has been quiet for 7+ days", "Roofing has the highest open value"],
    action: "Have the AI draft a different follow-up for each quiet estimate and assign the four highest-value opportunities to a rep today.",
  },
  {
    id: "reviews_reputation",
    label: "Reviews and reputation",
    description: "New public reviews, sentiment, recurring themes, and drafted responses.",
    metric: "4.7 average rating",
    summary: "11 new reviews arrived across Google, Yelp, and Yellow Pages. One needs a manager response.",
    details: ["8 positive, 2 neutral, 1 negative", "Communication was praised 6 times", "Cleanup was mentioned negatively twice"],
    action: "Respond to the cleanup complaint today, route it to operations, and send review requests to the six recently completed customers most likely to respond.",
  },
  {
    id: "recent_orders",
    label: "Recent orders and production",
    description: "Recently sold work, production readiness, materials, and schedule risk.",
    metric: "$164,200 sold",
    summary: "Eight projects were sold this week. Two need attention before production can begin.",
    details: ["5 jobs are production-ready", "2 material checks are incomplete", "1 permit is still pending"],
    action: "Notify operations about the missing window measurements and assign the pending permit before tomorrow's production meeting.",
  },
  {
    id: "customer_service",
    label: "Customer service complaints",
    description: "Open issues, urgency, sentiment, ownership, and response recommendations.",
    metric: "2 urgent issues",
    summary: "Six customer-service cases are open. Two involve active water intrusion and require same-day follow-up.",
    details: ["2 urgent, 3 normal, 1 waiting on customer", "Average first response: 22 minutes", "No issue is currently unassigned"],
    action: "Escalate the two leak cases, confirm an owner and next update time, and send each homeowner a clear status message now.",
  },
  {
    id: "lead_response",
    label: "Lead response and sales",
    description: "Lead volume, response speed, booking rate, sources, and missed opportunities.",
    metric: "68% booking rate",
    summary: "Thirty-four leads arrived this week. Referral leads converted best, while Facebook response time slipped.",
    details: ["Average speed-to-lead: 18 minutes", "Referral booking rate: 81%", "5 Facebook leads waited more than 30 minutes"],
    action: "Turn on the five-minute SLA alert for Facebook leads and route missed after-hours calls into the AI callback workflow.",
  },
  {
    id: "scheduling_capacity",
    label: "Scheduling and capacity",
    description: "Booked inspections, open capacity, reschedules, and estimator workload.",
    metric: "22 inspections booked",
    summary: "Estimator capacity is balanced overall, with a useful opening Wednesday afternoon and limited room Friday.",
    details: ["3 appointments were rescheduled", "Wednesday has 4 open slots", "Jess Romero is at 86% capacity"],
    action: "Offer Wednesday openings first, stop offering Jess on Friday, and let the AI scheduling assistant rebalance new requests across the team.",
  },
] as const;

export type ReportSectionId = (typeof REPORT_SECTIONS)[number]["id"];
export type ReportDay = (typeof REPORT_DAYS)[number];

export interface DemoReportRequest {
  email: string;
  recipientName?: string;
  reportName: string;
  day: ReportDay;
  time: string;
  timezone: string;
  sections: ReportSectionId[];
}

export function formatReportTime(time: string) {
  const [hours = "8", minutes = "00"] = time.split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

export function timezoneLabel(value: string) {
  return REPORT_TIMEZONES.find((zone) => zone.value === value)?.label ?? value;
}

export function selectedReportSections(ids: ReportSectionId[]) {
  const selected = new Set(ids);
  return REPORT_SECTIONS.filter((section) => selected.has(section.id));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildDemoReportEmail(input: DemoReportRequest) {
  const sections = selectedReportSections(input.sections);
  const time = formatReportTime(input.time);
  const zone = timezoneLabel(input.timezone);
  const recipient = input.recipientName?.trim() || "there";
  const sectionNames = sections.map((section) => section.label).join(", ");
  const schedule = `every ${input.day} at ${time} ${zone}`;
  const subject = `Demo: ${input.reportName}`;

  const sectionHtml = sections
    .map(
      (section) => `
        <section style="margin:0 0 16px;border:1px solid #e3ded5;border-radius:8px;background:#ffffff;overflow:hidden;">
          <div style="padding:18px 20px;border-bottom:1px solid #e3ded5;background:#f7f5f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:16px;font-weight:700;color:#17211b;">${escapeHtml(section.label)}</td>
              <td align="right" style="font-size:14px;font-weight:700;color:#234e3a;">${escapeHtml(section.metric)}</td>
            </tr></table>
          </div>
          <div style="padding:18px 20px;">
            <p style="margin:0 0 12px;color:#33443a;font-size:14px;line-height:1.6;">${escapeHtml(section.summary)}</p>
            <ul style="margin:0 0 14px;padding-left:20px;color:#5f6b63;font-size:13px;line-height:1.7;">
              ${section.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
            </ul>
            <div style="padding:12px 14px;border-left:3px solid #c79a3b;background:#fbf7ed;color:#33443a;font-size:13px;line-height:1.6;">
              <strong style="color:#17211b;">AI recommended action:</strong> ${escapeHtml(section.action)}
            </div>
          </div>
        </section>`
    )
    .join("");

  const html = `<!doctype html>
  <html><body style="margin:0;background:#ece9e1;font-family:Inter,Segoe UI,Arial,sans-serif;color:#17211b;">
    <div style="display:none;max-height:0;overflow:hidden;">A one-time preview of your configurable AI operations report.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece9e1;"><tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">
        <tr><td style="padding:22px 24px;background:#143225;border-radius:8px 8px 0 0;color:#ffffff;">
          <div style="font-size:12px;text-transform:uppercase;color:#e3bd69;font-weight:700;">Northstar AI Operations</div>
          <h1 style="margin:7px 0 0;font-size:25px;line-height:1.25;">${escapeHtml(input.reportName)}</h1>
        </td></tr>
        <tr><td style="padding:24px;background:#ffffff;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(recipient)},</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">You chose to receive a report covering <strong>${escapeHtml(sectionNames)}</strong> ${escapeHtml(schedule)}. In a real deployment, the scheduled report might look like the example below.</p>
          <div style="margin:0 0 22px;padding:14px 16px;border:1px solid #e3bd69;border-radius:8px;background:#fbf7ed;color:#5b4618;font-size:13px;line-height:1.6;">
            <strong>One-time demo:</strong> This email proves the delivery workflow. No recurring schedule was created, your address was not added to a mailing list, and you will not receive another email from this demo.
          </div>
          ${sectionHtml}
          <p style="margin:22px 0 0;color:#7a847d;font-size:12px;line-height:1.6;">The figures above are clearly labeled demonstration data. In production, this report would be generated from connected CRM, review, phone, calendar, marketing, and operations systems.</p>
        </td></tr>
        <tr><td align="center" style="padding:18px;color:#7a847d;font-size:11px;line-height:1.6;">Northstar Exterior &amp; Home · AI-assisted CRM demonstration</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    input.reportName,
    "",
    `Hi ${recipient},`,
    "",
    `You chose to receive a report covering ${sectionNames} ${schedule}. In a real deployment, the scheduled report might look like the example below.`,
    "",
    "ONE-TIME DEMO: No recurring schedule was created, your address was not added to a mailing list, and you will not receive another email from this demo.",
    "",
    ...sections.flatMap((section) => [
      `${section.label.toUpperCase()} — ${section.metric}`,
      section.summary,
      ...section.details.map((detail) => `- ${detail}`),
      `AI recommended action: ${section.action}`,
      "",
    ]),
    "The figures above are demonstration data. In production, this report would use connected business systems.",
  ].join("\n");

  return { subject, html, text, schedule, sectionNames };
}
