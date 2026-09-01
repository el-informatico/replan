# Eleven-Tool Demo Script — full trip-recovery narrative

- **Status: FINAL** — duration measured below (≈240 spoken words,
  ≈1:40–2:00 at conversational pace; fits the 3:00 hard limit with room
  for tool-execution beats). Pacing notes at the bottom.
- Machine-pinned by `evals/functional/demo-script.test.ts` (describe
  "eleven-tool full narrative") — the structure counts AND every tool
  output below are asserted against the real tool modules; site drift
  fails verify.sh before this page goes stale.
- Setup, browser requirements, and troubleshooting are unchanged from the
  Phase 1 script (`agent-memory/current.md`, "In-app-browser demo script —
  five tools"). URL: **https://replan-phi.vercel.app**. Before turn 1,
  the "Agent tools" card must list ELEVEN tools as registered.

Turn key: `HUMAN n` / `AGENT n` are conversational turns — **32 total**
(16 human, 16 agent). `**Tool call:**` marks the 11 tool invocations.
`[confirmation gate: human says yes]` marks the 5 places ChatGPT's
in-app browser inserts its own "shall I proceed?" safety review before a
transactional tool runs (observed live in Phase 1 on hold/confirm;
expected on all five). Those gate pairs are real turns — turns 6–7,
10–11, 18–19, 22–23, 26–27 below — and are budgeted in the count.

---

**TURN 1 — HUMAN:** My flight to Miami was cancelled and I'm stranded.
What tools does this page give you? Call ping with echo set to "ready" to
check the connection.

**TURN 2 — AGENT:** **Tool call:** `ping({echo:"ready"})` →
`{"ok":true,"pong":true,"echo":"ready",…}` "Connected. This page gives me
eleven travel-recovery tools — flights, hotels, ground transport,
notifications, and costs. Let's get you home."

**TURN 3 — HUMAN:** Search flights to Miami. I must arrive before 3pm
Miami time tomorrow, September 13, and I won't tolerate more than a
four-hour layover.

**TURN 4 — AGENT:** **Tool call:**
`search_flights({destination:"MIA", arrive_before:"2026-09-13T15:00:00-04:00", max_layover_hours:4})`
→ `count:17`, cheapest `FL-015 $299` "Seventeen flights fit. Cheapest is
AV via San José, $299, arriving tomorrow evening."

**TURN 5 — HUMAN:** Hold the Copa flight via Panama — FL-016, $356 —
while I think it over.

**TURN 6 — AGENT:** "I'll place a 15-minute hold on FL-016."
**Tool call:** `hold_reservation({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**

**TURN 7 — HUMAN:** Yes.

**TURN 8 — AGENT:** `ttl_minutes:15`, `hold_expires_at` = call time +
15 min. "Held until 2:15pm — the seat is yours while you decide."

**TURN 9 — HUMAN:** Change of plans — no layover over two hours, that's
firm. Update my constraints and show me what's left.

**TURN 10 — AGENT:** **Tool call:**
`update_constraints({max_layover_hours:2})` → `count:14`, FLL nonstops
lead ($198/$221/$267/$289), FL-015 gone, held FL-016 survives. "Fourteen
options now. Four Fort Lauderdale nonstops lead from $198 — and your
held Copa flight survives the tighter rule."

**TURN 11 — HUMAN:** Keep it simple — book the held Copa flight, FL-016.

**TURN 12 — AGENT:** "I'll confirm FL-016 at $356."
**Tool call:** `confirm_booking({flight_id:"FL-016"})`
**[confirmation gate: human says yes]**

**TURN 13 — HUMAN:** Yes.

**TURN 14 — AGENT:** `confirmation_ref:"RPLN-FL016"`. "Confirmed —
RPLN-FL016, landing Miami 1:45pm today."

**TURN 15 — HUMAN:** My hotel is downtown by the cruise port. What's
actually available near Miami airport for tonight?

**TURN 16 — AGENT:** **Tool call:**
`search_hotels({city:"Miami", near_airport:"MIA", check_in:"2026-09-12T15:00:00-04:00", check_out:"2026-09-14T15:00:00-04:00"})`
→ `count:6`, cheapest `HT-004 $89/night` "Six bookable near MIA — from
$89 at Civic Center Lodge. Your existing Bayside Inn reservation is
already walkable to the port."

**TURN 17 — HUMAN:** Keep Bayside Inn — move my check-in to tonight,
8pm.

**TURN 18 — AGENT:** "I'll shift your reservation to an 8pm check-in."
**Tool call:**
`update_hotel_reservation({reservation_id:"HTL-R001", new_check_in:"2026-09-12T20:00:00-04:00"})`
**[confirmation gate: human says yes]**

**TURN 19 — HUMAN:** Yes.

**TURN 20 — AGENT:** `check_out:"2026-09-14T20:00:00-04:00"`,
`total_usd:296`. "Done — two nights through the 14th, price unchanged at
$296."

**TURN 21 — HUMAN:** Book me the shuttle from the airport — I land at
1:45, so make it 2:30.

**TURN 22 — AGENT:** "I'll book the shared shuttle for 2:30pm."
**Tool call:**
`book_ground_transport({type:"shuttle", pickup_time:"2026-09-12T14:30:00-04:00"})`
**[confirmation gate: human says yes]**

**TURN 23 — HUMAN:** Yes.

**TURN 24 — AGENT:** `booking_ref:"RPLN-GT-SHUTTLE-MIA"`,
`price_usd:12.62`, `est_dropoff_iso:"2026-09-12T19:15:00.000Z"`. "Booked —
$12.62, about 45 minutes door to door, drop-off around 3:15pm."

**TURN 25 — HUMAN:** Text my sister María — new arrival 1:45pm Miami
time.

**TURN 26 — AGENT:** "I'll send her a heads-up."
**Tool call:**
`notify_contact({contact:{name:"María", phone:"+51 987 654 321"}, new_arrival_time:"2026-09-12T13:45:00-04:00"})`
**[confirmation gate: human says yes]**

**TURN 27 — HUMAN:** Yes.

**TURN 28 — AGENT:** `notification_id:"NTF-001"`, `channel:"sms"`,
`simulated:true`. "Sent — well, simulated: nothing real went out. She'd
see: heads-up, new arrival 1:45pm."

**TURN 29 — HUMAN:** Where am I on budget for all of this?

**TURN 30 — AGENT:** **Tool call:** `calculate_total_cost({})` →
`total_usd:664.62`, `within_budget:false`, `delta_usd:14.62`. "All in:
$664.62 — flight 356, hotel 296, shuttle 12.62. That's $14.62 over your
$650 ceiling."

**TURN 31 — HUMAN:** The cruise matters more than the ceiling — show me
the whole trip in one summary.

**TURN 32 — AGENT:** **Tool call:** `generate_itinerary_summary()` →
`status:"complete"`, `missing:[]`, `notifications.count:1`. "Complete:
FL-016 landing 1:45pm, Bayside Inn tonight through the 14th, 2:30pm
shuttle, sister notified. Total $664.62 — you're rebooked."

---

## Duration estimate (measured from this document)

Spoken/typed words, counted from the turn lines above (human turns + the
agent's quoted speech; tool-call syntax and JSON fragments are shown on
screen, not read aloud):

- 16 HUMAN turns ≈ 120 words (11 prompts ≈ 115 + five "Yes." = 5)
- 16 AGENT turns ≈ 120 spoken words (the narration quotes only)
- **Total ≈ 240 spoken words** → ≈ **1:36 at 150 wpm**, ≈ 2:00 at a
  deliberate 120 wpm.

Adding on-screen beats — 11 tool executions (~1–2 s each once submitted),
5 confirmation-gate pauses (human reaction time, ~2–3 s each), typing
time if prompts are typed rather than voiced ≈ 20–40 s — the full
narrative lands at roughly **2:00–2:45 wall-clock**, inside the 3:00 hard
limit with margin. Pacing notes for recording: deliver agent lines as
tight summaries exactly as scripted; let the UI's live cards (hold
countdown, constraint re-render, running total flipping to red) carry
the beats instead of narrating them.

## Structural counts (machine-checked by demo-script.test.ts)

- Conversational turns: 32 (16 HUMAN + 16 AGENT)
- Tool invocations: 11 (one per registered tool)
- Confirmation gates: 5 — hold_reservation (turns 6–7), confirm_booking
  (12–13), update_hotel_reservation (18–19), book_ground_transport
  (22–23), notify_contact (26–27)
