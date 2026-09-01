# Current work

## PHASE 4 (semantic flight search via live Convex) — COMPLETE AND CLOSED
## 2026-09-01

search_flights_semantic is the 12th and final tool, LIVE on
https://replan-phi.vercel.app (twelve registrations verified in the served
bundle; GEMINI key value 0 hits). Architecture per ADR-0006/D011: Convex
free-plan project `replan`, prod deployment **resolute-malamute-859**
(us-east-1), 26 flights embedded once with gemini-embedding-001 @768d
(one-time seed via `npm run seed:semantic` + `npx convex import --prod`);
public `POST /api/semantic-search` httpAction (CORS) → internalAction
(embed + vectorSearch + hydrate); browser tool uses native fetch
(VITE_CONVEX_SITE_URL, set in Vercel — the repo's first deploy-time env
var) and hydrates rows LOCALLY from flights.json (source of truth). Key
lives only in Convex env vars. Relevance floor MIN_SIMILARITY=0.60
(live-calibrated: on-topic 0.616–0.694, garbage 0.556–0.567). Independent
review closed: no majors; findings fixed/disclosed in p4c8 + plan §7.

Operational notes that matter next session:
- **Free-tier Gemini embed RPM is small**: bursts 429 (live-observed
  twice). Tool memoizes ok:true outcomes 60 s per query; action retries
  once after 1.5 s. For the demo video: space semantic queries by ~10 s+
  and re-verify the canned queries first (plan §6 pre-demo floor re-check).
- Backend edits are gated by `npx convex deploy`'s typecheck, NOT
  verify.sh (plan §7); always deploy after touching convex/.
- Reseed: `npx convex run semantic:clearFlights --prod` then
  `npx convex import --table flights convex-seed.jsonl --prod` (plain
  import into an existing table refuses — live-proven; `--replace` also
  exists).
- Cleanup pending (dashboard): scratch project replan-vector-preflight
  (optimistic-alligator-511) and spare deployment calm-mosquito-532.

## What Phase 5 (12-tool demo script + worksheet) should assume

1. Extend docs/demo/eleven-tool-demo-script.md → a 12-tool version AND
   evals/functional/demo-script.test.ts (its counts — 32 turns, `toBe(11)`,
   the 11-name list, the ungated list — are machine-pinned and MUST move
   together; grep for the literal 11s the codebase-analysis listed).
2. Use the semantic tool's REAL verified examples (live, 2026-09-01):
   "cheapest option that leaves at dawn" → FL-021 0.717 top (also FL-026,
   FL-005); "business class with a bed" → FL-008 0.652 top; empty case:
   garbage phrasing → count 0 with rephrase note. Phrase queries
   POSITIVELY — negation does not invert ("I hate flying all night"
   returns red-eyes).
3. Expect NO ChatGPT confirmation gate (readOnly precedent; single data
   point caveat).
4. The page shows the tool via the Tool-call log card (storeless tool —
   no dedicated results panel); phase-note copy already says "Twelve
   tools… everything else stays simulated."

---

**PHASE 2 (Multi-domain expansion) COMPLETE AND CLOSED — 2026-08-31.** Six
tools implemented per their own Layer-1 contracts (T5–T10 in
docs/plans/phase2-execution-plan.md), independently reviewed (2 majors +
9 minors, ALL fixed with regression tests in p2c10), deployed, and live.
The eleven-tool site is verified by verify.sh --url + bundle grep; the
in-app-browser human pass is Phase 3's job (below).

## Live state

- Repo: https://github.com/el-informatico/replan — Phase 2 commits
  `66c2d4d` → p2c10 (plan+contracts+ADR-0005 → T5 → T6 → T7 → T8 → T9 →
  T10 → UI → functional eval → review fixes), all verify-gated, no
  AI-attribution trailers.
