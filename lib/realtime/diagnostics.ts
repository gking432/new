// Deliberately independent of React and the call transport. Never store raw
// provider messages, transcripts, audio, SDP, device IDs, or error messages.
export const VOICE_TRACE_KEY = "northstar-voice-diagnostics-v1";
export const VOICE_TRACE_EVENT = "northstar-voice-diagnostics-updated";
export const MAX_VOICE_EVENTS = 800;
export const MAX_VOICE_REPORTS = 3;
export const VOICE_RETENTION_MS = 24 * 60 * 60 * 1000;

type Fields = Record<string, string | number | boolean | null>;
export interface VoiceTraceEvent {
  seq: number;
  ms: number;
  type: string;
  data: Fields;
}
export interface VoiceReport {
  version: 1;
  id: string;
  startedAt: string;
  endedAt?: string;
  userAgent: string;
  scenario: string;
  persona: string;
  audioRoute: "unknown" | "speaker" | "headphones" | "earpiece";
  events: VoiceTraceEvent[];
  droppedEvents: number;
}

const textKeys = new Set([
  "callId", "sessionId", "responseId", "itemId", "activeResponseId", "model", "api", "mode", "mintPath",
  "status", "reason", "errorCode", "errorName", "errorType", "state", "iceState", "signalingState",
  "turnType", "eagerness", "noiseReduction", "voice", "direction", "visibility", "trackState",
]);
const numericKeys = new Set([
  "threshold", "prefixPaddingMs", "silenceDurationMs", "audioStartMs", "audioEndMs", "contentIndex",
  "sampleRate", "channelCount", "latency", "sampleSize", "httpStatus", "currentTime", "readyState",
  "networkState", "volume", "packetsLost", "packetsReceived", "packetsSent", "bytesReceived", "bytesSent",
  "jitter", "jitterBufferDelay", "jitterBufferEmittedCount", "concealedSamples", "silentConcealedSamples",
  "totalSamplesReceived", "totalSamplesDuration", "audioLevel", "totalAudioEnergy", "roundTripTime",
  "fractionLost", "echoReturnLoss", "echoReturnLossEnhancement",
]);
const booleanKeys = new Set([
  "outputPlaying", "interruptResponse", "createResponse", "echoCancellation", "noiseSuppression",
  "autoGainControl", "enabled", "muted", "paused", "ended", "online",
]);

export function safeDiagnosticFields(value: Record<string, unknown>): Fields {
  const safe: Fields = {};
  for (const [key, v] of Object.entries(value)) {
    if (textKeys.has(key) && typeof v === "string" && /^[a-zA-Z0-9_.:-]{1,100}$/.test(v)) safe[key] = v;
    if (numericKeys.has(key) && typeof v === "number" && Number.isFinite(v)) safe[key] = v;
    if (booleanKeys.has(key) && typeof v === "boolean") safe[key] = v;
  }
  return safe;
}

