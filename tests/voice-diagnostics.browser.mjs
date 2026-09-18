// Local-only integration test: the real call UI/engine with a fake microphone,
// WebRTC peer and provider events. No OpenAI requests, real mic, or customer sends.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const base = process.env.TOUR_TEST_URL ?? 'http://localhost:3100';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const session = `voice-diagnostics-${process.pid}`;
const browser = (...args) => {
  // Explicit scrolling also supports native automation backends that don't
  // auto-scroll off-screen semantic targets before clicking.
  if (args[0] === 'find' && args[1] === 'role' && args[2] === 'button' && args[3] === 'click') {
    const name = args[args.indexOf('--name') + 1];
    browser('eval', `(() => {const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label') ?? b.textContent.trim())===${JSON.stringify(name)});b?.scrollIntoView({block:'center',behavior:'instant'});return true;})()`);
  }
  return execFileSync('npx', ['--yes', 'agent-browser', '--session', session, ...args], { encoding: 'utf8', timeout: 45000 }).trim();
};
const evaluate = (js) => JSON.parse(browser('eval', js));
const key = 'northstar-voice-diagnostics-v1';
function installFakeVoice() {
  const state = window.__voiceTest = { sent: [], requestCount: 0 };
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = String(input);
    if (url === '/api/realtime/session') {
      state.requestCount++;
      return Response.json({ call_id: 'test-call', mode: 'realtime', scenario: 'new_inbound_call', max_seconds: 180,
        scripted: { steps: [], seedFields: {} }, client_secret: 'PRIVATE_CREDENTIAL', model: 'gpt-realtime',
        realtime_api: 'ga', mint_path: 'ga_full', webrtc_url: 'https://api.openai.com/v1/realtime/calls' });
    }
    if (url.startsWith('https://api.openai.com/')) return new Response('fake-sdp');
    return originalFetch(input, init);
  };
  const track = new EventTarget();
  Object.assign(track, { enabled: true, muted: false, readyState: 'live', stop() { this.readyState = 'ended'; },
    getSettings() { return { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, deviceId: 'PRIVATE_DEVICE_ID' }; } });
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [track], getAudioTracks: () => [track] });
  HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('PRIVATE_ERROR_MESSAGE', 'NotAllowedError'));
  window.RTCPeerConnection = class extends EventTarget {
    connectionState = 'new'; iceConnectionState = 'new'; signalingState = 'stable';
    constructor() { super(); state.pc = this; }
    addTrack() {}
    createDataChannel() {
      state.dc = { readyState: 'open', send: (s) => state.sent.push(JSON.parse(s)) };
      return state.dc;
    }
    async createOffer() { return { type: 'offer', sdp: 'PRIVATE_SDP' }; }
    async setLocalDescription() {}
    async setRemoteDescription() {
      this.connectionState = 'connected';
      this.iceConnectionState = 'connected';
      setTimeout(() => {
        state.dc.onopen();
        this.dispatchEvent(new Event('connectionstatechange'));
        this.ontrack({ streams: [new MediaStream()], track });
      }, 20);
    }
    async getStats() { return new Map([['audio', { type: 'inbound-rtp', kind: 'audio', packetsLost: 3, jitter: 0.04, concealedSamples: 24 }]]); }
    close() { this.connectionState = 'closed'; state.dc.onclose?.(); }
  };
  state.emit = (event) => state.dc.onmessage({ data: JSON.stringify(event) });
  return true;
}

