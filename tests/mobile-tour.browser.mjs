// Run against an isolated local-demo server (DEMO_STORAGE=local npm run dev -- --port 3100).
// Uses a separate browser session; never starts voice calls or sends customer messages.
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
  checkpoint("executive-email");
  stepIs("executive-email");
  browser("click", '[aria-label="Hide guide, keep demo running"]');
  assert.equal(metrics().active, "1");
  assert.equal(metrics().collapsed, "true");
  assert.ok(metrics().height < 120, "Collapsed rail must leave the phone usable");
  browser("click", '.tour-mobile-bar button');
  assert.equal(metrics().collapsed, "false");

  // Real server action creates the isolated demo email; the existing event flow advances.
  browser("click", '[data-testid="tour-mobile-primary"]');
  stepIs("executive-open-email");
  assert.equal(metrics().collapsed, "false", "Instructions return on advancement");
  browser("click", '[data-testid="tour-mobile-primary"]');
  stepIs("executive-read-email");
  browser("wait", "--fn", "location.pathname === '/app/inbox'");
  browser("wait", '[data-tour="inbox-executive-email"]');
  browser("click", '[data-testid="tour-mobile-primary"]');
  browser("wait", '.tour-mobile-bar button[aria-label="Next step"]');
  assert.equal(metrics().tooltipVisible, false, "No duplicate mobile tooltip");
  assert.equal(metrics().overflow, false);
  browser("click", '.tour-mobile-bar button[aria-label="Next step"]');
  stepIs("executive-reply-email");
  assert.equal(metrics().collapsed, "false");

  for (const [width, height] of [[320,568],[390,844],[844,390]]) {
    browser("set", "viewport", String(width), String(height));
    assert.equal(metrics().overflow, false, `No horizontal overflow at ${width}x${height}`);
    assert.ok(metrics().top >= 0, "Guide fits within the viewport");
    browser("click", '[data-testid="tour-mobile-primary"]');
    assert.ok(metrics().height < 140);
    browser("click", '.tour-mobile-bar button');
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
  console.log("PASS: mobile collapse/restore, real email action, navigation, Next, recap, explicit exit, 3 phone sizes, desktop sidebar.");
} finally {
  browser("close");
}
