import "server-only";

import { cookies } from "next/headers";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import type {
  Activity,
  Appointment,
  AvailabilityWindow,
  Call,
  CallSummary,
  CallTranscript,
  Communication,
  CompanySettings,
  Contact,
  CrmSyncEvent,
  Feedback,
  Lead,
  LeadAnalysis,
  AutomationRun,
  Profile,
  PropertyResearch,
  QuoteEstimate,
  Task,
} from "@/types/app";

const COOKIE_PREFIX = "northstar_demo_state";
const COOKIE_COUNT = `${COOKIE_PREFIX}_count`;
const CHUNK_SIZE = 3_400;
const MAX_CHUNKS = 12;
const MAX_AGE_SECONDS = 60 * 60 * 8;

export interface DemoState {
  version: 1;
  profiles: Profile[];
  leads: Lead[];
  contacts: Contact[];
  analyses: LeadAnalysis[];
  activities: Activity[];
  tasks: Task[];
  feedback: Feedback[];
  communications: Communication[];
  appointments: Appointment[];
  availability: AvailabilityWindow[];
  calls: Call[];
  callSummaries: CallSummary[];
  callTranscripts: CallTranscript[];
  properties: PropertyResearch[];
  quotes: QuoteEstimate[];
  crmSyncEvents: CrmSyncEvent[];
  automationRuns: AutomationRun[];
  settings: CompanySettings;
}

const DEMO_PROFILE_IDS = {
  dana: "00000000-0000-4000-8000-000000000001",
  jess: "00000000-0000-4000-8000-000000000002",
  marcus: "00000000-0000-4000-8000-000000000003",
  taylor: "00000000-0000-4000-8000-000000000004",
} as const;

function nowIso() {
  return new Date().toISOString();
}

export function createBlankDemoState(): DemoState {
  const createdAt = nowIso();
  const profiles: Profile[] = [
    { id: DEMO_PROFILE_IDS.dana, full_name: "Dana Whitfield", role: "admin", avatar_url: null, created_at: createdAt, updated_at: createdAt },
    { id: DEMO_PROFILE_IDS.jess, full_name: "Jess Romero", role: "sales_rep", avatar_url: null, created_at: createdAt, updated_at: createdAt },
    { id: DEMO_PROFILE_IDS.marcus, full_name: "Marcus Lee", role: "sales_rep", avatar_url: null, created_at: createdAt, updated_at: createdAt },
    { id: DEMO_PROFILE_IDS.taylor, full_name: "Taylor Brooks", role: "sales_rep", avatar_url: null, created_at: createdAt, updated_at: createdAt },
  ];

  const availability: AvailabilityWindow[] = [];
  for (const profile of profiles.slice(1)) {
    for (const day of [1, 2, 3, 4, 5]) {
      availability.push({
        id: randomUUID(),
        user_id: profile.id,
        day_of_week: day,
        start_time: "09:00",
        end_time: "20:00",
        appointment_type: "inspection",
        slot_minutes: 60,
        active: true,
        created_at: createdAt,
      });
    }
    for (const day of [0, 6]) {
      availability.push({
        id: randomUUID(),
        user_id: profile.id,
        day_of_week: day,
        start_time: "09:00",
        end_time: "16:00",
        appointment_type: "inspection",
        slot_minutes: 60,
        active: true,
        created_at: createdAt,
      });
    }
  }

  return {
    version: 1,
    profiles,
    leads: [],
    contacts: [],
    analyses: [],
    activities: [],
    tasks: [],
    feedback: [],
    communications: [],
    appointments: [],
    availability,
    calls: [],
    callSummaries: [],
    callTranscripts: [],
    properties: [],
    quotes: [],
    crmSyncEvents: [],
    automationRuns: [],
    settings: {
      id: "00000000-0000-4000-8000-000000000010",
      company_name: "Northstar Exterior & Home",
      phone: "(262) 555-0100",
      email: "hello@northstarexterior.example",
      service_area: "Southeastern Wisconsin",
      timezone: "America/Chicago",
      business_hours: {
        monday_friday: "8:00 AM-6:00 PM",
        saturday: "9:00 AM-3:00 PM",
        sunday: "Closed",
      },
      ai_enabled: true,
      automations_enabled: true,
      default_ai_model: "gpt-4.1-mini",
      default_tone: "friendly",
      created_at: createdAt,
      updated_at: createdAt,
    },
  };
}

function encodeState(state: DemoState) {
  return deflateRawSync(Buffer.from(JSON.stringify(state))).toString("base64url");
}

function decodeState(value: string): DemoState | null {
  try {
    const parsed = JSON.parse(inflateRawSync(Buffer.from(value, "base64url")).toString("utf8"));
    if (parsed?.version !== 1) return null;
    const defaults = createBlankDemoState();
    return {
      ...defaults,
      ...parsed,
      crmSyncEvents: parsed.crmSyncEvents ?? [],
      automationRuns: parsed.automationRuns ?? [],
      feedback: parsed.feedback ?? [],
      settings: parsed.settings ?? defaults.settings,
    } as DemoState;
  } catch {
    return null;
  }
}

export async function readDemoState(): Promise<DemoState> {
  const jar = await cookies();
  const count = Math.max(0, Math.min(MAX_CHUNKS, Number(jar.get(COOKIE_COUNT)?.value ?? "0")));
  if (!count) return createBlankDemoState();
  let encoded = "";
  for (let index = 0; index < count; index += 1) {
    const chunk = jar.get(`${COOKIE_PREFIX}_${index}`)?.value;
    if (!chunk) return createBlankDemoState();
    encoded += chunk;
  }
  return decodeState(encoded) ?? createBlankDemoState();
}

export async function writeDemoState(state: DemoState) {
  const jar = await cookies();
  const encoded = encodeState(state);
  const chunks = encoded.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
  if (chunks.length > MAX_CHUNKS) throw new Error("Demo state exceeded its browser storage limit");
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
  jar.set(COOKIE_COUNT, String(chunks.length), options);
  chunks.forEach((chunk, index) => jar.set(`${COOKIE_PREFIX}_${index}`, chunk, options));
  for (let index = chunks.length; index < MAX_CHUNKS; index += 1) {
    jar.delete(`${COOKIE_PREFIX}_${index}`);
  }
}

export async function mutateDemoState<T>(mutator: (state: DemoState) => T | Promise<T>) {
  const state = await readDemoState();
  const result = await mutator(state);
  await writeDemoState(state);
  return result;
}

export async function resetDemoState() {
  const state = createBlankDemoState();
  await writeDemoState(state);
  return state;
}

export function demoId() {
  return randomUUID();
}

export function demoAdminId(state: DemoState) {
  return state.profiles.find((profile) => profile.role === "admin")?.id ?? null;
}

export function demoEstimatorId(state: DemoState, preferredName = "Jess Romero") {
  return (
    state.profiles.find((profile) => profile.full_name === preferredName)?.id ??
    state.profiles.find((profile) => profile.role === "sales_rep")?.id ??
    null
  );
}