export function createVoiceTrace(
  context: Pick<VoiceReport, "id" | "userAgent" | "scenario" | "persona">,
  onChange: (report: VoiceReport) => void = () => {},
  clock: () => number = () => performance.now(),
) {
  const start = clock();
  let seq = 0;
  let outputPlaying = false;
  let activeResponseId: string | undefined;
  const report: VoiceReport = {
    ...context, userAgent: context.userAgent.slice(0, 300), version: 1,
    startedAt: new Date().toISOString(), audioRoute: "unknown", events: [], droppedEvents: 0,
  };
  function record(type: string, data: Record<string, unknown> = {}) {
    if (report.endedAt || !/^[a-zA-Z0-9_.-]{1,100}$/.test(type)) return;
    report.events.push({ seq: ++seq, ms: Math.max(0, Math.round(clock() - start)), type,
      data: safeDiagnosticFields({ outputPlaying, activeResponseId, ...data }) });
    if (report.events.length > MAX_VOICE_EVENTS) {
      report.events.shift();
      report.droppedEvents++;
    }
    try { onChange(report); } catch { /* Diagnostics must never break a call. */ }
  }
  function providerEvent(value: unknown) {
    const event = object(value);
    const type = event.type;
    if (typeof type !== "string") return;
    if (type === "session.created" || type === "session.updated") {
      const session = object(event.session);
      const audio = object(session.audio);
      const input = object(audio.input);
      const turn = object(input.turn_detection ?? session.turn_detection);
      record(type, {
        sessionId: session.id, model: session.model, voice: object(audio.output).voice ?? session.voice,
        turnType: turn.type, threshold: turn.threshold, prefixPaddingMs: turn.prefix_padding_ms,
        silenceDurationMs: turn.silence_duration_ms, interruptResponse: turn.interrupt_response,
        createResponse: turn.create_response, eagerness: turn.eagerness,
        noiseReduction: object(input.noise_reduction ?? session.input_audio_noise_reduction).type,
      });
      return;
    }
    const response = object(event.response);
    if (type === "response.created") {
      activeResponseId = typeof response.id === "string" ? response.id : undefined;
    }
    // Generation finishing does NOT mean WebRTC playback has finished.
    if (type === "output_audio_buffer.started") outputPlaying = true;
    if (type === "output_audio_buffer.stopped" || type === "output_audio_buffer.cleared") outputPlaying = false;
    const eventTypes = [
      "response.created", "response.done", "response.audio.done", "response.output_audio.done",
      "input_audio_buffer.speech_started", "input_audio_buffer.speech_stopped", "input_audio_buffer.committed",
      "output_audio_buffer.started", "output_audio_buffer.stopped", "output_audio_buffer.cleared",
      "conversation.item.truncated", "conversation.item.deleted", "error",
    ];
    if (!eventTypes.includes(type)) return; // Includes all transcript/audio deltas.
    const details = object(response.status_details);
    const error = object(event.error ?? details.error);
    record(type, {
      responseId: response.id ?? event.response_id, itemId: event.item_id,
      status: response.status, reason: details.reason, errorCode: error.code, errorType: error.type,
      audioStartMs: event.audio_start_ms, audioEndMs: event.audio_end_ms, contentIndex: event.content_index,
    });
  }
  function finish(reason: string) {
    if (report.endedAt) return;
    record("call.closed", { reason });
    report.endedAt = new Date().toISOString();
    try { onChange(report); } catch { /* Best effort only. */ }
  }
  return { report, record, providerEvent, finish };
}

export type VoiceTrace = ReturnType<typeof createVoiceTrace>;
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// Versioned, bounded, device-local retention. Nothing is uploaded automatically.
let memoryReports: VoiceReport[] = [];
let storageAvailable = true;
let loaded = false;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

export function retainedVoiceReports(reports: VoiceReport[], now = Date.now()) {
  return reports.filter((r) => r?.version === 1 && Array.isArray(r.events) &&
    Date.parse(r.startedAt) <= now && now - Date.parse(r.startedAt) < VOICE_RETENTION_MS)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, MAX_VOICE_REPORTS);
}

export function readVoiceReports() {
  if (typeof window === "undefined") return [];
  if (!loaded) {
    loaded = true;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(VOICE_TRACE_KEY) ?? "[]");
      if (Array.isArray(stored)) memoryReports = retainedVoiceReports(stored);
    } catch { storageAvailable = false; }
  }
  memoryReports = retainedVoiceReports(memoryReports);
  return [...memoryReports];
}

export function voiceStorageAvailable() { return storageAvailable; }

export function flushVoiceReports() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = undefined;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VOICE_TRACE_KEY, JSON.stringify(readVoiceReports()));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  window.dispatchEvent(new Event(VOICE_TRACE_EVENT));
}

export function startBrowserVoiceTrace(context: { scenario: string; persona: string }) {
  readVoiceReports();
  const trace = createVoiceTrace({ ...context, id: crypto.randomUUID(), userAgent: navigator.userAgent }, () => {
    if (!persistTimer) persistTimer = setTimeout(flushVoiceReports, 500);
  });
  memoryReports = [trace.report, ...memoryReports].slice(0, MAX_VOICE_REPORTS);
  trace.record("call.start");
  trace.record("page.state", { visibility: document.visibilityState, online: navigator.onLine });
  flushVoiceReports();
  return trace;
}

