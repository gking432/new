# Mobile demo guide

The public chooser offers only the Executive Tour. Full-tour launch and resume
are disabled. Below 1024px, the executive demo explains a workflow **before**
the visitor starts it, then gets out of the way. Briefings introduce the callback,
post-call approval, email reply, and reputation workflows.

- **Hide guide** preserves the active tour and current step.
- Working steps stay collapsed automatically. A small 44px-high **Guide** control
  restores help on demand; it does not repeat instructions over the application.
- Opening the callback form hides the guide entirely. On phones the form shows
  name, phone, optional email, and Submit, without the desktop explanation panel,
  address section, or extra project fields. Desktop keeps those optional fields.
- The guide remains hidden during the call; live voice behavior is unchanged.
- Reading steps offer **Next** in the collapsed bar; action steps still wait for
  the existing real navigation/action event and cannot be skipped with Next.
- Only the next workflow's briefing or the result recap reopens automatically,
  not each click within a workflow. Recaps can be hidden without ending the demo.
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

The test uses `agent-browser` through `npx` in its own browser session. It checks
that the full tour cannot start or resume, opens the actual callback form, submits
a sample contact, and verifies the incoming browser call does not reopen the guide.
It does **not answer** that call or create a paid voice connection. It then creates
a sample Greg email and verifies working steps, real action/navigation, manual Next,
recap hiding, and explicit exit at 320×568, 390×844, 844×390, and 1440×900.
Checkpoints seed the email and recap scenarios; this is not a complete live-voice
or voice-to-reputation test. No external customer messages are sent.
`TOUR_TEST_URL` can select another localhost port; use `DEMO_STORAGE=local`.