- Site: **https://replan-phi.vercel.app** — production (deployment
  replan-msyxdi6hx); served bundle `assets/index-CbfTzfiT.js` contains
  ALL ELEVEN tool registrations (5 Phase 1 + `search_hotels`,
  `update_hotel_reservation`, `book_ground_transport`, `notify_contact`,
  `calculate_total_cost`, `generate_itinerary_summary`); `verify.sh --url`
  exit 0.
- Tests: 19 files / 186 tests green (unit per tool + dataset invariants +
  4 evals/functional tests incl. the multi-domain narrative chain).

## Phase 2 design decisions that set the pattern for anything after it

1. **Hotel lifecycle = scenario-seeded reservation (D008/ADR-0004
   addendum), NOT a hold/confirm pair.** The tool ceiling is fixed at 11;
   the original trip's booking seeds as HTL-R001 (Bayside Inn Downtown,
   2 nights, $296) and update_hotel_reservation shifts it with flight-tool
   conventions (NOT_FOUND w/ ids+count, deterministic idempotency by
   instant, check_out shifts preserving nights, cross-tool
   CHECK_IN_BEFORE_ARRIVAL). No hotel hold/TTL — documented deviation.
2. **Ground transport = fare model, not a vehicle list (ADR-0005).** 3
   types × 6 routes (MIA/FLL × 3 hotel zones), prices DERIVED
   (base+per_km×distance, round2 once). Route is state-derived: pickup
   location = confirmed flight's last-segment airport; destination = hotel
   reservation's zone. Singleton booking, re-book REPLACES (no cancel
   tool → an error would dead-end the agent).
3. **Read-time honesty (reviewer major 2, p2c10): write-time validation
   can be superseded by a later flight re-confirmation.**
   generate_itinerary_summary re-derives hotel + transport entries against
   the CURRENT booking — per-entry stale_reason + status
   'needs_attention' (stale dominates missing); update_hotel_reservation
   checks arrival BEFORE idempotency. calculate_total_cost still sums
   state by contract. If Phase 3+ adds another cross-tool-anchored item,
   it needs the same read-time re-derivation + stale flag.
4. **One trip-total definition (D010)**: src/domain/trip.ts
   buildCostBreakdown — used by calculate_total_cost,
   generate_itinerary_summary, AND the UI running-total card. Budget =
   stored constraints.maxPriceUsd (never caller-supplied); flight =
   latestBooking (confirmedAt), earlier bookings don't double-count.
5. **Budget enforcement is per-widest-case**: budgets.test.ts covers TOOLS
   char budgets (11 entries) + fresh-state outputs; each tool's own suite
   asserts its WIDEST output ≤1.5K where the fixture lives. When adding a
   tool, find the true widest case (not just any passing case — reviewer
   major 1 was exactly that mistake).

## What Phase 3 (in-app-browser human verification of the six tools)
## should assume

1. **Same pattern as Phase 1's close — and the script + pinned test
   ALREADY EXIST (p2c15, ahead of Phase 3)**: docs/demo/
   eleven-tool-demo-script.md is the full-narrative script (32 turns,
   11 tools, 5 gates) and demo-script.test.ts pins both its structure and
   every output against the real modules. Phase 3 = run it in ChatGPT
   Desktop (GPT-5.6 Sol/Terra) or Chrome 149+ with the webmcp-testing
   flag, and record the outcome in this file.
2. **Expect the confirmation gate** on ALL THREE transactional-ish tools
   (update_hotel_reservation, book_ground_transport, notify_contact) —
   budget a "Yes" turn for each; search/cost/summary should run direct
   (see "Observed" below; single-data-point caveat stands).
