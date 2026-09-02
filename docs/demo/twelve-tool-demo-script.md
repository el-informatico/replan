# Twelve-Tool Demo Script — full trip-recovery narrative

- **Status: FINAL (pre-human-run; turn 15 live-corrected — see the deltas
  note)** — duration measured below (≈431 spoken
  words, ≈2:52–3:36 at conversational pace — PAST the 2:45 comfort target
  and past 3:00 at deliberate pace; explicitly flagged in the duration
  section, with the levers that bring a recorded edit back inside 3:00).
  Pacing notes at the bottom.
- Machine-pinned by `evals/functional/demo-script.test.ts` (describe
  "twelve-tool full narrative") — the structure counts, the semantic
  pacing distance, AND every tool output below are asserted; site drift
  fails verify.sh before this page goes stale. Eleven of the twelve turns
  pin against the real offline modules; turn 16's similarity scores are
  LIVE-RECORDED evidence (2026-09-01, prod deployment — concordant with
  the p4c6 calibration), the only values in this script the offline suite
  cannot recompute; the test injects them via the semantic client seam.
- Setup, browser requirements, and troubleshooting are unchanged from the
  Phase 1 script (`agent-memory/current.md`, "In-app-browser demo script —
  five tools"). URL: **https://replan-phi.vercel.app**. Before turn 1,
  the "Agent tools" card must list TWELVE tools as registered.
- **Additive successor** to `docs/demo/eleven-tool-demo-script.md` — the
  Phase 3 human-verified record, kept unchanged. Deltas: turns 15–18 are
  new (the semantic gut-check), the old turns 15–32 are renumbered 19–36,
  turn 2 now says "twelve" (the site registers twelve tools), and three
  agent narrations were tightened to buy back duration (listed in the
  duration section). Every other line is verbatim Phase 3. One later
  LIVE-TESTING correction (p5c6, disclosed in progress.md): turn 15's
  original phrasing anchored ChatGPT to the already-filtered on-screen
  results and never triggered the semantic tool, so the line was
  replaced with a live-verified alternative and turn 16's narration now
  names both top matches (FL-008 and FL-006).

Turn key: `HUMAN n` / `AGENT n` are conversational turns — **36 total**
(18 human, 18 agent). `**Tool call:**` marks the 12 tool invocations.
`[confirmation gate: human says yes]` marks the 5 places ChatGPT's
in-app browser inserts its own "shall I proceed?" safety review before a
transactional tool runs (observed live in Phase 1 on hold/confirm;
expected on all five). Those gate pairs are real turns — turns 6–7,
12–13, 22–23, 26–27, 30–31 below — and are budgeted in the count.
`[semantic pacing…]` in turn 16 marks the rate-limit buffer around the
one live-index call (see the pacing table at the bottom).

---

**TURN 1 — HUMAN:** My flight to Miami was cancelled and I'm stranded.
What tools does this page give you? Call ping with echo set to "ready" to
check the connection.

**TURN 2 — AGENT:** **Tool call:** `ping({echo:"ready"})` →
`{"ok":true,"pong":true,"echo":"ready",…}` "Connected. Twelve
travel-recovery tools on this page — flights, hotels, ground transport,
notifications, costs. Let's get you home."

**TURN 3 — HUMAN:** Search flights to Miami. I must arrive before 3pm
Miami time tomorrow, September 13, and I won't tolerate more than a
four-hour layover.

**TURN 4 — AGENT:** **Tool call:**
`search_flights({destination:"MIA", arrive_before:"2026-09-13T15:00:00-04:00", max_layover_hours:4})`
→ `count:17`, cheapest `FL-015 $299` "Seventeen flights fit. Cheapest is
AV via San José, $299, arriving tomorrow evening."

**TURN 5 — HUMAN:** Hold the Copa flight via Panama - FL-016, $356 -
while I think it over.

**TURN 6 — AGENT:** "I'll place a 15-minute hold on FL-016."
**Tool call:** `hold_reservation({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**

**TURN 7 — HUMAN:** Yes.

**TURN 8 — AGENT:** `ttl_minutes:15`, `hold_expires_at` = call time +
15 min. "Held until 2:15pm — the seat is yours while you decide."

**TURN 9 — HUMAN:** Change of plans - no layover over two hours, that's
firm. Update my constraints and show me what's left.

**TURN 10 — AGENT:** **Tool call:**
`update_constraints({max_layover_hours:2})` → `count:14`, FLL nonstops
lead ($198/$221/$267/$289), FL-015 gone, held FL-016 survives. "Fourteen
options now. Four Fort Lauderdale nonstops lead from $198 — and your
held Copa flight survives the tighter rule."

**TURN 11 — HUMAN:** Keep it simple - book the held Copa flight, FL-016.

**TURN 12 — AGENT:** "I'll confirm FL-016 at $356."
**Tool call:** `confirm_booking({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**

**TURN 13 — HUMAN:** Yes.

**TURN 14 — AGENT:** `confirmation_ref:"RPLN-FL016"`. "Confirmed —
RPLN-FL016, landing Miami 1:45pm today."

**TURN 15 — HUMAN:** Different question - search from scratch:
anything business class, with a bed?

**TURN 16 — AGENT:** **Tool call:**
`search_flights_semantic({query:"business class with a bed"})`
**[semantic pacing: ≥10 s from every other tool call — see pacing table]**
→ `{"ok":true,"count":8,"results":[{"id":"FL-008","airline":"LA","route":"LIM→MIA (nonstop)","departs":"2026-09-12T10:05:00-05:00","arrives":"2026-09-12T17:00:00-04:00","price_usd":942,"similarity_score":0.652},{"id":"FL-006",…0.635},{"id":"FL-023",…0.628},{"id":"FL-003",…0.624},{"id":"FL-021",…0.621},{"id":"FL-022",…0.618},{"id":"FL-007",…0.617},{"id":"FL-004",…0.616}],"note":"Ranked by semantic similarity (live index)."}`
"Two clear matches: the only true business seat — LATAM nonstop, $942,
similarity 0.65 — and LATAM premium economy at $798. Both land after
your Copa; the business seat at 5pm."

*(Turn 16's scores are live evidence: 2026-09-01 curl of the prod
endpoint, `hits:8`, `embed_ms:199`, top FL-008 0.6519→0.652, eighth
FL-004 0.6162→0.616 — concordant with p4c6's recorded 0.652-top /
0.616-tail for the same query. The tool filters at the 0.60 floor; all
8 hits cleared it.)*

**TURN 17 — HUMAN:** Ha - no. $942 to land three hours later? The Copa
stands.

**TURN 18 — AGENT:** "Kept — FL-016, Miami 1:45pm, $356. Now, the room:"

**TURN 19 — HUMAN:** My hotel is downtown by the cruise port. What's
actually available near Miami airport for tonight?

**TURN 20 — AGENT:** **Tool call:**
`search_hotels({city:"Miami", near_airport:"MIA", check_in:"2026-09-12T15:00:00-04:00", check_out:"2026-09-14T15:00:00-04:00"})`
→ `count:6`, cheapest `HT-004 $89/night` "Six bookable near MIA, from
$89 at Civic Center Lodge. Your Bayside Inn is already walkable to the
port."

**TURN 21 — HUMAN:** Keep Bayside Inn - move my check-in to tonight,
8pm.

**TURN 22 — AGENT:** "I'll shift your reservation to an 8pm check-in."
**Tool call:**
`update_hotel_reservation({reservation_id:"HTL-R001", new_check_in:"2026-09-12T20:00:00-04:00"})`
**[confirmation gate: human says yes]**

**TURN 23 — HUMAN:** Yes.

**TURN 24 — AGENT:** `check_out:"2026-09-14T20:00:00-04:00"`,
`total_usd:296`. "Done — two nights through the 14th, price unchanged at
$296."

**TURN 25 — HUMAN:** Book me the shuttle from the airport - I land at
1:45, so make it 2:30.

**TURN 26 — AGENT:** "I'll book the shared shuttle for 2:30pm."
**Tool call:**
`book_ground_transport({type:"shuttle", pickup_time:"2026-09-12T14:30:00-04:00"})`
**[confirmation gate: human says yes]**

**TURN 27 — HUMAN:** Yes.

**TURN 28 — AGENT:** `booking_ref:"RPLN-GT-SHUTTLE-MIA"`,
`price_usd:12.62`, `est_dropoff_iso:"2026-09-12T19:15:00.000Z"`. "Booked —
$12.62, about 45 minutes door to door, drop-off around 3:15pm."

**TURN 29 — HUMAN:** Text my sister Maria - new arrival 1:45pm Miami
time.

**TURN 30 — AGENT:** "I'll send her a heads-up."
**Tool call:**
`notify_contact({contact:{name:"María", phone:"+51 987 654 321"}, new_arrival_time:"2026-09-12T13:45:00-04:00"})`
**[confirmation gate: human says yes]**

**TURN 31 — HUMAN:** Yes.

**TURN 32 — AGENT:** `notification_id:"NTF-001"`, `channel:"sms"`,
`simulated:true`. "Sent — well, simulated: nothing real went out. She'd
see: heads-up, new arrival 1:45pm."

**TURN 33 — HUMAN:** Where am I on budget for all of this?

**TURN 34 — AGENT:** **Tool call:** `calculate_total_cost({})` →
`total_usd:664.62`, `within_budget:false`, `delta_usd:14.62`. "All in:
$664.62 — flight 356, hotel 296, shuttle 12.62. That's $14.62 over your
$650 ceiling."

**TURN 35 — HUMAN:** The cruise matters more than the ceiling - show me
the whole trip in one summary.

**TURN 36 — AGENT:** **Tool call:** `generate_itinerary_summary()` →
`status:"complete"`, `missing:[]`, `notifications.count:1`. "Complete —
FL-016 lands 1:45pm, Bayside Inn through the 14th, 2:30pm shuttle,
sister notified, $664.62 total. You're rebooked."

---

## Semantic-search pacing (rate-limit) — where the ≥10 s spacing holds

Phase 4 found free-tier Gemini embed 429s under burst calls
(live-observed twice; one 1.5 s backoff retry in the action plus 60 s
query memoization in the tool landed as code-level mitigation — defense
in depth, NOT what this script relies on). The script's own guarantee is
structural: the ONE semantic call is never adjacent to another tool
call — at least one full conversational turn separates it from every
other call on both sides — machine-checked by `demo-script.test.ts`
(actual distance: four turns each way, comfortably past the ~10 s
floor):

| | Turn | Turn-distance | Intervening turns (each a full read/type beat) |
|---|---|---|---|
| preceding tool call | 12 — confirm_booking (behind its gate) | 4 | 13 gate "Yes", 14 booking narration, 15 the gut-check ask |
| **semantic call** | **16 — search_flights_semantic** | — | immediate neighbors 15 and 17 are plain conversational turns — no tool call |
| following tool call | 20 — search_hotels | 4 | 17 the decline, 18 the keep-it ack, 19 the hotel ask |

Three intervening turns on each side ≈ three natural typing/reading
cycles — comfortably past the ~10 s floor in both directions. The
semantic tool is called exactly ONCE in the script, so there is no
burst pair to pace against itself. If the model spontaneously offers a
second semantic query (e.g. auto-refining the phrasing), decline it or
let ≥10 s pass — record either way; see the worksheet's pre-run note.

## Duration estimate (recomputed from this document, 2026-09-01)

Words counted from the turn lines above (human turns in full + the
agent's quoted narration; backticked tool-call syntax and JSON are shown
on screen, not read aloud). Same method applied to both scripts:

- **This script: ≈431 words** — 18 HUMAN turns ≈ 200 (13 prompts + five
  "Yes."), 18 AGENT turns ≈ 231 (narration quotes only; includes the
  p5c6 turn-16 correction naming both top matches).
- Recount of the eleven-tool script under its own stated method: **≈373
  words** (HUMAN 176 + AGENT 197) — its published "≈240 words" tally
  undercounts its own document, so its "2:00–2:45" range already
  presumed brisk delivery and light editing. Recorded here so this
  section's numbers are comparable, not laundered.
- **Delta from adding the semantic moment: +58 words** (the four new
  turns 15–18 contribute 64; three narrations were tightened at
  authoring time, giving back 6 — turn 2, which also now says "twelve",
  −2; turn 20, −3; turn 36, −1; all indicative speech, no pinned value
  touched), plus one tool execution beat.

Pace: ≈431 words → **≈2:52 at 150 wpm, ≈3:36 at a deliberate 120 wpm**
— before beats. Beats: 12 tool executions (~1–2 s each once submitted;
the semantic call measured 0.44–0.58 s end-to-end live in the Phase 4
smoke), 5 confirmation-gate pauses (~2–3 s each), and the pacing buffer
around turn 16 — note the buffer costs no dead air: its three-turn
margins each side are conversational turns the story already contains
(13–15 before, 17–19 after); the strictly added time is the four new
turns and one tool beat, already counted above.

**FLAGGED, per the Phase 5 contract: adding the semantic tool with
proper pacing pushes the estimate past the ~2:45 comfort target in
every scenario, and past the 3:00 Devpost hard limit at deliberate
unhurried pace.** This is stated, not absorbed. What keeps a recorded
run inside 3:00:

1. **Paste or voice the prompts — never hand-type them.** Typed by hand
   at even 35 wpm, the ≈207 human words alone would run ≈6 minutes; the
   eleven-tool section's "20–40 s typing" budget implicitly assumed
   pasted or voiced prompts, and that assumption is now explicit.
2. **Timed rehearsal, then edit.** With pasted prompts, one-tap gate
   responses, narration skimmed as it streams, and jump cuts over the
   five one-word "Yes." turns and streaming dwell, a clean edit lands at
   ≈2:15–2:45.
3. **Optional further narration trims** (indicative text only, worth
   ≈5 s together, apply before recording if the rehearsal runs long):
   turn 4 → "Seventeen fit. Cheapest: AV via San José, $299, in
   tomorrow evening." (−2); turn 10 → "Fourteen options — four Fort
   Lauderdale nonstops from $198; your held Copa survives." (−7);
   turn 22 → "Shifting your Bayside check-in to 8pm." (−2).

If a recorded take cannot be brought inside 3:00 with these levers,
that is a finding to record in the worksheet — not a reason to trim the
pinned tool values or the pacing structure.

## Structural counts (machine-checked by demo-script.test.ts)

- Conversational turns: 36 (18 HUMAN + 18 AGENT)
- Tool invocations: 12 (one per registered tool)
- Confirmation gates: 5 — hold_reservation (turns 6–7), confirm_booking
  (12–13), update_hotel_reservation (22–23), book_ground_transport
  (26–27), notify_contact (30–31)
- Semantic pacing: search_flights_semantic (turn 16) has ≥3 intervening
  conversational turns from the nearest other tool call in BOTH
  directions (turn 12 before, turn 20 after) — see the pacing table.