try {
  browser('set', 'viewport', '390', '844');
  browser('open', base + '/app/demo-center');
  browser('find', 'role', 'button', 'click', '--name', 'Exit tour', '--exact');
  browser('wait', '#voice-diagnostics');
  evaluate(`(${installFakeVoice.toString()})()`);
  browser('find', 'role', 'button', 'click', '--name', 'Simulate inbound call', '--exact');
  browser('find', 'role', 'button', 'click', '--name', 'Answer', '--exact');
  browser('wait', '--fn', "Boolean(document.querySelector('audio')) && Boolean(window.__voiceTest.dc?.onmessage)");
  evaluate(`(() => {
    const emit = window.__voiceTest.emit;
    emit({type:'session.created',session:{id:'sess_test',model:'gpt-realtime',instructions:'PRIVATE_PROMPT',client_secret:{value:'PRIVATE_SECRET'},audio:{input:{turn_detection:{type:'server_vad',threshold:0.5,interrupt_response:true,create_response:true}},output:{voice:'cedar'}}}});
    emit({type:'response.created',response:{id:'resp_test'}});
    emit({type:'output_audio_buffer.started',response_id:'resp_test'});
    emit({type:'input_audio_buffer.speech_started',item_id:'item_test',audio_start_ms:300});
    emit({type:'response.done',response:{id:'resp_test',status:'cancelled',status_details:{reason:'turn_detected'},output:[{content:[{transcript:'PRIVATE_TRANSCRIPT',audio:'PRIVATE_AUDIO'}]}]}});
    emit({type:'output_audio_buffer.cleared',response_id:'resp_test'});
    document.querySelector('audio').dispatchEvent(new Event('waiting'));
    return true;
  })()`);
  browser('find', 'role', 'button', 'click', '--name', 'Mark audio issue', '--exact');
  browser('wait', '--fn', `JSON.parse(localStorage.getItem('${key}') ?? '[]')[0]?.events.some(e=>e.type==='rtc.inbound-rtp')`);
  const events = evaluate(`JSON.parse(localStorage.getItem('${key}'))[0].events`);
  for (const type of ['session.selected', 'session.created', 'microphone.settings', 'playback.play_rejected', 'rtc.inbound-rtp', 'response.done', 'user.marked_issue', 'playback.waiting']) assert.ok(events.some((e) => e.type === type), type);
  assert.equal(events.find((e) => e.type === 'response.done').data.reason, 'turn_detected');
  assert.equal(events.find((e) => e.type === 'input_audio_buffer.speech_started').data.outputPlaying, true);
  assert.deepEqual(evaluate('window.__voiceTest.sent'), [{ type: 'response.create' }], 'diagnostics send no provider commands');
  assert.equal(evaluate('window.__voiceTest.requestCount'), 1);
  // Exercise the real cleanup path without a fake CRM completion write.
  evaluate("window.__voiceTest.pc.connectionState='failed';window.__voiceTest.pc.onconnectionstatechange();true");
  browser('wait', '--fn', `Boolean(JSON.parse(localStorage.getItem('${key}'))[0].endedAt)`);
  const saved = evaluate(`JSON.parse(localStorage.getItem('${key}'))[0]`);
  assert.equal(saved.events.at(-1).data.reason, 'fallback');
  assert.doesNotMatch(JSON.stringify(saved), /PRIVATE/);
  browser('open', base + '/app/demo-center#voice-diagnostics');
  browser('wait', '#voice-diagnostics select');
  assert.ok(browser('get', 'text', '#voice-diagnostics').includes('1 cancelled responses'));
  assert.equal(evaluate(`JSON.parse(localStorage.getItem('${key}'))[0].id`), saved.id, 'survives a full reload');
  browser('select', '#voice-audio-route', 'speaker');
  // Validate files/clipboard handed to export APIs, without actually sharing externally.
  evaluate(`(() => {
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{window.__sharedVoice=await files[0].text();}});
    Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async(text)=>{window.__copiedVoice=text;}});
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob) => { blob.text().then(text => window.__downloadedVoice=text); return create(blob); };
    HTMLAnchorElement.prototype.click=function(){};
    return true;
  })()`);
  browser('find', 'role', 'button', 'click', '--name', 'Share report', '--exact');
  browser('find', 'role', 'button', 'click', '--name', 'Download report', '--exact');
  browser('find', 'role', 'button', 'click', '--name', 'Copy report', '--exact');
  browser('wait', '--fn', 'Boolean(window.__sharedVoice && window.__downloadedVoice && window.__copiedVoice)');
  const exported = evaluate('JSON.parse(window.__sharedVoice)');
  assert.equal(exported.audioRoute, 'speaker');
  assert.equal(exported.summary.marked, 1);
  assert.doesNotMatch(JSON.stringify(exported), /PRIVATE/);
  assert.equal(evaluate('window.__sharedVoice===window.__downloadedVoice && window.__sharedVoice===window.__copiedVoice'), true);
  for (const [width, height] of [[320,568],[390,844],[1440,900]]) {
    browser('set', 'viewport', String(width), String(height));
    assert.equal(evaluate('document.documentElement.scrollWidth > innerWidth'), false, `no overflow at ${width}`);
  }
  browser('set', 'viewport', '390', '844');
  browser('eval', "document.querySelector('#voice-diagnostics').scrollIntoView();true");
  browser('screenshot', '/tmp/voice-diagnostics-mobile.png');
  browser('find', 'role', 'button', 'click', '--name', 'Clear saved reports', '--exact');
  browser('wait', '--fn', `JSON.parse(localStorage.getItem('${key}')).length===0`);
  assert.equal(browser('errors'), '');
  console.log('PASS: real call-engine instrumentation with fake transport, cancellation/playback/mic/stats capture, cleanup, reload persistence, privacy, marker, three exports, mobile/desktop layout, and clear. No live audio test was performed.');
} finally { browser('close'); }
