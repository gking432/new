# Full tour implementation and verification — September 5, 2026

> September 6 update: the mandatory Redis gate described in this historical
> report was removed at the owner's request. Live voice uses the existing API
> key and enable flag, with a per-process burst limit when Redis is absent.
> Shared quotas are optional; see the README for current configuration.

The full tour is enabled in the local chooser alongside the recommended Executive Tour. It contains 59 steps and eight workflow recaps. This report supersedes the original launch review; no deployment has been performed.

## What changed

- Exit/resume preserves the route and query. Stable step IDs and explicit customer IDs survive reloads. Discarded call/composer panels reopen at their workflow entry point. Saved quote output survives reload without creating another quote.
- The custom website customer remains the customer throughout callback, urgent text, calendar inspection, rescheduling, and confirmation. Both inbox metadata variants work; greetings use the actual name. The callback books an afternoon slot to match the scenario.
- Greg's 12-window email uses actual available weekday openings after 3 PM. Sending a reply moves a New lead to Contacted, without booking an appointment. Quoting keeps the job scope separate from the simulated whole-property count.
- Eight recaps cover assisted intake, website callback, urgent rescheduling, inbound email, quote preparation, feedback, automation, and management review. Each explains the trigger, processing, saved results, approvals, and each tool's responsibility. Tool labels describe application responsibilities, not claims that MCP services are connected. Silent calls, demo rules, simulated property data, and configured AI are distinguished.
- New tours start with fresh demo data, preventing earlier tour records from contaminating the next story. The mobile guide can be minimized; navigation instructions have page buttons. Recap continuation controls remain visible while scrolling.
- Realtime GET is a read-only configuration check. Live token minting requires an atomic shared Redis quota and fails closed when unavailable. Each provider attempt counts toward the quota; short token expiry, request timeouts, and bounded client call duration are configured. These protect minting, not a hard dollar budget or maliciously extended call duration. Public scripted mode does not require paid voice.

## Verification results

- Production build, lint, and TypeScript checks passed.
- All seven checkpoint/quota tests and 19 HubSpot regression tests passed.
- The complete full browser run passed all eight recap and final-data assertions with zero browser errors.
- Executive regression passed, including both optional record inspections, zero browser errors, and clean resets in both tour-switch directions.
- Final full-tour cookie name/value payload was 13,032 bytes in this run; production hosting limits remain a separate check.

## Browser verification

Verification uses a local **production build**, local isolated cookie storage, demo mode, disabled external CRM sync, and disabled live voice. Browser scripts activate actual UI controls and validate resulting saved data; they do not inject tour completion events or rewrite step indices. Standard buttons are sometimes activated through DOM click, so this is not a pointer-accessibility certification.

The full run covers every workflow through completion, including eight populated tool recaps, a custom Taylor Morgan identity, calendar inspection and accepted reschedule, Greg's email constraints, a 12-window quote, review analysis/approval, an automation run with output inspection, reports, and settings. It also checks exit/resume from the lead list, refresh before the urgent message, refresh in the email composer, and refresh after a saved quote.

End-state assertions require exactly three leads, two appointments, Greg at Contacted with no appointment, Taylor's rescheduled appointment, one quote attached to Greg, one feedback record, and one automation run. Availability offers must be weekdays after 3 PM. Browser errors must be empty.

The executive regression follows the full run in the same session, includes both optional CRM record inspections, and checks that starting it removed the earlier full-tour data. Phone-sized chooser and expanded/minimized guide layouts were visually inspected at 390 × 844; the entire mobile journey and live microphone path have not been verified.

## Reproduce

Use a disposable **local demo** server. The browser tests start fresh tours, which reset the demo workspace. Do not point them at a shared operational database.

```bash
npm run build
DEMO_STORAGE=local DEMO_MODE=true ENABLE_HUBSPOT_LIVE_SYNC=false ENABLE_REALTIME_CALLS=false npm run start -- --port 3205
```

In another terminal, with Node 22.6+ and agent-browser's browser installed:

```bash
npm run test:tour
npm run test:hubspot
QA_SESSION=tour-qa node tests/full-tour.browser.mjs
QA_SESSION=tour-qa node tests/executive-tour.browser.mjs
```

`QA_PORT` overrides 3205 for the full test. `QA_SCREENSHOT` optionally saves its completion screenshot. The executive test intentionally reuses the same session immediately afterward.

## Deployment boundary

The code and simulated local experience can be reviewed for release. Before calling the public deployment verified, check its actual environment uses isolated demo storage and disabled external writes, and run the browser journey against its preview URL. The completed tour's cookie payload also needs to fit that hosting platform's request-header limits. Shared Supabase behavior and deployed header limits were not exercised here. Live paid voice additionally needs configured shared quota storage and an explicit provider spending policy; it was not tested with a paid call.
