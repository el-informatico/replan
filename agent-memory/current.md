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

**Path A — ChatGPT Desktop in-app browser (the judging environment).**
Requires: ChatGPT desktop app, Work/Codex plan, model GPT-5.6 **Sol or
Terra** (Luna has WebMCP disabled).

**Path B — Chrome 149+ with `chrome://flags/#enable-webmcp-testing`**
enabled (restart after setting). Same turns below via the side-panel agent.
Path B additionally gives you DevTools (see troubleshooting note).

The full script below is machine-verified by
`evals/functional/demo-script.test.ts` — if the site's code drifts, that
test fails verify.sh before the script's numbers go stale.

---

### In-app-browser demo script — five tools

```
URL
    https://replan-phi.vercel.app

SETUP
    Nothing to configure on the site. Open the URL, then start the chat.
    First message asks ChatGPT to discover the tools itself — that IS the
    WebMCP check (no manifest, no refresh: discovery is automatic on a
    WebMCP-capable browser).
    Before turn 1, glance at the page: the "Agent tools" card must list
    FIVE tools with status "registered":
    ping, search_flights, hold_reservation, update_constraints,
    confirm_booking.
    (If any say "unavailable", stop — see troubleshooting.)

TURN 1 — discovery + ping (warm-up)
    Type:  My flight was cancelled and I'm stranded. What tools does this
           page give you? Call ping with echo set to "ready" to check the
           connection.
    Expect ChatGPT to name the five tools, then call ping.
    Tool output (exact):
    {"ok":true,"pong":true,"echo":"ready","received_at_utc":"<now, ISO>"}
    Page: a "ping" entry appears in the Tool-call log the moment it runs.

TURN 2 — search_flights (real constraints, non-empty result)
    Type:  Search flights to Miami. I must arrive before 3pm Miami time
           tomorrow (Sep 13), and I won't tolerate more than a 4-hour
           layover.
    Tool call: search_flights {destination:"MIA",
               arrive_before:"2026-09-13T15:00:00-04:00",
               max_layover_hours:4}
    Tool output (exact shape and values):
    {"ok":true,"count":17,"showing":8,
     "note":"Showing 8 of 17 — tighten filters to narrow.",
     "results":[
       {"id":"FL-015","airline":"AV","route":"LIM→MIA (1-stop)",
        "departs":"2026-09-12T11:20:00-05:00",
        "arrives":"2026-09-12T22:00:00-04:00","price_usd":299},
       {"id":"FL-017", ... "price_usd":318},
       {"id":"FL-010", ... "price_usd":329},
       {"id":"FL-016", ... "price_usd":356},
       {"id":"FL-009", ... "price_usd":387},
       {"id":"FL-014", ... "price_usd":403},
       {"id":"FL-013", ... "price_usd":441},
       {"id":"FL-007", ... "price_usd":449}]}
    Pass check: count is EXACTLY 17; first row is FL-015 at $299; rows are
    price-ascending. Page: Results card shows 17 flights.

TURN 3 — hold_reservation (on a real id from turn 2)
    Type:  Hold FL-016 for me — the $356 Copa one via Panama.
    Tool output (exact):
    {"ok":true,"flight_id":"FL-016",
     "hold_expires_at":"<now + 15 minutes, ISO>",
     "ttl_minutes":15,
     "note":"Simulated hold (no backend): expires after 15 minutes
            wall-clock and does not survive a page reload. Confirm with
            confirm_booking before it lapses."}
    Pass check: ttl_minutes is 15 and hold_expires_at is 15 minutes after
    the current time (count it on your watch). Page: "Held seats" card
    appears showing FL-016 with a live mm:ss countdown; FL-016's row in
    Results gets a "held" badge.

TURN 4 — update_constraints (THE narrative moment)
    Type:  Change of plans — no layover over 2 hours, that's firm. Update
           my constraints and show me what's left.
    Tool call: update_constraints {max_layover_hours:2}
    Tool output (exact):
    {"ok":true,
     "constraints":{"destination_airports":["MIA","FLL"],
       "arrive_before":"2026-09-13T15:00:00-04:00",
       "max_price_usd":650,"max_layover_hours":2,
       "preferred_time":null},
     "count":14,"showing":8,
     "note":"Showing 8 of 14 — tighten filters to narrow.",
     "results":[
       {"id":"FL-021","airline":"NK","route":"LIM→FLL (nonstop)",
        "departs":"2026-09-12T23:30:00-05:00",
        "arrives":"2026-09-13T06:05:00-04:00","price_usd":198},
       {"id":"FL-022", ... "price_usd":221},
       {"id":"FL-023", ... "price_usd":267},
       {"id":"FL-024", ... "price_usd":289},
       {"id":"FL-010", ... "price_usd":329},
       {"id":"FL-016", ... "price_usd":356},
       {"id":"FL-009", ... "price_usd":387},
       {"id":"FL-014", ... "price_usd":403}]}
    BEFORE/AFTER — the concrete, checkable difference:
      count 17 → 14
      FL-015 ($299, via SJO, 220-min layover) was the CHEAPEST in turn 2 —
        it is GONE now (layover cap 120 min).
      Four Fort Lauderdale (FLL) alternates now LEAD the list at $198/$221/
        $267/$289 — the scenario widened to both airports, so the cheapest
        option flipped from a 1-stop MIA flight to an FLL nonstop.
      Still-present hold: FL-016 survives the tightening (65-min layover).
    Page: the Active constraints panel flips to "max layover 2 h" and the
    Results card re-renders live — this is the demo moment.

TURN 5 — confirm_booking (on the held flight)
    Type:  Book FL-016, the one you're holding.
    Tool output (exact):
    {"ok":true,"status":"confirmed","confirmation_ref":"RPLN-FL016",
     "confirmed_at":"<now, ISO>",
     "flight":{"id":"FL-016","airline_code":"CM",
       "route":"LIM→MIA (1-stop)",
       "depart_iso":"2026-09-12T04:05:00-05:00",
       "arrive_iso":"2026-09-12T13:45:00-04:00",
       "duration_minutes":520,"stops":1,
       "total_layover_minutes":65,"price_usd":356,"cabin":"economy",
       "seats_left":4,"refundable":false,
       "tags":["one-stop","tight-connection"],
       "segments":[
         {"flight_number":"CM 800","from":"LIM","to":"PTY",
          "depart_iso":"2026-09-12T04:05:00-05:00",
          "arrive_iso":"2026-09-12T08:15:00-05:00"},
         {"flight_number":"CM 339","from":"PTY","to":"MIA",
          "depart_iso":"2026-09-12T09:20:00-05:00",
          "arrive_iso":"2026-09-12T13:45:00-04:00"}]},
     "price_usd":356,"cabin":"economy"}
    Pass check: confirmation_ref is EXACTLY "RPLN-FL016" (deterministic).
    Page: the "Held seats" card disappears and a green "Reservation
    confirmed ✓" card appears with RPLN-FL016, the segment list, and $356.

OPTIONAL TURN 6 — idempotency
    Type:  Book FL-016 again.
    Tool output: identical to turn 5 plus "idempotent":true — same
    confirmation_ref, same confirmed_at, no second booking.

TROUBLESHOOTING
    - A tool shows "unavailable" on the page → document.modelContext is
      missing: not a WebMCP browser, not Sol/Terra, or non-secure context
      (the URL above is HTTPS, so it's the browser/model).
    - A tool call silently does nothing → in ChatGPT, check the address-bar
      "Site tools" indicator and Settings → Browser → Permissions →
      Enable site tools; each invocation gets a safety review.
    - Chrome (Path B) only: open DevTools → Console on the page tab. The
      registrar logs registration failures prefixed "[webmcp]" (e.g.
      "[webmcp] registerTool(<name>) failed:" with the DOMException). Any
      red [webmcp] line at load = registration problem; no [webmcp] lines
      + "registered" cards = healthy.
    - ChatGPT's in-app browser has no DevTools — rely on the page's own
      cards (Agent tools / Tool-call log), which render every registration
      status and invocation live.

RECORD THE OUTCOME HERE AFTER RUNNING
    Path used: A / B — date: ______
    Turns that matched: ______   Any JSON that differed (paste): ______
```

Record the outcome in the block above — that closes Phase 1's last
verification gap.

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
