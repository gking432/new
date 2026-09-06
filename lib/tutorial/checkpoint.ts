export interface TourCheckpoint {
  stepId: string;
  route: string;
  storylineLeadId: string | null;
  gregLeadId: string | null;
}
export const checkpointKey = (mode: string) => `northstar-tour-checkpoint-${mode}`;

export function readCheckpoint(raw: string | null): TourCheckpoint | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value.stepId !== "string" || typeof value.route !== "string") return null;
    if (!/^\/app(?:[/?]|$)/.test(value.route) || /[\\\r\n]/.test(value.route)) return null;
    const id = (v: unknown) => typeof v === "string" && /^[a-f0-9-]{36}$/i.test(v) ? v : null;
    return { stepId: value.stepId, route: value.route, storylineLeadId: id(value.storylineLeadId), gregLeadId: id(value.gregLeadId) };
  } catch { return null; }
}

// A hard reload discards open composers, call media and unsaved form inputs.
// Re-enter those panels through a repeatable action instead of waiting for a
// vanished event. Saved CRM work is preserved.
const RECOVERY: Record<string, [string, string]> = {
  "you-answer-watch": ["you-answer", "/app"],
  "save-first-lead": ["you-answer", "/app"],
  "answer-call": ["speed-to-lead", "/app"],
  "send-email-reply": ["reply-email", "/app/inbox"],
  "executive-send-email-reply": ["executive-reply-email", "/app/inbox"],
  "feedback-analyze": ["feedback-view", "/app/feedback"],
  "feedback-publish": ["feedback-view", "/app/feedback"],
  "executive-analyze-review": ["executive-open-review", "/app/feedback"],
  "executive-post-review-response": ["executive-open-review", "/app/feedback"],
  "automation-run-analysis": ["automations-view", "/app/automations"],
  "automation-output-review": ["automations-view", "/app/automations"],
};
export function restoreStep(steps: { id: string }[], saved: TourCheckpoint | null, reload: boolean) {
  const recovery = reload && saved ? RECOVERY[saved.stepId] : undefined;
  const id = recovery?.[0] ?? saved?.stepId;
  const found = steps.findIndex(step => step.id === id);
  let route = recovery?.[1] ?? saved?.route ?? "/app";
  if (recovery && route === "/app/inbox" && saved?.gregLeadId) route += `?tab=conversations&lead=${saved.gregLeadId}`;
  return { index: found < 0 ? 0 : found, route: found < 0 ? "/app" : route, recovered: Boolean(recovery) };
}
