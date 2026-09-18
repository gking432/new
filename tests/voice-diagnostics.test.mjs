import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVoiceTrace, safeDiagnosticFields, voiceReportSummary, retainedVoiceReports,
  recordVoiceStats, MAX_VOICE_EVENTS, VOICE_RETENTION_MS,
} from '../lib/realtime/diagnostics.ts';

function trace(onChange) {
  let now = 0;
  return createVoiceTrace({ id: 'test-trace', userAgent: 'iPhone Safari test', scenario: 'speed_to_lead_outbound', persona: 'agent' }, onChange, () => now += 10);
}

test('VAD interruption preserves response reason and playback timeline, without claiming echo', () => {
  const t = trace();
  t.providerEvent({ type: 'response.created', response: { id: 'resp_1' } });
  t.providerEvent({ type: 'output_audio_buffer.started', response_id: 'resp_1' });
  t.providerEvent({ type: 'response.done', response: { id: 'resp_1', status: 'completed' } });
  t.providerEvent({ type: 'input_audio_buffer.speech_started', item_id: 'item_1', audio_start_ms: 100 });
  assert.equal(t.report.events.at(-1).data.outputPlaying, true, 'generation finishing is not playback finishing');
  t.providerEvent({ type: 'response.done', response: { id: 'resp_2', status: 'cancelled', status_details: { reason: 'turn_detected' } } });
  t.providerEvent({ type: 'output_audio_buffer.cleared' });
  t.providerEvent({ type: 'conversation.item.truncated', item_id: 'item_1', audio_end_ms: 600, content_index: 0 });
  t.record('user.marked_issue');
  assert.deepEqual(voiceReportSummary(t.report), { speechDuringPlayback: 1, cancelled: 1, marked: 1 });
  assert.equal(t.report.events[4].data.reason, 'turn_detected');
  assert.equal(t.report.events.at(-1).data.outputPlaying, false);
  assert.ok(t.report.events.every((e, i) => e.seq === i + 1 && e.ms > 0));
});

test('GA and beta session events expose effective configuration, never prompts/secrets', () => {
  for (const config of [
    { audio: { input: { turn_detection: { type: 'server_vad', interrupt_response: true, threshold: 0.5 } } } },
    { turn_detection: { type: 'server_vad', interrupt_response: true, threshold: 0.5 } },
  ]) {
    const t = trace();
    t.providerEvent({ type: 'session.created', session: { ...config, id: 'sess_1', instructions: 'PRIVATE_PROMPT', client_secret: { value: 'PRIVATE_KEY' } } });
    assert.equal(t.report.events[0].data.interruptResponse, true);
    assert.equal(t.report.events[0].data.threshold, 0.5);
    assert.doesNotMatch(JSON.stringify(t.report), /PRIVATE/);
  }
});

test('raw text, audio, credentials, network addresses, and device identifiers cannot enter event fields', () => {
  const t = trace();
  t.providerEvent({ type: 'response.output_audio_transcript.delta', delta: 'PRIVATE_TRANSCRIPT' });
  t.providerEvent({ type: 'response.output_audio.delta', delta: 'PRIVATE_AUDIO' });
  t.providerEvent({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'PRIVATE_CUSTOMER' });
  t.providerEvent({ type: 'response.done', response: { status: 'failed', output: [{ content: [{ transcript: 'PRIVATE_WORDS' }] }], status_details: { error: { code: 'server_error', message: 'PRIVATE_KEY' } } } });
  t.providerEvent({ type: 'error', error: { code: 'invalid_request', message: 'PRIVATE_PROMPT' } });
  t.record('microphone.settings', { echoCancellation: true, sampleRate: 48000, deviceId: 'PRIVATE_DEVICE', groupId: 'PRIVATE_GROUP', label: 'PRIVATE_NAME' });
  t.record('rtc.sample', { sdp: 'PRIVATE_SDP', ip: 'PRIVATE_IP', token: 'PRIVATE_TOKEN', apiKey: 'PRIVATE_API_KEY' });
  assert.doesNotMatch(JSON.stringify(t.report), /PRIVATE/);
  assert.equal(t.report.events.length, 4);
  assert.equal(t.report.events[0].data.errorCode, 'server_error');
  assert.deepEqual(safeDiagnosticFields({ audioLevel: NaN, reason: 'free text with contact@example.com', unknown: 1 }), {});
});

test('network stats keep audio measurements only, missing Safari fields stay absent', () => {
  const t = trace();
  recordVoiceStats(t, new Map([
    ['in', { type: 'inbound-rtp', kind: 'audio', packetsLost: 4, jitter: 0.06, concealedSamples: 50, trackIdentifier: 'PRIVATE_TRACK' }],
    ['source', { type: 'media-source', kind: 'audio', audioLevel: 0.2, deviceId: 'PRIVATE_DEVICE' }],
    ['candidate', { type: 'remote-candidate', ip: 'PRIVATE_IP' }],
    ['video', { type: 'inbound-rtp', kind: 'video', packetsLost: 99 }],
  ]));
  assert.equal(t.report.events.length, 2);
  assert.equal(t.report.events[0].data.packetsLost, 4);
  assert.equal(t.report.events[1].data.echoReturnLoss, undefined);
  assert.doesNotMatch(JSON.stringify(t.report), /PRIVATE/);
});

test('recorder is bounded, close is idempotent, and persistence failure cannot throw into the call', () => {
  const t = trace(() => { throw Error('quota exceeded'); });
  for (let i = 0; i < MAX_VOICE_EVENTS + 20; i++) t.record('user.marked_issue');
  assert.equal(t.report.events.length, MAX_VOICE_EVENTS);
  assert.equal(t.report.droppedEvents, 20);
  t.finish('user_hangup');
  const serialized = JSON.stringify(t.report);
  t.finish('unmount');
  t.record('late.event');
  assert.equal(JSON.stringify(t.report), serialized);
  assert.ok(t.report.endedAt);
});

test('retention expires reports after 24 hours and keeps only three newest', () => {
  const now = Date.now();
  const reports = Array.from({ length: 5 }, (_, i) => ({ ...trace().report, id: String(i), startedAt: new Date(now - i * 1000).toISOString() }));
  reports.push({ ...trace().report, id: 'expired', startedAt: new Date(now - VOICE_RETENTION_MS).toISOString() });
  assert.deepEqual(retainedVoiceReports(reports, now).map((r) => r.id), ['0', '1', '2']);
});

test('blocked browser storage keeps an exportable in-memory report without breaking startup', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '[]', setItem: () => { throw Error('Storage disabled'); } } });
    const browserDiagnostics = await import('../lib/realtime/diagnostics.ts?storage-test');
    const t = browserDiagnostics.startBrowserVoiceTrace({ scenario: 'new_inbound_call', persona: 'agent' });
    t.record('user.marked_issue');
    t.finish('test_complete');
    browserDiagnostics.flushVoiceReports();
    assert.equal(browserDiagnostics.voiceStorageAvailable(), false);
    assert.equal(browserDiagnostics.readVoiceReports()[0].events.at(-1).data.reason, 'test_complete');
    browserDiagnostics.clearVoiceReports();
    assert.equal(browserDiagnostics.readVoiceReports().length, 0);
  } finally {
    for (const [key, descriptor] of [['window', originalWindow], ['localStorage', originalStorage], ['document', originalDocument]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