3. **A coherent Phase-3 demo sequence** (state-dependent chains — order
   matters): rebook flight first (hold+confirm FL-016, arrives MIA
   2026-09-12T13:45-04:00, $356) → search_hotels Miami/MIA window
   09-12→14 (count 6 after crunch exclusions — HT-003 and HT-006 sold out
   on the 12th, HT-009 has no rooms; cheapest first is HT-004 $89) →
   update_hotel_reservation HTL-R001 to 2026-09-12T20:00-04:00 (check_out
   shifts to 09-14T20:00, nights 2, total $296; idempotent re-send safe) →
   book_ground_transport shuttle 14:30 (RPLN-GT-SHUTTLE-MIA, $12.62, ~45
   min, drop-off computed; taxi→shuttle replace demos replaced_previous) →
   notify_contact {name, phone} (NTF-001, sms, simulated:true) →
   calculate_total_cost (356+296+12.62 = 664.62, OVER the $650 seed by
   14.62 — the narrative moment; update_constraints max_price 700 flips
   it to within, delta −35.38) → generate_itinerary_summary (complete,
   missing [], notifications count 1). Optional stale-demo: confirm
   FL-021 after transport → summary shows needs_attention with a
   stale_reason pointing at FLL.
4. **The page now shows**: a live Trip-total card (running total +
   budget badge, red border when over), hotel results, the seeded/updated
   hotel reservation, ground transport, and simulated notifications —
   every tool call re-renders them live.
5. Research re-verification done 2026-08-31 (plan §2): NO WebMCP API
   delta; `webmcp.dev` is an unrelated third-party project (trust only
   webmachinelearning.github.io/webmcp + developer.chrome.com/docs/ai/webmcp
   + learn.chatgpt.com). 11 tools is at the edge of practitioner-reported
   selection degradation — descriptions kept ≤300 chars; re-verify docs
   again before Phase 3.

## Open items

1. **Phase 2 in-app-browser verification: OPEN — Phase 3** (assumptions
   above; a fresh session should read CONTINUITY.md + this file first).
2. **(= Phase 1 open item 3) CLOSED — 2026-08-31, p2c14.** The approved
   AI-assistance disclosure now sits in README.md (## AI Assistance,
   between Deployed and License), inserted verbatim — diffed against the
   approved block: match. Its factual claims were verified BEFORE
   insertion: full-history trailer grep returns only two `CLAUDE.md`
   filename matches (zero attribution trailers); docs/ + agent-memory/
   hold the process record; per-commit test gating is audit-A1-evidenced.
3. (Optional polish) Dynamic tool registration still deferred (D006) —
   11 static tools chosen for judge-facing predictability; the scored
   "WebMCP Leverage" opportunity remains if there's slack before Sep 3.
4. **(= Phase 1 open item 5) CLOSED — 2026-08-31, p2c15.** The demo now
   has a full eleven-tool script WITH the confirmation gates budgeted as
   real turns: docs/demo/eleven-tool-demo-script.md — 32 conversational
   turns (16 human + 16 agent), 11 tool calls, 5 gates marked
   "[confirmation gate: human says yes]" (hold_reservation, confirm_booking,
   update_hotel_reservation, book_ground_transport, notify_contact).
   Machine-pinned by demo-script.test.ts: structure counts asserted
   against the document itself + every scripted output executed against
   the real modules. Measured duration ≈240 spoken words ≈ 1:36–2:00
   plus UI beats → ≈2:00–2:45 wall-clock, inside the 3:00 Devpost limit.
   The Phase 1 five-tool script below stays as the historical verified
   record.
5. evals/regression/ README still promises per-failure suites; Phase 1+2
   keep regressions as named tests in colocated suites (convention) —
   reconcile the README wording when convenient.

## Closure audit (2026-08-31) — CLOSED, one code fix (d0bac3c)

