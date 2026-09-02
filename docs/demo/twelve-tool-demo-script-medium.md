# Twelve-Tool Demo Script — MEDIUM variant (pasted prompts, all named trims)

- **Status: FINAL (recording variant)** — a delivery variant of the
  pinned long script, NOT a new script and NOT the source of truth.
  The source of truth is `docs/demo/twelve-tool-demo-script.md`
  (p5c1), machine-pinned against the real tool modules by
  `evals/functional/demo-script.test.ts`. In this variant every tool
  call, its exact arguments, its exact pinned JSON output, the turn
  order and count, and the semantic pacing buffer are IDENTICAL to the
  long script — verified mechanically by
  `evals/functional/demo-script-variants.test.ts`, which fails verify.sh
  if any variant drifts. Only three things differ: agent narration is
  condensed (the long script's named trims, all applied), the human
  PASTES their lines instead of typing or voicing them, and gate
  responses are immediate instead of natural-pause.
- **Delivery method (explicit):** every HUMAN turn below is PASTED
  verbatim from this document — copy the prompt before recording, keep
  this file open beside the browser, and paste-send each line when its
  turn comes. Never retype or paraphrase: the pinned tool outputs
  assume the exact wording. The five confirmation-gate "Yes." turns
  are still delivered live (no editing) but are sent IMMEDIATELY when
  ChatGPT's gate question appears — no pause, no reading break.
- **Pacing reminder (unchanged from the long script):** the semantic
  call at turn 16 keeps its three-turn buffer — do not rush turns
  15–19; pasted does not mean machine-gunned. One semantic call in the
  whole script; if the model offers a second, decline or let ≥10 s
  pass.
- URL: **https://replan-phi.vercel.app**. Before turn 1, the "Agent
  tools" card must list TWELVE tools as registered. Full setup,
  browser/model requirements, and troubleshooting: the long script's
  header and `docs/demo/DEMO-USAGE-GUIDE.md`.

Turn key: identical structure to the long script — **36 turns** (18
human, 18 agent), 12 tool invocations, 5 confirmation gates (turns
6–7, 12–13, 22–23, 26–27, 30–31), semantic call at turn 16 inside its
paced window. Human turns are pasted verbatim; agent narration is the
condensed form. The `[paste]` burden is on you, the operator — the
turn lines below are exactly what gets pasted.

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
→ `count:17`, cheapest `FL-015 $299` "Seventeen fit. Cheapest: AV via
San José, $299, in tomorrow evening."

**TURN 5 — HUMAN:** Hold the Copa flight via Panama - FL-016, $356 -
while I think it over.

**TURN 6 — AGENT:** "I'll place a 15-minute hold on FL-016."
**Tool call:** `hold_reservation({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**
[gate response: answer Yes. immediately when the gate question appears
— no pause]

**TURN 7 — HUMAN:** Yes.

**TURN 8 — AGENT:** `ttl_minutes:15`, `hold_expires_at` = call time +
15 min. "Held until 2:15pm — the seat is yours while you decide."

**TURN 9 — HUMAN:** Change of plans - no layover over two hours, that's
firm. Update my constraints and show me what's left.

**TURN 10 — AGENT:** **Tool call:**
`update_constraints({max_layover_hours:2})` → `count:14`, FLL nonstops
lead ($198/$221/$267/$289), FL-015 gone, held FL-016 survives. "Fourteen
options — four Fort Lauderdale nonstops from $198; your held Copa
survives."

**TURN 11 — HUMAN:** Keep it simple - book the held Copa flight, FL-016.

**TURN 12 — AGENT:** "I'll confirm FL-016 at $356."
**Tool call:** `confirm_booking({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**
[gate response: answer Yes. immediately — no pause]

**TURN 13 — HUMAN:** Yes.

**TURN 14 — AGENT:** `confirmation_ref:"RPLN-FL016"`. "Confirmed —
RPLN-FL016, landing Miami 1:45pm today."

**TURN 15 — HUMAN:** Different question - search from scratch:
anything business class, with a bed?

**TURN 16 — AGENT:** **Tool call:**
`search_flights_semantic({query:"business class with a bed"})`
**[semantic pacing: ≥10 s from every other tool call — see pacing table]**
→ `{"ok":true,"count":8,"results":[{"id":"FL-008","airline":"LA","route":"LIM→MIA (nonstop)","departs":"2026-09-12T10:05:00-05:00","arrives":"2026-09-12T17:00:00-04:00","price_usd":942,"similarity_score":0.652},{"id":"FL-006",…0.635},{"id":"FL-023",…0.628},{"id":"FL-003",…0.624},{"id":"FL-021",…0.621},{"id":"FL-022",…0.618},{"id":"FL-007",…0.617},{"id":"FL-004",…0.616}],"note":"Ranked by semantic similarity (live index)."}`
"One business seat on the board: LATAM nonstop, $942, similarity 0.65 —
lands 5pm, three hours later than yours."

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

**TURN 22 — AGENT:** "Shifting your Bayside check-in to 8pm."
**Tool call:**
`update_hotel_reservation({reservation_id:"HTL-R001", new_check_in:"2026-09-12T20:00:00-04:00"})`
**[confirmation gate: human says yes]**
[gate response: answer Yes. immediately — no pause]

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
[gate response: answer Yes. immediately — no pause]

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
[gate response: answer Yes. immediately — no pause]

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

## Narration changes vs the long script (exactly the three named trims)

The long script's duration section names three optional narration trims;
this variant applies ALL of them, verbatim, and nothing else. Turns 2,
20, and 36 already carry the long script's own earlier tightenings —
they are NOT re-trimmed here.

| Turn | Before (long script) | After (this variant) | Words saved |
|---|---|---|---|
| 4 | "Seventeen flights fit. Cheapest is AV via San José, $299, arriving tomorrow evening." | "Seventeen fit. Cheapest: AV via San José, $299, in tomorrow evening." | 2 |
| 10 | "Fourteen options now. Four Fort Lauderdale nonstops lead from $198 — and your held Copa flight survives the tighter rule." | "Fourteen options — four Fort Lauderdale nonstops from $198; your held Copa survives." | 7 |
| 22 | "I'll shift your reservation to an 8pm check-in." | "Shifting your Bayside check-in to 8pm." | 2 |

(The saved-word figures are the long script's own recorded −2 / −7 / −2
under the corrected counting method; turns 2, 20, and 36 keep the
tightenings the long script already ships.)

## Duration estimate (recomputed with the corrected method)

Words counted exactly as Phase 5 established (human turns in full +
agent quoted narration; backticked tool-call syntax and JSON excluded):
**408 words — 18 HUMAN turns = 200 (13 prompts + five "Yes."), 18
AGENT turns = 208.** Same parser on the long script gives 431 — this
variant saves 23 narration words (since the p5c6 live correction the
long script's turn-16 narration names both top matches; this variant's
stays condensed to the top match, which is still accurate — FL-008 is
the dataset's only business cabin).

Delivery model (assumptions stated; this is a single unedited take —
no post-editing in this variant):

- Agent narration 208 words read-along: **83 s at 150 wpm, 104 s at a
  deliberate 120 wpm.**
- 13 pasted prompts at 2–4 s each (copy staged, side-by-side window):
  **26–52 s.** (Typing them by hand instead would be ≈207 words at
  ~35 wpm ≈ 6 minutes — the reason the long script's typed estimate
  cannot fit.)
- 5 gates, question rendering ~1 s + immediate "Yes." ~1 s: **10 s.**
- 12 tool executions at 1–2 s each (semantic measured 0.44–0.58 s
  live): **12–24 s.**
- Transition/dead-air overhead, brisk operator: **10–20 s.**

**Total ≈ 2:21–3:30 (component midpoint ≈ 2:55).** Stated plainly: this
variant fits under 3:00 ONLY on a brisk take — best case ≈ 39 s of
margin, worst case ≈ 30 s OVER the limit. It is a rehearse-and-time
variant, not a guaranteed fit: if a timed rehearsal lands above ≈2:50,
use the short variant for the actual take.

## Consistency with the long script (machine-checked)

`evals/functional/demo-script-variants.test.ts` asserts, for this file
and its siblings, that the tool-call turn vector
[2,4,6,10,12,16,20,22,26,30,34,36], every tool name and argument
string, every pinned JSON fragment (all backticked values), the
UNQUOTED turn prose (output summaries and the turn-16 evidence note),
every human turn text, the 5 gate positions, and the semantic 3-turn
buffer are IDENTICAL across the three documents, that narration length
never grows (long ≥ medium ≥ short per turn), and that money/score/
flight-id values spoken in narration never mutate. Drift on any of
those fails verify.sh before it reaches a recording; narration WORDING
is deliberately variant-specific and unguarded.
