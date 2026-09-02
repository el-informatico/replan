# Twelve-Tool Demo Script — SHORT variant (post-edited, gates jump-cut)

- **Status: FINAL (recording variant)** — the safety-margin delivery
  variant of the pinned long script, NOT a new script and NOT the
  source of truth. The source of truth is
  `docs/demo/twelve-tool-demo-script.md` (p5c1), machine-pinned against
  the real tool modules by `evals/functional/demo-script.test.ts`. In
  this variant every tool call, its exact arguments, its exact pinned
  JSON output, the turn order and count, and the semantic pacing buffer
  are IDENTICAL to the long script — verified mechanically by
  `evals/functional/demo-script-variants.test.ts`, which fails verify.sh
  if any variant drifts. This variant differs from MEDIUM in exactly
  two ways: agent narration condensed further to the tightest natural
  spoken form, and the five confirmation-gate "Yes" turns removed in
  post-editing via the jump-cuts marked below. (Versus LONG it
  additionally differs in MEDIUM's changes: the three named narration
  trims and pasted delivery.)
- **Delivery method (explicit):** record a normal run — paste every
  HUMAN turn verbatim from this document, answer the five gates live
  and immediately — then apply the documented cut plan in editing.
  The cut plan is part of this variant: the duration estimate below is
  only honest if all of it is applied.
- **Marking cuts while filming (solo-friendly):** say the word cut out
  loud, quietly, immediately after answering each gate — and, if you
  want per-prompt markers too, JUST BEFORE pasting each prompt (not
  after: the marker must land in the region the inter-turn pass
  removes, so it never survives into the final audio). Screen
  recordings have no camera for visual clap-markers; a spoken "cut"
  lands as a visible spike on the audio waveform every editor can scrub
  to. Zero equipment, zero hands.
- **Pacing reminder (unchanged):** the semantic call at turn 16 keeps
  its three-turn buffer — do not rush turns 15–19 even though this
  variant will be edited; the recording must respect the same ≥10 s
  spacing the long script mandates. One semantic call; if the model
  offers a second, decline or let ≥10 s pass.
- URL: **https://replan-phi.vercel.app**. Before turn 1, the "Agent
  tools" card must list TWELVE tools as registered. Full setup and
  troubleshooting: the long script's header and
  `docs/demo/DEMO-USAGE-GUIDE.md`.

Turn key: identical structure to the long script — **36 turns** (18
human, 18 agent), 12 tool invocations, 5 confirmation gates (turns
6–7, 12–13, 22–23, 26–27, 30–31), semantic call at turn 16 inside its
paced window. All 36 turns are still PERFORMED during recording —
including the five "Yes." turns (the run cannot proceed otherwise);
the jump-cuts remove them from the final video only.

---

**TURN 1 — HUMAN:** My flight to Miami was cancelled and I'm stranded.
What tools does this page give you? Call ping with echo set to "ready" to
check the connection.

**TURN 2 — AGENT:** **Tool call:** `ping({echo:"ready"})` →
`{"ok":true,"pong":true,"echo":"ready",…}` "Connected — twelve tools on
this page. Let's get you home."

**TURN 3 — HUMAN:** Search flights to Miami. I must arrive before 3pm
Miami time tomorrow, September 13, and I won't tolerate more than a
four-hour layover.

**TURN 4 — AGENT:** **Tool call:**
`search_flights({destination:"MIA", arrive_before:"2026-09-13T15:00:00-04:00", max_layover_hours:4})`
→ `count:17`, cheapest `FL-015 $299` "Seventeen fit — cheapest $299,
AV via San José."

**TURN 5 — HUMAN:** Hold the Copa flight via Panama — FL-016, $356 —
while I think it over.

