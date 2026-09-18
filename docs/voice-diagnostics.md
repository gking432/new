# Voice interruption diagnostics

Every answered call attempt now starts a device-local technical report. This is
instrumentation only: no model, prompt, microphone constraints, VAD thresholds,
interruption policy, or normal call timing was changed. No analytics vendor or
new paid service is required.

## Reproduce on iPhone Safari

1. Start the executive demo and answer the live voice call on the iPhone speaker.
2. When you hear an unexplained cutoff, tap **Mark audio issue**. This inserts a
   timestamp; the other events are captured automatically even without a marker.
3. End the call normally. On the **same device and site**, open
   **Demo Center → Voice diagnostics** (`/app/demo-center#voice-diagnostics`).
4. Select the call, set **How were you listening?** to **Phone speaker**, then
   **Share report**. Safari uses the native share sheet when file sharing is
   available; otherwise use **Download report** or **Copy report**.
5. Attach that JSON report when reporting the issue. A second, separate call on
   headphones can provide a useful comparison, but is not required to collect
   the initial evidence.

Reports remain available across page reloads, capped at 3 calls and 800 events
per call. Reports older than 24 hours are discarded on the next diagnostics
read/write. Clear saved reports removes them on that device. If browser storage
is blocked/full, reports remain in memory and the panel warns to export before
leaving the page. Closing/crashing Safari can lose the final, not-yet-flushed
events (writes are batched at 500 ms; page hide and normal hangup flush).

## What is captured

- Relative monotonic event timestamps, sequence numbers, browser/OS user agent,
  call/response/item/session IDs, model and API/mint path.
- Effective `session.created` / `session.updated` turn-detection configuration.
  These are the provider's reported settings, not an assumption based on our
  requested configuration. GA and beta event shapes are supported.
- Speech start/stop, response status and cancellation reason, output buffer
  start/stop/clear, truncation, and provider error codes (not error messages).
- Reported microphone settings (echo cancellation/noise suppression/automatic
  gain), microphone mute/end, and HTML audio playing/waiting/stalled/error events.
- Connection/data-channel state, SDP exchange HTTP status, page visibility and
  online/offline events. No SDP or network addresses are saved.
- Audio-only WebRTC statistics every 2 seconds: packet counts/loss, jitter,
  concealment, audio levels/energy and round-trip time when the browser exposes
  them. Missing metrics mean unavailable, not zero.
- User issue markers and app closure reasons: manual hangup, goodbye timer,
  duration cap, fallback, failure, or unmount.

No raw audio, transcripts, prompts, contact details, credentials, device IDs,
candidate addresses, or full provider payloads are stored in this diagnostic
report. Fields are allowlisted. Diagnostics are **not automatically uploaded**.
The existing application call transcript/CRM workflow is separate and unchanged.
Successful session setup emits `realtime.session.ready` to existing server logs
with the call ID/model/API/mint path for correlation, never the client secret.

## Interpretation (do not guess)

- `response.done` with `status: cancelled` and `reason: turn_detected` establishes
  server speech detection caused cancellation. It does **not** establish whether
  the input was human speech, speaker echo, or noise.
- `input_audio_buffer.speech_started` with `outputPlaying: true` shows overlap
  with the provider's WebRTC output buffer. `response.done` does not clear this
  flag; generation completion is not playback completion.
- `output_audio_buffer.cleared` / `conversation.item.truncated` are useful even
  when generation had already completed before playback was interrupted.
- `playback.waiting`, `playback.stalled`, rejected `play()`, connection-state
  changes, and quality-stat deltas help distinguish playback/network problems.
- The user-selected audio route is an observation, **not automatic detection**.
- An absent `endedAt` can mean ongoing capture or an unexpected page exit.
- Use `droppedEvents` to recognize an incomplete bounded timeline.

Official event semantics:
[Realtime response.done](https://developers.openai.com/api/reference/resources/realtime/server-events#response.done),
[interruption and truncation](https://developers.openai.com/api/docs/guides/realtime-conversations#interruption-and-truncation).

## Verification

`npm run test:voice` covers event semantics, GA/beta settings, field privacy,
audio-stat selection, bounded storage, retention and storage-failure behavior.

On an isolated local server, `npm run test:voice-browser` drives the real call
engine with a **fake microphone/peer/provider** and checks report creation,
cancellation reasons, issue marking, cleanup, reload persistence, export payloads
for sharing/downloading/copying, mobile layout and deletion. No OpenAI request or
actual acoustic test is performed. An actual iPhone speaker reproduction is still
needed to diagnose the originally reported problem; desktop emulation cannot
verify iPhone echo cancellation or the native Safari share sheet.