export function setVoiceAudioRoute(id: string, route: VoiceReport["audioRoute"]) {
  const report = readVoiceReports().find((r) => r.id === id);
  if (report && ["unknown", "speaker", "headphones", "earpiece"].includes(route)) report.audioRoute = route;
  flushVoiceReports();
}

export function clearVoiceReports() {
  memoryReports = [];
  loaded = true;
  flushVoiceReports();
}

export function voiceReportSummary(report: VoiceReport) {
  return {
    speechDuringPlayback: report.events.filter((e) => e.type === "input_audio_buffer.speech_started" && e.data.outputPlaying).length,
    cancelled: report.events.filter((e) => e.type === "response.done" && e.data.status === "cancelled").length,
    marked: report.events.filter((e) => e.type === "user.marked_issue").length,
  };
}

// Only count/quality measurements. Never serialize full RTCStatsReport entries
// (candidate reports contain network addresses; media sources contain device IDs).
export function recordVoiceStats(trace: VoiceTrace, stats: RTCStatsReport) {
  stats.forEach((stat) => {
    if ((stat.kind ?? stat.mediaType) !== "audio") return;
    if (!["inbound-rtp", "outbound-rtp", "remote-inbound-rtp", "media-source"].includes(stat.type)) return;
    const selected: Record<string, unknown> = {};
    for (const key of numericKeys) if (key in stat) selected[key] = stat[key];
    trace.record(`rtc.${stat.type}`, selected);
  });
}

export function observeVoiceMedia(trace: VoiceTrace, pc: RTCPeerConnection, stream: MediaStream, audio: HTMLAudioElement | null) {
  const remove: Array<() => void> = [];
  let stopped = false;
  let sampling = false;
  function listen(target: EventTarget, type: string, fn: () => void) {
    target.addEventListener(type, fn);
    remove.push(() => target.removeEventListener(type, fn));
  }
  stream.getAudioTracks().forEach((track) => {
    trace.record("microphone.settings", track.getSettings() as Record<string, unknown>);
    for (const type of ["mute", "unmute", "ended"]) listen(track, type, () =>
      trace.record(`microphone.${type}`, { enabled: track.enabled, muted: track.muted, trackState: track.readyState }));
  });
  for (const type of ["connectionstatechange", "iceconnectionstatechange", "signalingstatechange"]) {
    listen(pc, type, () => trace.record(`rtc.${type}`, {
      state: pc.connectionState, iceState: pc.iceConnectionState, signalingState: pc.signalingState,
    }));
  }
  if (audio) for (const type of ["playing", "waiting", "stalled", "pause", "ended", "error", "volumechange"]) {
    listen(audio, type, () => trace.record(`playback.${type}`, {
      currentTime: audio.currentTime, readyState: audio.readyState, networkState: audio.networkState,
      paused: audio.paused, muted: audio.muted, ended: audio.ended, volume: audio.volume,
      errorCode: audio.error ? String(audio.error.code) : undefined,
    }));
  }
  listen(document, "visibilitychange", () => {
    trace.record("page.visibility", { visibility: document.visibilityState });
    flushVoiceReports();
  });
  listen(window, "pagehide", () => { trace.record("page.hidden"); flushVoiceReports(); });
  for (const type of ["online", "offline"]) listen(window, type, () => trace.record(`network.${type}`, { online: navigator.onLine }));
  const interval = setInterval(async () => {
    if (sampling || stopped) return;
    sampling = true;
    try {
      const stats = await pc.getStats();
      if (!stopped) recordVoiceStats(trace, stats);
    } catch { if (!stopped) trace.record("rtc.stats_unavailable"); }
    finally { sampling = false; }
  }, 2000);
  return () => {
    stopped = true;
    clearInterval(interval);
    remove.forEach((fn) => fn());
    flushVoiceReports();
  };
}
