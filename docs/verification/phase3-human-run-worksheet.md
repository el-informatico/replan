# Phase 3 — human in-app-browser run worksheet (eleven-tool narrative)

Turn-by-turn checklist for the ONLY remaining Phase 3 step: a human
operating ChatGPT Desktop's in-app browser (or Chrome 149+ with
`chrome://flags/#enable-webmcp-testing`) against
**https://replan-phi.vercel.app**, following the canonical script.

- **Canonical script:** `docs/demo/eleven-tool-demo-script.md` @
  `ed6a0b3`. Human-turn prompts below are copied verbatim from it — say
  them as written; do not paraphrase. If a prompt here and the script
  ever disagree, the script wins and the disagreement is a worksheet bug
  to report.
- **Pinned expectations:** `evals/functional/demo-script.test.ts` @
  `ed6a0b3` (both its "eleven-tool full narrative" describes and the
  three Phase-1 describes that pin the flight-tool outputs in full).
  Every "Expected (pinned)" line below restates a value asserted by
  that test against the real modules — except where explicitly marked
  as pinned by a tool's own colocated suite or as output-shape-only.
- **Strict vs. indicative:** tool outputs are compared STRICTLY (exact
  value). The agent's spoken lines are INDICATIVE — ChatGPT will word
  them differently; only the tool calls and returned values must match.
- Pre-flight (automated, 2026-08-31): `verify.sh --url` exit 0; live
  site serves `assets/index-CDMD7Y9_.js`, sha256-identical to a fresh
  build of `ed6a0b3`; all eleven tool registrations present in the
  served bundle, exactly one each.

## Why the confirmation-gate lines exist (read before running)

The "shall I proceed? → Yes" gate is **ChatGPT's own per-invocation
safety review of a non-read-only tool call**. It is not emitted by this
site and cannot be suppressed or customized from the page — the WebMCP
API has no such control (recorded observation in
`agent-memory/current.md`, "Observed"). Therefore:

- A gate appearing on a tool the script marks ungated, or a gate
  missing on a tool the script marks gated, is a **finding to record**
  (tick "deviation" and note it), not a failure to hide and not a bug
  in the site.
- It is only an implementation concern if it **contradicts the tool's
  actual `readOnlyHint` annotation** — i.e. a gate on a tool advertised
  `readOnlyHint: true`, since the annotation promises a read-only call.
  Current annotations (source of truth, `src/tools/*.ts` @ `ed6a0b3`):

| Tool | `readOnlyHint` | Gate on this tool would… |
|---|---|---|
| `ping` | `true` (`ping.ts:28`) | contradict the annotation |
| `calculate_total_cost` | `true` (`cost.ts:32`) | contradict the annotation |
| `generate_itinerary_summary` | `true` (`summary.ts:28`) | contradict the annotation |
| `search_flights` | `false` (`search.ts:62`) | be a deviation only |
| `search_hotels` | `false` (`hotels.ts:61`) | be a deviation only |
| `update_constraints` | unset | be a deviation only |
| `hold_reservation` | unset | (gate expected by script) |
| `confirm_booking` | unset | (gate expected by script) |
| `update_hotel_reservation` | unset | (gate expected by script) |
| `book_ground_transport` | unset | (gate expected by script) |
| `notify_contact` | unset | (gate expected by script) |

Phase 1 observed the gate on both `hold_reservation` and
`confirm_booking`, and no gate on `ping`, `search_flights`, or
`update_constraints` — one live data point, which is why every tool
turn below carries an explicit gate line.

## Pre-run checks

- **TURN 0 (OPTIONAL) — output-format orientation, pasted immediately
  before Turn 1 (after the P0 card check):** the scripted conversation
  starts at Turn 1 below. If you want ChatGPT to surface literal,
  copyable tool-call evidence at every step instead of only a
  natural-language summary, send this one message first and wait for a
  plain acknowledgment:
  > Before we start: for the rest of this conversation, whenever you
  > call a tool on this page, please show me the exact tool name, the
  > exact arguments you passed, and the raw JSON you got back — before
  > your own reply. I'd like to double-check the data myself.
  - Purely an output-format request: it names no tools, no arguments,
    and no plan — the traveler's situation and every tool invocation
    stay driven entirely by the scripted HUMAN turns, verbatim as
    written, and it does not touch the confirmation gates (answer
    those as they come).
  - The run is equally valid WITHOUT Turn 0 — the in-app browser's
    tool-use UI normally shows each call and result anyway; this only
    makes the evidence easier to transcribe into this worksheet.
  - Turn 0 is NOT one of the 32 scripted turns: nothing about its
    reply is checked, and it is not a deviation source.
