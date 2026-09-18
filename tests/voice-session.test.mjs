// Exercise the real route while isolating paid APIs, credentials, and storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compiledRoute = ts.transpileModule(
  readFileSync(new URL('../app/api/realtime/session/route.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function routeHarness(successfulAttempt = 1, quotaAllowed = true) {
  const requests = [];
  const scripted = { steps: [], seedFields: {} };
  const dependencies = {
    '@/lib/realtime/quota': { reserveVoiceMint: async () => quotaAllowed, liveVoiceConfigured: () => true },
    '@/lib/calls/scriptedScenarios': { getScriptedScenario: () => scripted },
    '@/lib/integrations/calendar/internalCalendar': { getAvailableSlots: async () => [] },
    '@/lib/realtime/prompts': { buildAiCustomerInstructions: () => 'customer prompt', buildRealtimeInstructions: () => 'agent prompt' },
    '@/lib/supabase/admin': { createAdminClient: () => { throw Error('Unexpected database access'); } },
    '@/lib/demo/mode': { isLocalDemoMode: () => true },
    '@/lib/demo/localWorkflows': { createLocalCallSession: async () => ({ call: { id: 'test-call' }, lead: null, scripted }) },
    '@/lib/demo/localData': { getLocalAvailableSlots: async () => [] },
  };
  const routeModule = { exports: {} };
  runInNewContext(compiledRoute, {
    exports: routeModule.exports, module: routeModule,
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      if (name === 'zod' || name === 'next/server') return require(name);
      throw Error(`Unexpected import: ${name}`);
    },
    process: { env: { OPENAI_API_KEY: 'fake-test-key' } },
    console: { info() {}, error() {} },
    AbortSignal,
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return requests.length === successfulAttempt
        ? Response.json({ value: 'fake-client-secret', client_secret: { value: 'fake-client-secret' } })
        : new Response('mock rejected optional configuration', { status: 400 });
    },
  });
  return { ...routeModule.exports, requests };
}

const callRequest = (persona, extra = {}) => new Request('http://localhost/api/realtime/session', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scenario: 'speed_to_lead_outbound', persona, ...extra }),
});

for (const persona of ['agent', 'customer']) {
  for (const [index, mintPath] of ['ga_full', 'ga_minimal', 'beta'].entries()) {
    test(`${persona}: ${mintPath} preserves tuned detection and the role's interruption policy`, async () => {
      const route = routeHarness(index + 1);
      const response = await route.POST(callRequest(persona));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.mode, 'realtime');
      assert.equal(body.mint_path, mintPath);
      assert.equal(body.call_id, 'test-call');
      assert.equal(route.requests.length, index + 1);
      for (const { body: request } of route.requests) {
        const detection = request.session?.audio.input.turn_detection ?? request.turn_detection;
        assert.deepEqual(detection, {
          type: 'server_vad', threshold: persona === 'agent' ? 0.7 : 0.65,
          prefix_padding_ms: 300, silence_duration_ms: persona === 'agent' ? 800 : 950,
          create_response: true, interrupt_response: persona === 'agent',
        });
      }
      const full = route.requests[0].body.session;
      assert.equal(full.model, 'gpt-realtime');
      assert.equal(full.audio.output.voice, persona === 'agent' ? 'cedar' : 'marin');
      assert.equal(full.audio.input.transcription.model, 'gpt-4o-mini-transcribe');
      if (index >= 1) {
        const minimal = route.requests[1].body.session;
        assert.equal(minimal.audio.output, undefined, 'compatibility retry still drops optional voice');
        assert.equal(minimal.audio.input.transcription, undefined);
        assert.equal(minimal.model, 'gpt-realtime');
      }
      if (index === 2) {
        const beta = route.requests[2];
        assert.equal(beta.url, 'https://api.openai.com/v1/realtime/sessions');
        assert.equal(beta.body.model, 'gpt-4o-realtime-preview', 'existing fallback model is unchanged');
        assert.equal(beta.body.voice, 'sage');
      }
    });
  }
}

test('explicit simulation and read-only availability never contact the provider', async () => {
  const route = routeHarness();
  assert.equal((await (await route.GET()).json()).ok, true);
  assert.equal((await (await route.POST(callRequest('agent', { forceScripted: true }))).json()).mode, 'scripted_fallback');
  assert.equal(route.requests.length, 0);
});

test('quota denial still prevents provider requests', async () => {
  const route = routeHarness(1, false);
  assert.equal((await (await route.POST(callRequest('agent'))).json()).mode, 'scripted_fallback');
  assert.equal(route.requests.length, 0);
});

test('provider failure retains the existing graceful fallback', async () => {
  const route = routeHarness(4);
  const body = await (await route.POST(callRequest('agent'))).json();
  assert.equal(body.mode, 'scripted_fallback');
  assert.equal(body.client_secret, undefined);
  assert.equal(route.requests.length, 3);
});