The reviewing session audited the Phase 2 closure (raw evidence + three
design clarifications); full record in
docs/reviews/phase2-closure-audit.md, raw reviewer output preserved in
docs/reviews/phase2-independent-review.md. Outcome: A1 per-commit verify
evidence quoted (commit-message Evidence lines + per-tree worktree
re-runs, all exit 0; capture gap — piped filters, no durable per-commit
log at commit time — disclosed); A3 literal bundle greps pasted (the
audit's double-quote pattern returns 0 — minifier emits backticks; the
corrected pattern returns exactly 1 per tool; 11 names × 1 each);
B1 answered: the hotel seed+shift (D008) was driven by the dispatch's
11-tool DONE criterion, NOT by the tool-count research finding (which
shaped description length only); B3: the stale-leg cycle has a single
end-to-end test (summary.test.ts:100) — no gap. One real defect found
and fixed as its own verify-gated increment p2c12 (d0bac3c): the trip
total now flags multiple_bookings_detected + superseded_flight_ids when
more than one distinct flight is booked (B2 — same read-time honesty
standard as stale_reason; total semantics unchanged; plan §7 amendment
6). 19 files / 188 tests at d0bac3c; pushed, trailers clean.

## Observed (documented fact, 2026-08-31): ChatGPT confirmation gate on
## write-action tools

During the human-verified smoke test, ChatGPT Desktop's in-app browser
inserted an extra confirmation turn ("Would you like me to proceed?" → human
replies "Yes") before executing BOTH transactional tools —
`hold_reservation` AND `confirm_booking`. The read-only/preference tools
(`ping`, `search_flights`, `update_constraints`) executed directly with no
extra turn.

- This is ChatGPT's own per-invocation safety review for non-read-only
  calls — NOT a bug in our implementation, and NOT controllable from the
  page (there is no WebMCP API to suppress or customize it).
- Notably the gate did not map 1:1 onto our `readOnlyHint` annotations:
  `update_constraints` carries NO annotation at all (in code, only `ping`
  is `readOnlyHint: true` and `search_flights` `false`; the three mutating
  tools are unmarked — i.e. not advertised read-only, the same category as
  the two gated tools) yet executed directly — ChatGPT judged per-tool
  stakes (transactional booking actions vs. preference updates), not the
  annotation. Single data point; treat as observation, not spec.
  [Corrected 2026-08-31: this bullet first said update_constraints "is
  annotated `readOnlyHint: false`" — imprecise; the code carries no
  annotation on it. Conclusion unchanged. The pushed d9470e8 commit body
  has the same imprecision; left as-is.]
- **Demo-video planning implication**: budget TWO extra human "Yes" turns —
  one before the hold call, one before the confirm call. A video script
  written from the six-turn script below should plan ~8 spoken turns, and
  the pacing around turns 3 and 5 should leave room for the gate.
- Phase 2 corollary: a future `notify_*` or any booking-ish tool should be
  EXPECTED to hit the same gate when the agent drives it.

**Flagged discrepancy (deliberately not auto-corrected):** the demo script
below assumes 5–6 human turns with no confirmation gates. The real
conversation is ~7–8 turns. The script text is kept as-is pending the
user's call on whether to bake the two "Yes" turns into it (it changes the
video shot list). `evals/functional/demo-script.test.ts` asserts TOOL
OUTPUTS only — no turn-count assertions — so there is nothing to change in
code or tests; this is purely a script/video-planning input.

## Phase 1 — open verification: CLOSED (PASSED 2026-08-31)

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
    Path used: A — ChatGPT Desktop in-app browser — date: 2026-08-31
    Result: PASSED. All five turns matched the documented expected output
    exactly: Turn 1 ping ✓; Turn 2 count=17, FL-015 $299 first, ascending ✓;
    Turn 3 FL-016 ttl_minutes=15, expiry exactly 15 min from call ✓;
    Turn 4 count 17→14, FL-015 dropped, FLL $198/$221/$267/$289 promoted,
    FL-016 hold survived, live UI re-render ✓; Turn 5
    confirmation_ref="RPLN-FL016" ✓.
    Deviations from script: NONE in tool output. One conversational
    addition — ChatGPT inserted a "proceed?" / "Yes" confirmation turn
    before BOTH write-action tools (hold_reservation, confirm_booking);
    read-only tools ran directly. See "Observed" section above.
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