- **P0 — the script's header precondition:** load the URL; the
  **"Agent tools" card must list ELEVEN tools, every row "registered"**
  (it renders a moment after load). Any row "unavailable" → STOP: the
  browser/model isn't WebMCP-capable (the row's detail text says which
  condition failed). Record which rows and their detail text.
  - [ ] P0 observed: 11/11 registered
- **P1 — environment:** ChatGPT Desktop in-app browser (requires a
  Work/Codex plan), model GPT-5.6 **Sol or Terra** (Luna has WebMCP
  disabled), site tools permitted (Settings → Browser → Permissions →
  Enable site tools). Path B: Chrome 149+ with
  `chrome://flags/#enable-webmcp-testing`, restarted, driving the
  side-panel agent. Full Phase-1 browser setup and troubleshooting
  notes: `agent-memory/current.md` (note: its DevTools "[webmcp]"
  console-log tip is stale — current code logs nothing; the page's own
  cards are the source of truth).
  Record: path used ______ , model ______
- **P2 — fresh state:** start from a fresh page load and do not reload
  mid-run (state is in-page; a reload resets holds and bookings). Do
  not ask for anything outside the script — extra bookings change
  later totals (see turn 30 note).
- **Recording:** paste observed tool outputs verbatim. Per turn tick
  exactly one: pass / fail / deviation. "Deviation" = anything real
  that differed (extra gate, different wording of the call, different
  argument values) — describe it; a deviation is a result, not an
  embarrassment.

---

## Act 1 — flights (turns 1–14)

### TURN 1 — HUMAN
**Say (verbatim):**
> My flight to Miami was cancelled and I'm stranded. What tools does
> this page give you? Call ping with echo set to "ready" to check the
> connection.

Expect: ChatGPT names the tools it discovered, then calls ping.
Observed agent reply: ________________________________________________

### TURN 2 — AGENT — tool 1/11 `ping` — gate expected: NO
**Expected tool call:** `ping({echo:"ready"})`
**Expected output (pinned):** `ok:true`, `pong:true`, `echo:"ready"`
(plus `received_at_utc` = the actual call time, ISO-8601 — output-shape
only; no test pins this field, so compare its format, not the value).
**Script's agent line (indicative):** "Connected. This page gives me
eleven travel-recovery tools — flights, hotels, ground transport,
notifications, and costs. Let's get you home."
**Page:** a `ping` entry appears in the Tool-call log.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________
**Confirmation gate appeared? (expected NO — if yes, it CONTRADICTS
`readOnlyHint: true`):** [ ] no  [ ] yes → record as finding

### TURN 3 — HUMAN
**Say (verbatim):**
> Search flights to Miami. I must arrive before 3pm Miami time
> tomorrow, September 13, and I won't tolerate more than a four-hour
> layover.

### TURN 4 — AGENT — tool 2/11 `search_flights` — gate expected: NO
**Expected tool call:**
`search_flights({destination:"MIA", arrive_before:"2026-09-13T15:00:00-04:00", max_layover_hours:4})`
(if ChatGPT passes different arguments, that is a deviation — record
them, and expect different outputs.)
**Expected output (pinned):**
- `ok:true`, `count:17`, `showing:8`,
  `note:"Showing 8 of 17 — tighten filters to narrow."`
- result ids in exactly this order: **FL-015, FL-017, FL-010, FL-016,
  FL-009, FL-014, FL-013, FL-007**
- first row: `FL-015`, price **$299**, airline `AV`, route
  `LIM→MIA (1-stop)`, departs `2026-09-12T11:20:00-05:00`, arrives
  `2026-09-12T22:00:00-04:00`; rows price-ascending.