**TURN 6 — AGENT:** "I'll place a 15-minute hold on FL-016."
**Tool call:** `hold_reservation({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**
[JUMP-CUT 1 of 5 — CUT IN on the frame right after the gate question
finishes rendering; CUT OUT on the frame the hold result begins to
appear. Removed: the Yes. being sent and the pause around it. Kept:
the gate question itself, so the video still shows ChatGPT's safety
review honestly. Editor's option: to hide the question too, move the
cut-in earlier, to the last frame of the announce line (I'll place a
15-minute hold on FL-016.) — not recommended. Say the word cut out
loud after answering, while filming.]

**TURN 7 — HUMAN:** Yes.

**TURN 8 — AGENT:** `ttl_minutes:15`, `hold_expires_at` = call time +
15 min. "Held until 2:15pm."

**TURN 9 — HUMAN:** Change of plans — no layover over two hours, that's
firm. Update my constraints and show me what's left.

**TURN 10 — AGENT:** **Tool call:**
`update_constraints({max_layover_hours:2})` → `count:14`, FLL nonstops
lead ($198/$221/$267/$289), FL-015 gone, held FL-016 survives. "Fourteen
now. FLL nonstops from $198 — Copa survives."

**TURN 11 — HUMAN:** Keep it simple — book the held Copa flight, FL-016.

**TURN 12 — AGENT:** "Confirming FL-016 at $356."
**Tool call:** `confirm_booking({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**
[JUMP-CUT 2 of 5 — same anchors as cut 1: IN on the fully-rendered gate
question, OUT on the booking result's first frame. Say the word cut
after answering.]

**TURN 13 — HUMAN:** Yes.

**TURN 14 — AGENT:** `confirmation_ref:"RPLN-FL016"`. "Confirmed —
RPLN-FL016, Miami 1:45pm."

**TURN 15 — HUMAN:** Different question — search from scratch:
anything business class, with a bed?

**TURN 16 — AGENT:** **Tool call:**
`search_flights_semantic({query:"business class with a bed"})`
**[semantic pacing: ≥10 s from every other tool call — see pacing table]**
→ `{"ok":true,"count":8,"results":[{"id":"FL-008","airline":"LA","route":"LIM→MIA (nonstop)","departs":"2026-09-12T10:05:00-05:00","arrives":"2026-09-12T17:00:00-04:00","price_usd":942,"similarity_score":0.652},{"id":"FL-006",…0.635},{"id":"FL-023",…0.628},{"id":"FL-003",…0.624},{"id":"FL-021",…0.621},{"id":"FL-022",…0.618},{"id":"FL-007",…0.617},{"id":"FL-004",…0.616}],"note":"Ranked by semantic similarity (live index)."}`
"One business seat: LATAM nonstop, $942, similarity 0.65 — lands 5pm,
later than yours."

*(Turn 16's scores are live evidence: 2026-09-01 curl of the prod
endpoint, `hits:8`, `embed_ms:199`, top FL-008 0.6519→0.652, eighth
FL-004 0.6162→0.616 — concordant with p4c6's recorded 0.652-top /
0.616-tail for the same query. The tool filters at the 0.60 floor; all
8 hits cleared it.)*

**TURN 17 — HUMAN:** Ha — no. $942 to land three hours later? The Copa
stands.

**TURN 18 — AGENT:** "Kept. Now the room:"

**TURN 19 — HUMAN:** My hotel is downtown by the cruise port. What's
actually available near Miami airport for tonight?

**TURN 20 — AGENT:** **Tool call:**
`search_hotels({city:"Miami", near_airport:"MIA", check_in:"2026-09-12T15:00:00-04:00", check_out:"2026-09-14T15:00:00-04:00"})`
→ `count:6`, cheapest `HT-004 $89/night` "Six near MIA from $89 —
Bayside's already walkable to the port."

**TURN 21 — HUMAN:** Keep Bayside Inn — move my check-in to tonight,
8pm.

**TURN 22 — AGENT:** "Shifting check-in to 8pm."
**Tool call:**
`update_hotel_reservation({reservation_id:"HTL-R001", new_check_in:"2026-09-12T20:00:00-04:00"})`
**[confirmation gate: human says yes]**
[JUMP-CUT 3 of 5 — same anchors; OUT on the hotel-update result's
first frame. Say the word cut after answering.]

**TURN 23 — HUMAN:** Yes.

**TURN 24 — AGENT:** `check_out:"2026-09-14T20:00:00-04:00"`,
`total_usd:296`. "Done — two nights, still $296."

**TURN 25 — HUMAN:** Book me the shuttle from the airport — I land at
1:45, so make it 2:30.

**TURN 26 — AGENT:** "Booking the 2:30 shuttle."
**Tool call:**
`book_ground_transport({type:"shuttle", pickup_time:"2026-09-12T14:30:00-04:00"})`
**[confirmation gate: human says yes]**
[JUMP-CUT 4 of 5 — same anchors; OUT on the transport result's first
frame. Say the word cut after answering.]

**TURN 27 — HUMAN:** Yes.

**TURN 28 — AGENT:** `booking_ref:"RPLN-GT-SHUTTLE-MIA"`,
`price_usd:12.62`, `est_dropoff_iso:"2026-09-12T19:15:00.000Z"`. "Booked
— $12.62, drop-off 3:15pm."

**TURN 29 — HUMAN:** Text my sister María — new arrival 1:45pm Miami
time.

**TURN 30 — AGENT:** "Sending it now."
**Tool call:**
`notify_contact({contact:{name:"María", phone:"+51 987 654 321"}, new_arrival_time:"2026-09-12T13:45:00-04:00"})`
**[confirmation gate: human says yes]**
[JUMP-CUT 5 of 5 — same anchors; OUT on the notification result's
first frame. Say the word cut after answering.]

**TURN 31 — HUMAN:** Yes.

**TURN 32 — AGENT:** `notification_id:"NTF-001"`, `channel:"sms"`,
`simulated:true`. "Sent — simulated. She'd see: new arrival 1:45pm."

**TURN 33 — HUMAN:** Where am I on budget for all of this?

**TURN 34 — AGENT:** **Tool call:** `calculate_total_cost({})` →
`total_usd:664.62`, `within_budget:false`, `delta_usd:14.62`. "All in:
$664.62 — $14.62 over your $650 ceiling."

**TURN 35 — HUMAN:** The cruise matters more than the ceiling — show me
the whole trip in one summary.

**TURN 36 — AGENT:** **Tool call:** `generate_itinerary_summary()` →
`status:"complete"`, `missing:[]`, `notifications.count:1`. "Complete —
rebooked, $664.62 all in. Enjoy the cruise."

---

## Narration changes vs the MEDIUM variant (every further cut, before/after)

Medium already carries the long script's three named trims (turns 4,
10, 22 — see the medium variant's table). This variant cuts further;
nothing else changes. Each line below still reads as natural speech —
if a take feels too clipped on camera, revert to the medium line for
that turn and re-time (reverting narration never affects the pinned
values).

| Turn | Before (medium) | After (short) | Words saved |
|---|---|---|---|
| 2 | "Connected. Twelve travel-recovery tools on this page — flights, hotels, ground transport, notifications, costs. Let's get you home." | "Connected — twelve tools on this page. Let's get you home." | 7 |
| 4 | "Seventeen fit. Cheapest: AV via San José, $299, in tomorrow evening." | "Seventeen fit — cheapest $299, AV via San José." | 2 |
| 8 | "Held until 2:15pm — the seat is yours while you decide." | "Held until 2:15pm." | 8 |
| 10 | "Fourteen options — four Fort Lauderdale nonstops from $198; your held Copa survives." | "Fourteen now. FLL nonstops from $198 — Copa survives." | 4 |
| 12 | "I'll confirm FL-016 at $356." | "Confirming FL-016 at $356." | 1 |
| 14 | "Confirmed — RPLN-FL016, landing Miami 1:45pm today." | "Confirmed — RPLN-FL016, Miami 1:45pm." | 2 |
| 16 | "One business seat on the board: LATAM nonstop, $942, similarity 0.65 — lands 5pm, three hours later than yours." | "One business seat: LATAM nonstop, $942, similarity 0.65 — lands 5pm, later than yours." | 5 |
| 18 | "Kept — FL-016, Miami 1:45pm, $356. Now, the room:" | "Kept. Now the room:" | 5 |
| 20 | "Six bookable near MIA, from $89 at Civic Center Lodge. Your Bayside Inn is already walkable to the port." | "Six near MIA from $89 — Bayside's already walkable to the port." | 7 |
| 22 | "Shifting your Bayside check-in to 8pm." | "Shifting check-in to 8pm." | 2 |
| 24 | "Done — two nights through the 14th, price unchanged at $296." | "Done — two nights, still $296." | 5 |
| 26 | "I'll book the shared shuttle for 2:30pm." | "Booking the 2:30 shuttle." | 3 |
| 28 | "Booked — $12.62, about 45 minutes door to door, drop-off around 3:15pm." | "Booked — $12.62, drop-off 3:15pm." | 7 |
| 30 | "I'll send her a heads-up." | "Sending it now." | 2 |
| 32 | "Sent — well, simulated: nothing real went out. She'd see: heads-up, new arrival 1:45pm." | "Sent — simulated. She'd see: new arrival 1:45pm." | 6 |
| 34 | "All in: $664.62 — flight 356, hotel 296, shuttle 12.62. That's $14.62 over your $650 ceiling." | "All in: $664.62 — $14.62 over your $650 ceiling." | 7 |
| 36 | "Complete — FL-016 lands 1:45pm, Bayside Inn through the 14th, 2:30pm shuttle, sister notified, $664.62 total. You're rebooked." | "Complete — rebooked, $664.62 all in. Enjoy the cruise." | 9 |

(Saved-word figures are the parser-measured deltas under the corrected
counting method; they sum to 82 = medium's 208 − this variant's 126.
Turn 6's announce line is already minimal and stays as-is.)

## Duration estimate (recomputed with the corrected method)

Words counted exactly as Phase 5 established (human turns in full +
agent quoted narration; backticked tool-call syntax and JSON excluded):
**recording-time 326 words — 18 HUMAN turns = 200 (13 prompts + five
"Yes."), 18 AGENT turns = 126.** In the FINAL EDITED video the five
"Yes." turns are cut, so the viewer reads ≈321 words of on-screen
dialogue (195 human + 126 agent).

Two numbers, both real:

**While filming (before editing):** agent narration 126 words = 50–63 s
at 150/120 wpm; 13 pasted prompts 2–4 s each = 26–52 s; 5 gates answered
live and immediately = 10 s; 12 tool executions 1–2 s = 12–24 s;
overhead 10–20 s. **Recording ≈ 1:48–2:49** — comfortable, no rush
needed (and the semantic pacing window must stay unhurried).

**After the cut plan (the submitted video):** narration read-along 50–63
s; 13 landed prompts shown ≈1.5–2 s each = 20–26 s; 12 tool beats
1.5–2 s = 18–24 s; five gate-question flashes ≈0.5 s = 2.5 s; tight
transitions + closing ≈5–8 s. **Final ≈ 1:36–2:04.**

**Margin, stated plainly: the final cut clears the 3:00 hard limit by
≈56–84 s, and the 2:30 comfort target by ≈26–54 s — this variant is the
safety-margin option as intended.** The caveat that makes or breaks it:
these figures assume the FULL cut plan — the five gate cuts PLUS the
inter-turn pass that trims paste actions and dead air (cut IN on the
frame each pasted prompt lands, cut OUT as the reply starts). With only
the five mandated gate cuts and no other editing, the video lands at
≈1:40–2:40 (the filming estimate minus the ≈7.5 s of Yes-send/pause the
gate cuts remove, question flashes kept) — under 3:00, but the top end
still ≈10 s over the 2:30 comfort target. The gate cuts alone are NOT
the margin; the inter-turn pass is. Do the full pass.

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
