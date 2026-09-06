# Mobile demo guide

Below 1024px, the executive and full tours use a bottom guide instead of the
desktop sidebar. Each step opens with instructions. The primary mobile button
launches a guide-owned action (such as opening the form), opens the requested
page, or collapses the guide so the visitor can use the highlighted control.

- **Hide guide** preserves the active tour and current step.
- The collapsed bar shows step progress, a short instruction, and **Show instructions**.
- Reading steps offer **Next** in the collapsed bar; action steps still wait for
  the existing real navigation/action event and cannot be skipped with Next.
- Instructions return when the step changes. Workflow recap sheets return at
  the existing checkpoints and can also be hidden without ending the demo.
- **End demo** is separate from hiding the guide. It preserves the existing resume behavior.
- Blue highlights remain non-blocking. Duplicate floating tooltips are desktop-only.
- The app reserves the guide's measured height rather than a fixed fraction of
  the screen, and navigation actions do not require the hidden desktop menu.

Desktop retains its 340px sidebar. This change does not alter CRM writes,
approval policies, call simulation, or which actions complete each workflow.

## Browser regression check

Start an isolated cookie-backed demo server:

```sh
DEMO_STORAGE=local npm run dev -- --port 3100
```

In a second terminal:

```sh
npm run test:tour-mobile
```

The test uses `agent-browser` through `npx` in its own browser session. It creates
a sample Greg email in that session, verifies the real action/navigation flow,
and checks collapse/restore, manual Next, recap hiding, explicit exit, 320×568,
390×844, 844×390, and the 1440×900 desktop layout. Checkpoints seed the email and
recap scenarios; this is not a full voice-to-reputation end-to-end test. No calls
are started and no customer messages are sent. `TOUR_TEST_URL` can point to a
different localhost port; use only a server running with `DEMO_STORAGE=local`.