**Page:** Results card shows 17 flights.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________
**Confirmation gate appeared? (expected NO; annotation is
`readOnlyHint: false`, so a gate would be a deviation, not a
contradiction):** [ ] no  [ ] yes → record as finding

### TURN 5 — HUMAN
**Say (verbatim):**
> Hold the Copa flight via Panama — FL-016, $356 — while I think it
> over.

### TURN 6 — AGENT — tool 3/11 `hold_reservation` — **GATE 1 of 5**
**Script's agent line (indicative):** "I'll place a 15-minute hold on
FL-016."
**Expected tool call:** `hold_reservation({flight_id:"FL-016"})`
**Gate check (before this turn's tool runs):**
- [ ] gate question appeared BEFORE the hold executed
- [ ] no gate — tool ran directly → record as finding (deviation)

### TURN 7 — HUMAN (gate response)
**Say (verbatim):**
> Yes.

(If no gate appeared in turn 6, skip this turn and note it above.)

### TURN 8 — AGENT — hold result
**Expected output (pinned):** `ok:true`, `flight_id:"FL-016"`,
`ttl_minutes:15`, and `hold_expires_at` = **exactly the call time + 15
minutes** (the pinned test, run at a fixed 14:00:00Z clock, yields
`2026-09-12T14:15:00.000Z`; live it tracks the real call time — check
the +15 min relationship, e.g. on your watch).
**Page:** "Held seats" card appears with a live mm:ss countdown;
FL-016's row gains a "held" badge.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________

### TURN 9 — HUMAN
**Say (verbatim):**
> Change of plans — no layover over two hours, that's firm. Update my
> constraints and show me what's left.

### TURN 10 — AGENT — tool 4/11 `update_constraints` — gate expected: NO
**Expected tool call:** `update_constraints({max_layover_hours:2})`
**Expected output (pinned):**
- `ok:true`; `constraints.max_layover_hours:2`; `max_price_usd:650`
  (persisted scenario default); `destination_airports:["MIA","FLL"]`
- `count:14`, `showing:8`,
  `note:"Showing 8 of 14 — tighten filters to narrow."`
- **FL-015 absent** (was the cheapest in turn 4; 220-min layover)
- result ids in exactly this order: **FL-021, FL-022, FL-023, FL-024,
  FL-010, FL-016, FL-009, FL-014** — the four cheapest FLL alternates
  lead at **$198 / $221 / $267 / $289** (three nonstops + FL-024, a
  1-stop with 105-min layover; the script's narration says "FLL
  nonstops" but the pinned data is authoritative — FL-024 showing
  `LIM→FLL (1-stop)` is NOT a deviation), first row route
  `LIM→FLL (nonstop)`
- held FL-016 still present.
**Page:** constraints panel flips to "max layover 2 h"; Results card
re-renders live (the demo moment).
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________
**Confirmation gate appeared? (expected NO — Phase 1 also saw it run
direct despite being unannotated; a gate now would be a deviation, not
a contradiction):** [ ] no  [ ] yes → record as finding

### TURN 11 — HUMAN
**Say (verbatim):**
> Keep it simple — book the held Copa flight, FL-016.

### TURN 12 — AGENT — tool 5/11 `confirm_booking` — **GATE 2 of 5**
**Script's agent line (indicative):** "I'll confirm FL-016 at $356."
**Expected tool call:** `confirm_booking({flight_id:"FL-016"})`
**Gate check (before this turn's tool runs):**
- [ ] gate question appeared BEFORE the booking executed
- [ ] no gate — tool ran directly → record as finding (deviation)

### TURN 13 — HUMAN (gate response)
**Say (verbatim):**
> Yes.

### TURN 14 — AGENT — booking result
**Expected output (pinned):** `ok:true`, `status:"confirmed"`,
**`confirmation_ref:"RPLN-FL016"` (deterministic — must match
exactly)**, `price_usd:356`, `cabin:"economy"`, `flight.route:
"LIM→MIA (1-stop)"`, `confirmed_at` = actual call time.
**Page:** "Held seats" card disappears; green confirmed card shows
RPLN-FL016, the segment list, $356.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________

## Act 2 — hotels + ground + notify (turns 15–28)

### TURN 15 — HUMAN
**Say (verbatim):**
> My hotel is downtown by the cruise port. What's actually available
> near Miami airport for tonight?

### TURN 16 — AGENT — tool 6/11 `search_hotels` — gate expected: NO
**Expected tool call:**
`search_hotels({city:"Miami", near_airport:"MIA", check_in:"2026-09-12T15:00:00-04:00", check_out:"2026-09-14T15:00:00-04:00"})`
**Expected output (pinned):** `count:6` (crunch-night exclusions:
HT-003/HT-006 sold out on the 12th, HT-009 no rooms), first row
**`HT-004`** at **$89/night**, `total_stay_usd:178`.
**Page:** hotel results card renders.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________
**Confirmation gate appeared? (expected NO; annotation is
`readOnlyHint: false` — a gate would be a deviation, not a
contradiction):** [ ] no  [ ] yes → record as finding

### TURN 17 — HUMAN
**Say (verbatim):**
> Keep Bayside Inn — move my check-in to tonight, 8pm.

### TURN 18 — AGENT — tool 7/11 `update_hotel_reservation` — **GATE 3 of 5**
**Script's agent line (indicative):** "I'll shift your reservation to
an 8pm check-in."
**Expected tool call:**
`update_hotel_reservation({reservation_id:"HTL-R001", new_check_in:"2026-09-12T20:00:00-04:00"})`
**Gate check (before this turn's tool runs):**
- [ ] gate question appeared BEFORE the update executed
- [ ] no gate — tool ran directly → record as finding (deviation)

### TURN 19 — HUMAN (gate response)
**Say (verbatim):**
> Yes.

### TURN 20 — AGENT — hotel update result
**Expected output (pinned):** `ok:true`,
`check_in:"2026-09-12T20:00:00-04:00"`,
**`check_out:"2026-09-14T20:00:00-04:00"`** (check-out shifts,
preserving 2 nights), **`total_usd:296`** (price unchanged).
**Page:** hotel reservation card shows the shifted window.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________

### TURN 21 — HUMAN
**Say (verbatim):**
> Book me the shuttle from the airport — I land at 1:45, so make it
> 2:30.

### TURN 22 — AGENT — tool 8/11 `book_ground_transport` — **GATE 4 of 5**
**Script's agent line (indicative):** "I'll book the shared shuttle
for 2:30pm."
**Expected tool call:**
`book_ground_transport({type:"shuttle", pickup_time:"2026-09-12T14:30:00-04:00"})`
(pickup location is state-derived — MIA, from the confirmed flight's
last segment; destination from the hotel zone.)
**Gate check (before this turn's tool runs):**
- [ ] gate question appeared BEFORE the booking executed
- [ ] no gate — tool ran directly → record as finding (deviation)

### TURN 23 — HUMAN (gate response)
**Say (verbatim):**
> Yes.

### TURN 24 — AGENT — transport result
**Expected output (pinned):** **`booking_ref:"RPLN-GT-SHUTTLE-MIA"`**,
**`price_usd:12.62`**, `est_travel_minutes:45`,
**`est_dropoff_iso:"2026-09-12T19:15:00.000Z"`** (14:30 −04:00 pickup
+ 45 min).
**Page:** ground-transport card shows the shuttle booking.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________

### TURN 25 — HUMAN
**Say (verbatim):**
> Text my sister María — new arrival 1:45pm Miami time.

### TURN 26 — AGENT — tool 9/11 `notify_contact` — **GATE 5 of 5**
**Script's agent line (indicative):** "I'll send her a heads-up."
**Expected tool call:**
`notify_contact({contact:{name:"María", phone:"+51 987 654 321"}, new_arrival_time:"2026-09-12T13:45:00-04:00"})`
(if ChatGPT composes a different contact object, record it as a
deviation — the pinned values below assume this exact call.)
**Gate check (before this turn's tool runs):**
- [ ] gate question appeared BEFORE the send executed
- [ ] no gate — tool ran directly → record as finding (deviation)

### TURN 27 — HUMAN (gate response)
**Say (verbatim):**
> Yes.

### TURN 28 — AGENT — notify result
**Expected output (pinned):** **`notification_id:"NTF-001"`**,
**`channel:"sms"`**, **`simulated:true`** (nothing real is sent),
`sent_at` = actual call time (the pinned test, at its fixed clock,
yields `2026-09-12T14:03:00.000Z`).
**Page:** notifications card lists the simulated SMS.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________

## Act 3 — cost + summary (turns 29–32)

### TURN 29 — HUMAN
**Say (verbatim):**
> Where am I on budget for all of this?

### TURN 30 — AGENT — tool 10/11 `calculate_total_cost` — gate expected: NO
**Expected tool call:** `calculate_total_cost({})`
**Expected output (pinned):** **`total_usd:664.62`** (flight 356 +
hotel 296 + shuttle 12.62); `budget:{max_price_usd:650,
within_budget:false, delta_usd:14.62}` — **$14.62 over** the seeded
$650 ceiling (the narrative moment). In this exact sequence
`multiple_bookings_detected` is ABSENT (one flight booking). If you
booked any extra flight during the run, this field correctly APPEARS
with `superseded_flight_ids` — that's the site's double-booking
honesty flag doing its job; record it as a sequence deviation, not a
bug.
**Page:** trip-total card shows $664.62 with the over-budget (red)
state.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________
**Confirmation gate appeared? (expected NO — if yes, it CONTRADICTS
`readOnlyHint: true`):** [ ] no  [ ] yes → record as finding

### TURN 31 — HUMAN
**Say (verbatim):**
> The cruise matters more than the ceiling — show me the whole trip in
> one summary.

### TURN 32 — AGENT — tool 11/11 `generate_itinerary_summary` — gate expected: NO
**Expected tool call:** `generate_itinerary_summary()`
**Expected output (pinned):** `status:"complete"`, `missing:[]`,
`notifications.count:1`; hotel entry `updated:true` with
`stale_reason:null`; transport entry `stale_reason:null`; total
$664.62.
**Page:** summary/total cards reflect the completed trip.
**Observed output:** ________________________________________________
**Result:** [ ] pass  [ ] fail  [ ] deviation → _______________________
**Confirmation gate appeared? (expected NO — if yes, it CONTRADICTS
`readOnlyHint: true`):** [ ] no  [ ] yes → record as finding

---

## Gate tally (fill after the run)

| # | Tool | Script expects gate | Gate appeared? | Notes |
|---|---|---|---|---|
| 1 | hold_reservation (T6–7) | yes | [ ] yes [ ] no | |
| 2 | confirm_booking (T12–13) | yes | [ ] yes [ ] no | |
| 3 | update_hotel_reservation (T18–19) | yes | [ ] yes [ ] no | |
| 4 | book_ground_transport (T22–23) | yes | [ ] yes [ ] no | |
| 5 | notify_contact (T26–27) | yes | [ ] yes [ ] no | |
| — | ping (T2) | no | [ ] no [ ] yes | contradicts `readOnlyHint:true` if yes |
| — | search_flights (T4) | no | [ ] no [ ] yes | |
| — | update_constraints (T10) | no | [ ] no [ ] yes | |
| — | search_hotels (T16) | no | [ ] no [ ] yes | |
| — | calculate_total_cost (T30) | no | [ ] no [ ] yes | contradicts `readOnlyHint:true` if yes |
| — | generate_itinerary_summary (T32) | no | [ ] no [ ] yes | contradicts `readOnlyHint:true` if yes |

## Outcome record (to be completed by the human runner)

This block records what happened — it is left empty here on purpose.
Phase 3's outcome is whatever this block says after the run, recorded
verbatim by the runner; nothing above pre-judges it.

- Path used: ______  Date/time: ______  Model: ______
- Pre-run P0 (11/11 registered): [ ] yes [ ] no → detail:
- The 11 tool-output turns (2, 4, 8, 10, 14, 16, 20, 24, 28, 30, 32):
  pass ___ / fail ___ / deviation ___ (list every fail and deviation
  with the turn number and the observed vs. expected values):
- Gate tally deviations (gates where none expected, or missing where
  expected):
- Anything else observed (UI reactions, timing, model behavior worth
  keeping):

## After the run

Hand this completed worksheet back — the follow-up session records the
results in `agent-memory/` and, if a real discrepancy with a pinned
value shows up, fixes it as a normal verify-gated increment. Do not
edit `current.md`, the script, or any test yourself.
