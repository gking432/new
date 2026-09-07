// Run against an isolated local-demo server (DEMO_STORAGE=local npm run dev -- --port 3100).
// Uses a separate browser session; submits a sample form and shows the incoming
// browser call without answering it. No paid voice connection or customer sends.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const base = process.env.TOUR_TEST_URL ?? "http://localhost:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local server required");
const session = `mobile-regression-${process.pid}`;
const browser = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", session, ...args], {
  encoding: "utf8", timeout: 45000,
}).trim();
const evaluate = (js) => JSON.parse(browser("eval", js));
const stepIs = (id) => browser("wait", "--fn", `document.querySelector('.tour-sidebar')?.dataset.tourStep === ${JSON.stringify(id)}`);
const metrics = () => evaluate(`(() => {
  const guide = document.querySelector('.tour-sidebar');
  const rect = guide?.getBoundingClientRect();
  return { active: sessionStorage.getItem('northstar-executive-tour-active'),
    collapsed: guide?.dataset.collapsed, height: rect?.height, top: rect?.top,
    overflow: document.documentElement.scrollWidth > innerWidth,
    tooltipVisible: [...document.querySelectorAll('[data-testid="tour-tooltip"]')].some(el => el.getBoundingClientRect().width > 0) };
})()`);
function checkpoint(stepId, route = "/app") {
  browser("eval", `sessionStorage.setItem('northstar-selected-tour-mode','executive');
    sessionStorage.setItem('northstar-executive-tour-active','1');
    sessionStorage.setItem('northstar-tour-checkpoint-executive',JSON.stringify(${JSON.stringify({stepId,route,storylineLeadId:null,gregLeadId:null})}));`);
  browser("open", base + route);
}

try {
  browser("set", "viewport", "390", "844");
  browser("open", base + "/app");
  browser("wait", "--fn", "document.body.innerText.includes('Executive Tour')");
  assert.equal(evaluate("document.body.innerText.includes('Full Guided Tour')"), false);
  // Old saved full-tour sessions must not expose the unreleased tour either.
  browser("eval", "sessionStorage.setItem('northstar-selected-tour-mode','full');sessionStorage.setItem('northstar-tutorial-active','1')");
  browser("open", base + "/app");
  browser("wait", "--fn", "sessionStorage.getItem('northstar-tutorial-active') === '0'");
  assert.equal(evaluate("document.body.innerText.includes('Full Guided Tour')"), false);
  browser("find", "role", "button", "click", "--name", "Executive Tour");
  stepIs("speed-to-lead");
  assert.equal(metrics().collapsed, "false");
  assert.ok(evaluate("document.querySelector('#tour-guide-content').innerText.includes('allow microphone access')"));
  browser("click", '[data-testid="tour-mobile-primary"]');
  browser("wait", '[data-testid="tour-request-form"]');
  for (const [width, height] of [[320,568],[390,844],[844,390]]) {
    browser("set", "viewport", String(width), String(height));
    assert.equal(metrics().height, 0, "No guide at all while completing the form");
    assert.equal(evaluate("document.querySelector('[data-testid=\"request-form-explanation\"]').getBoundingClientRect().height"), 0);
    assert.equal(metrics().overflow, false);
    if (height >= 568) assert.ok(evaluate("document.querySelector('button[type=submit]').getBoundingClientRect().bottom < innerHeight"), "Submit fits without scrolling on a small portrait phone");
  }
  browser("set", "viewport", "1440", "900");
  assert.ok(evaluate("document.querySelector('[data-testid=\"request-form-explanation\"]').getBoundingClientRect().height > 0"), "Desktop keeps the explanation");
  assert.ok(metrics().height > 0, "Desktop keeps the guide beside the form");
  browser("set", "viewport", "390", "844");
  browser("fill", "#first_name", "Avery");
  browser("fill", "#last_name", "Mobile");
  browser("fill", "#phone", "4145550199");
  browser("find", "role", "button", "click", "--name", "Submit Request", "--exact");
  stepIs("answer-call");
  browser("wait", "--fn", "document.querySelector('.tour-sidebar')?.getBoundingClientRect().height === 0");
  assert.equal(metrics().height, 0, "Call is unobstructed, not another instruction sheet");
  // Reload discards the unconnected call before testing a separate workflow.
  checkpoint("executive-email");
  stepIs("executive-email");
  browser("click", '[aria-label="Hide guide, keep demo running"]');
  assert.equal(metrics().active, "1");
  assert.equal(metrics().collapsed, "true");
  assert.ok(metrics().height <= 50, "Working mode is a small Guide control, not an instruction panel");
  browser("click", '.tour-mobile-bar button');
  assert.equal(metrics().collapsed, "false");

  // Real server action creates the isolated demo email; the existing event flow advances.
  browser("click", '[data-testid="tour-mobile-primary"]');
  stepIs("executive-open-email");
  assert.equal(metrics().collapsed, "true", "Working steps do not reopen instructions");
  browser("find", "role", "button", "click", "--name", "Open inbox", "--exact");
  stepIs("executive-read-email");
  browser("wait", "--fn", "location.pathname === '/app/inbox'");
  browser("wait", '[data-tour="inbox-executive-email"]');
  assert.equal(metrics().collapsed, "true", "Reading the email leaves the app visible");
  browser("wait", '.tour-mobile-bar button[aria-label="Next step"]');
  assert.equal(metrics().tooltipVisible, false, "No duplicate mobile tooltip");
  assert.equal(metrics().overflow, false);
  browser("click", '.tour-mobile-bar button[aria-label="Next step"]');
  stepIs("executive-reply-email");
  assert.equal(metrics().collapsed, "true");

  for (const [width, height] of [[320,568],[390,844],[844,390]]) {
    browser("set", "viewport", String(width), String(height));
    assert.equal(metrics().overflow, false, `No horizontal overflow at ${width}x${height}`);
    assert.ok(metrics().top >= 0, "Guide fits within the viewport");
    assert.ok(metrics().height <= 50);
    browser("click", '.tour-mobile-bar button');
    assert.equal(metrics().collapsed, "false");
    browser("click", '[data-testid="tour-mobile-primary"]');
  }
  browser("set", "viewport", "1440", "900");
  assert.equal(evaluate("Math.round(document.querySelector('.tour-sidebar').getBoundingClientRect().width)"), 340);
  assert.equal(evaluate("getComputedStyle(document.querySelector('.tour-mobile-bar')).display"), "none");

  browser("set", "viewport", "320", "568");
  checkpoint("executive-email-recap", "/app/inbox");
  browser("wait", '[data-tour-step="executive-email-recap"]');
  assert.equal(evaluate("document.documentElement.scrollWidth > innerWidth"), false);
  browser("find", "role", "button", "click", "--name", "Hide recap", "--exact");
  browser("wait", '[aria-label="Workflow recap"]');
  assert.equal(metrics().active, "1", "Hiding recap is not ending the demo");
  browser("click", '[aria-label="Workflow recap"] button');
  browser("wait", '[data-tour-step="executive-email-recap"]');
  browser("find", "role", "button", "click", "--name", "End demo", "--exact");
  browser("wait", "--fn", "sessionStorage.getItem('northstar-executive-tour-active') === '0'");
  assert.equal(evaluate("Boolean(document.querySelector('[data-nextjs-dialog]'))"), false);
  assert.equal(browser("errors"), "", "No browser runtime errors");
  console.log("PASS: full tour hidden (including saved sessions), pre-form briefing, compact form, unobstructed incoming call, working steps stay collapsed, email action/navigation/Next, recap/exit, 3 phone sizes, desktop instructions preserved.");
} finally {
  browser("close");
}
