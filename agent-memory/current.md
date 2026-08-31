# Current work

**PHASE 1 (Core flight tools) COMPLETE AND CLOSED — 2026-08-31.** Four tools
implemented per their own Layer-1 contracts, independently reviewed (8
findings, all fixed with regression tests), deployed, and live.

## Live state

- Repo: https://github.com/el-informatico/replan — Phase 1 commits
  `9f0f125` → `d0d9ab2` (plan+contracts → T1 → T2 → T3 → T4 → authoring
  pass → UI → review fixes), all verify-gated, no AI-attribution trailers.
- Site: **https://replan-phi.vercel.app** — production; served bundle
  contains all five tool registrations (`ping`, `search_flights`,
  `hold_reservation`, `update_constraints`, `confirm_booking`); `verify.sh
  --url` exit 0.
- Tests: 8 files / 73 tests green (unit + `evals/functional/`
  rebooking-narrative — the scripted agent conversation incl. the T1+T3
  re-search narrative, error-recovery, and expired-hold loops).

## What Phase 2 (multi-domain: hotel / ground-transport / notification /
cost-summary) should assume is in place

1. **Tool pattern is fully established** — a Phase 2 tool is: a `WebMcpTool`
   object in `src/tools/<name>.ts` (description ≤500 chars, param
   descriptions ≤150, ≤8 compact result rows, `{ok,…}`/`{ok:false,code,
   error}` envelope, `logToolCall`, registerX() called in App's effect).
   `src/tools/budgets.test.ts` mechanically enforces the char budgets and
   the ≤1.5K output budget for listed tools — ADD NEW TOOLS TO ITS `TOOLS`
   ARRAY (that is the one manual step the pattern requires).
2. **Validators**: `src/tools/validate.ts` (string/number-bounds/
   ISO-with-offset incl. real-calendar rejection/unknown-keys). Use them;
   never hand-roll parsing. Explicit `null` semantics: distinguish
   "clear" from "not provided" at the tool layer (see constraints.ts).
3. **State**: `src/state/store.ts` (ADR-0004) — extend with hotel/transport
   holds etc. via the same Map + lazy-expiry + subscribe pattern; injectable
   clock (`setClockForTests`) for all time logic, INCLUDING UI countdowns
   (App uses store `now()`). Reset between test files via
   `resetForTests()` in beforeEach.
4. **Search reuse**: `searchFlights(flights, filters)` is pure and takes
   array-valued `destination` — Phase 2 searches (hotels near port, etc.)
   should copy the shape: pure domain fn + thin validated tool wrapper +
   compact payload.
5. **Cost summary** tool should read from the store (booking(s) + holds) —
   single subscription point already drives the whole UI.
6. **Process**: contract before code (per-tool, Layer-1 format — see
   docs/plans/phase1-execution-plan.md §2); one verified increment = one
   commit; independent reviewer BEFORE deploy; deploy =
   `vercel deploy --prod --yes --token "$(cat ~/.vercel-token)"` then
   `verify.sh --url https://replan-phi.vercel.app` + bundle grep for new
   tool names; push + trailer re-check every increment.
7. **Judging environment facts**: budget table + authoring guidance in
   docs/research/webmcp-tool-authoring-brief.md — re-verify against live
   Chrome docs before Phase 2 (API is young).

## Open items

1. **Phase 0 in-app-browser verification: CLOSED** — the user confirmed ping
   was proven end-to-end against ChatGPT Desktop's in-app browser (stated in
   the Phase 1 dispatch, 2026-08-31). Registration + discovery + invocation
   all work in the actual judging environment.
2. **Human in-app-browser check of the FOUR NEW tools (the ONE open
   verification)** — same session limitation; procedure below.
3. (User, non-blocking) AI-use disclosure in the GitHub README.
4. (Optional polish) Dynamic tool registration (register hold/confirm only
   in matching page states) is a scored "WebMCP Leverage" opportunity
   deliberately deferred — see D006 for the reasoning; revisit only if
   there's slack before the Sep 3 deadline.

## Phase 1 — open verification (human-run smoke test)

Pick ONE path:

**Path A — ChatGPT in-app browser (the judging environment).** Requires
ChatGPT desktop app, Work/Codex plan, model GPT-5.6 **Sol or Terra** (Luna
has WebMCP disabled).

1. Open the in-app browser → `https://replan-phi.vercel.app`
2. Page must list five tools as `registered` in the **Agent tools** card.
3. Send, in order (the demo narrative):
   - `My Lima→Miami flight was cancelled. What tools does this page give you, and what can you do for me?`
   - `Search flights to Miami — I need to arrive before 3pm Miami time tomorrow, max 4 hour layover.`
   - `Actually my budget is $300 max. Update my constraints.` → page's Active constraints panel must show $300 AND results must re-filter live.
   - `I'd rather fly overnight.` → preferred_time ordering.
   - `Hold the best option.` → Held seats card with a live countdown.
   - `Book it.` → Reservation confirmed card with an RPLN-… reference.
4. Expected tool results: `{"ok":true,…}` shapes per
   evals/functional/rebooking-narrative.test.ts; every call appears in the
   Tool-call log as it happens.

**Path B — Chrome 149+ with `chrome://flags/#enable-webmcp-testing`**, same
conversation via the side-panel agent, or the "Model Context Tool Inspector"
extension (list tools, execute `search_flights` with
`{"destination":"MIA"}`).

Record the outcome (which path, what matched, paste any JSON that differs)
under this heading — that closes Phase 1's last verification gap.

## Session environment notes (carry forward)

- Loopback TCP blocked for this assistant's shell calls — no local preview
  smokes; use the deployed URL.
- Never `pkill -f` with self-matching patterns; use `fuser -k PORT/tcp`.
- `vercel login` OAuth callback fails in this WSL (mirrored networking);
  token file `~/.vercel-token` (0600) is the path. Vercel CLI 59.10.0.
- Deployment-hash URLs and the `replan-el-informatico` alias SSO-redirect
  (Standard protection); only `replan-phi.vercel.app` is public — always
  smoke that alias.
- GitHub via `gh` (el-informatico, ssh) — push works directly.
