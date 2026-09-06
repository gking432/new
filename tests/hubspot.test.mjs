import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHubSpotPayload,
  buildHubSpotSyncEntries,
  mockHubSpotIds,
  syncToHubSpotLive,
} from "../lib/integrations/hubspot/client.ts";

const greg = Object.freeze({
  first_name: "Greg",
  last_name: "Tomlinson",
  email: "greg.tomlinson@example.com",
  phone: "(262) 555-0198",
  service_type: "windows",
  description: "Interested in replacement windows; inspection times offered, not booked.",
  stage: "new",
  urgency: "high",
  lead_quality: "hot",
  active_leak: "no",
  estimated_value_min: 12000,
  estimated_value_max: 24000,
});

test("Greg's new lead exports contact and note without implying a booking", () => {
  const payload = buildHubSpotPayload(greg, {
    summary: "Greg was offered inspection times.",
    recommended_next_action: "Ask Greg to choose an opening.",
  });
  assert.equal(payload.contact.properties.firstname, "Greg");
  assert.equal(payload.deal, null);
  assert.match(payload.dealSkipReason, /local stage "new"/);
  assert.match(payload.note.properties.hs_note_body, /Stage: new/);
  assert.doesNotMatch(JSON.stringify(payload), /appointmentscheduled/);
  assert.equal(greg.stage, "new");
});

for (const stage of ["new", "contacted", "estimate_sent", "follow_up_needed", "unknown", "constructor"]) {
  test(`unmapped stage ${stage} never falls back to appointment scheduled`, () => {
    const payload = buildHubSpotPayload({ ...greg, stage });
    assert.equal(payload.deal, null);
    assert.ok(payload.dealSkipReason);
    assert.equal(mockHubSpotIds(payload).dealId, null);
  });
}

for (const [stage, expected] of [
  ["appointment_scheduled", "appointmentscheduled"],
  ["won", "closedwon"],
  ["lost", "closedlost"],
]) {
  test(`${stage} maps explicitly to ${expected}`, () => {
    const payload = buildHubSpotPayload({ ...greg, stage });
    assert.equal(payload.deal.properties.dealstage, expected);
    assert.equal(payload.deal.properties.pipeline, "default");
    assert.equal(payload.deal.properties.amount, "18000");
    assert.equal(payload.dealSkipReason, null);
    assert.match(payload.note.properties.hs_note_body, new RegExp(`Stage: ${stage}`));
    assert.match(mockHubSpotIds(payload).dealId, /^demo-/);
  });
}

for (const mode of ["dry_run", "live"]) {
  test(`${mode} audit entries explicitly skip unmapped deals with no external ID`, () => {
    const payload = buildHubSpotPayload(greg);
    const entries = buildHubSpotSyncEntries(payload, mockHubSpotIds(payload), mode);
    const deal = entries.find((entry) => entry.entityType === "deal");
    assert.equal(deal.action, "skip_deal");
    assert.equal(deal.status, "skipped");
    assert.equal(deal.externalId, null);
    assert.deepEqual(deal.request, {});
    assert.deepEqual(deal.response, { reason: payload.dealSkipReason });
    for (const entry of entries.filter((entry) => entry.entityType !== "deal")) {
      assert.equal(entry.status, mode === "dry_run" ? "dry_run" : "success");
    }
  });

  test(`${mode} audit entries retain mapped deals`, () => {
    const payload = buildHubSpotPayload({ ...greg, stage: "won" });
    const ids = mockHubSpotIds(payload);
    const deal = buildHubSpotSyncEntries(payload, ids, mode).find((entry) => entry.entityType === "deal");
    assert.equal(deal.action, "create_deal");
    assert.equal(deal.status, mode === "dry_run" ? "dry_run" : "success");
    assert.equal(deal.externalId, ids.dealId);
    assert.equal(deal.request.properties.dealstage, "closedwon");
  });
}

for (const stage of ["new", "appointment_scheduled", "won", "lost"]) {
  test(`live connector sends only the intended objects for ${stage} (mocked network)`, async (t) => {
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, init) => {
      const path = new URL(url).pathname;
      calls.push({ path, method: init.method, body: JSON.parse(init.body) });
      if (path.endsWith("/search")) {
        return Response.json({ results: [{ id: "existing-contact" }] });
      }
      return Response.json({ id: path.endsWith("/deals") ? "real-deal" : "real-note" });
    });
    const payload = buildHubSpotPayload({ ...greg, stage });
    const outcome = await syncToHubSpotLive("test-token", payload, greg.email);
    assert.equal(outcome.contactId, "existing-contact");
    assert.equal(outcome.noteId, "real-note");
    assert.equal(outcome.dealId, payload.deal ? "real-deal" : null);
    const dealCalls = calls.filter((call) => call.path.endsWith("/deals"));
    assert.equal(dealCalls.length, payload.deal ? 1 : 0);
    if (payload.deal) {
      assert.deepEqual(dealCalls[0].body.properties, payload.deal.properties);
      assert.equal(dealCalls[0].body.associations[0].to.id, "existing-contact");
    }
    const noteCall = calls.find((call) => call.path.endsWith("/notes"));
    assert.equal(noteCall.body.properties.hs_note_body, payload.note.properties.hs_note_body);
    assert.equal(noteCall.body.associations[0].to.id, "existing-contact");
    assert.equal(calls[1].method, "PATCH");
    assert.ok(calls.every((call) => !("dealSkipReason" in call.body)));
  });
}

test("a new contact still syncs without creating a deal", async (t) => {
  const paths = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const path = new URL(url).pathname;
    paths.push(path);
    return Response.json({ id: path.endsWith("/contacts") ? "new-contact" : "new-note" });
  });
  const result = await syncToHubSpotLive("test-token", buildHubSpotPayload(greg));
  assert.deepEqual(paths, ["/crm/v3/objects/contacts", "/crm/v3/objects/notes"]);
  assert.deepEqual(result, { contactId: "new-contact", dealId: null, noteId: "new-note" });
});
