# Full guided tour launch review — September 5, 2026

> Historical review, superseded by [the implementation and verification report](full-tour-verification.md). The findings below describe the original pre-fix state.

Recommendation: hold public availability until the navigation/context defects below are fixed and the complete 58-step journey passes a browser walkthrough. This review concerns the current local working tree, which contains pre-existing uncommitted work. No deployment or production environment changes were made.

## Verified

- Production build and type checks passed (`npm run build`).
- ESLint passed (`npm run lint`).
- All 19 HubSpot connector regression tests passed (`npm run test:hubspot`), using mocked external requests.
- The full tour has 58 steps. Every event named in its step definitions has a corresponding source reference outside the tutorial provider. This is a wiring check, not proof that each flow completes.
- Browser verification used localhost:3205 with local demo storage, demo mode, disabled realtime calls, and disabled live HubSpot sync. The full-tour flag was temporarily enabled to access the hidden tour via its existing session persistence, then restored to false. The chooser button itself is separately hard-disabled.
- Silent rep-assisted call populated Jordan Avery's intake form and a booking-ready appointment. Saving created an Appointment Scheduled lead, a linked confirmation task, and an SMS draft. Opening the task reached the approval queue. Approving the simulated SMS cleared the task badge.
- No browser JavaScript errors were reported during the checked segment. Some automation clicks on offscreen controls required DOM activation; this does not establish that those controls are usable at all viewport sizes.

## Findings

### 1. Resume restores the step but loses its page

Reproduced: at “Open Jordan's lead” on /app/leads, choose Exit tour, then Start Tour. The browser navigates to /app while restoring the same instruction. Its `leads-first-row` spotlight target is absent. A visitor has to infer how to recover.

Source: components/tutorial/TutorialProvider.tsx:1263–1281. `start` restores the saved index, then unconditionally navigates to /app. Page-dependent action and event steps can consequently wait for controls on another page.

Fix: persist and restore the required route and customer context, or define a route/precondition for every step. Validate saved indices and provide recovery when the referenced record or action no longer exists. Verify exit/resume and refresh at call, inbox, quote, and automation steps.

### 2. Full-tour customer instructions contradict the selected record

The website-lead step asks visitors to enter their own name. Its submit handler assigns that lead ID to `storylineLeadId`; the urgent-text action uses this ID. Subsequent instructions still say “Review Jordan's message,” “Go back to Jordan's text,” and “Ask Jordan if the time works.” Jordan remains a separate earlier lead when the visitor uses different contact details.

Source: components/tutorial/TutorialProvider.tsx, speed-to-lead, text, go-inbox-urgent-text, back-to-inbox-reschedule, and approve-reschedule-offer definitions.

Fix: name the actual selected customer dynamically, or consistently say “the website lead you just created.” Carry the explicit customer ID through inbox navigation as well as mutations. The current storyline ID is component state and can be lost on refresh away from a lead-detail route; test this before certifying recovery.

### 3. Live voice needs stronger public spending protection

Source: app/api/realtime/session/route.ts. POST uses a module-local array capped at 10 sessions per minute. GET performs a real diagnostic token mint without that limiter. The displayed call duration is enforced by the browser in components/calls/useCallEngine.ts.

These mechanisms do not establish a durable spending cap. This is a shared demo concern, not unique to the full tour. Production key presence, account budgets, deployment protection, and production environment values were not verified.

Fix before enabling public paid voice: protect/remove diagnostic minting, enforce a durable server-side rate/quota policy, and verify provider-level spending controls. A scripted public experience can be reviewed independently of live voice readiness.

## Release checks still required

- Finish the full sequence with a custom website-lead identity, including urgent rescheduling, inbound email, quote generation, feedback, automation output, reports, settings, and completion. Those later interactions were inspected in source but not completed in this browser run.
- Verify laptop and mobile layouts, scrolling to highlighted actions, exit/resume, refresh, and switching from a completed executive tour to a full tour with existing records.
- Verify the deployed environment uses isolated demo storage and disabled external writes. Shared Supabase mode is intentionally no-login and the reset route can reset shared operational data; it is not an acceptable production-data configuration for public portfolio visitors.
- Check accumulated cookie-backed state through the complete long tour. Storage permits up to twelve 3,400-character chunks; build success does not verify deployed request-header capacity.
- Enable both the full-tour flag and its chooser button only after the above. Keep Executive Tour recommended and give the full option a measured duration.

No source changes from this review remain. This report is the only intentional repository addition.
