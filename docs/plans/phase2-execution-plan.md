# Phase 2 — Multi-Domain Expansion: Execution Plan

Date: 2026-08-31 · Status: EXECUTING · Builds on Phase 1 (closed 2026-08-31,
human-verified in ChatGPT Desktop's in-app browser, commit `d9470e8`).

Scope per dispatch: six new WebMCP tools extending the trip-recovery flow
beyond the flight — `search_hotels`, `update_hotel_reservation`,
`book_ground_transport`, `notify_contact`, `calculate_total_cost`,
`generate_itinerary_summary` — registered alongside the existing five
(exact 11-tool ceiling; the DONE criterion pins the deploy at 5+6).
Phase 0/1 tool implementations are FROZEN: nothing in
`src/tools/{ping,search,hold,constraints,confirm}.ts` changes. The shared
infrastructure they use (`src/state/store.ts`, `src/tools/payload.ts`,
`src/tools/validate.ts`) may gain **additive** exports only — no existing
signature or behavior changes — and ADR-0004's extension clause
("Phase 2 extends the same store") authorizes exactly that.

## 0. Repo analysis (delegated — four parallel investigations)

Phase 1's plan did its analysis direct (6 source files, fresh context).
Phase 2 inherits a 2,500-line codebase with established patterns, so
analysis was delegated to four independent investigators; findings were
synthesized here. Baseline before any change: clean tree at `d9470e8`,
`scripts/verify.sh` → `PASS (exit 0)`, 9 files / 76 tests.

1. **Architecture** (codebase map): confirmed the tool anatomy
   (`<camel>Tool` const + private `executeX` + `register<Pascal>()`,
   two-line `execute` wrapping compute→`logToolCall`→return), validation
   order (isRecord → unknownKeys → required → enum → optional → logic),
   `Validated<T>` consumption, store API verbatim, `compactResults`
   projection (cap 8 + conditional note), single-file UI with conditional
   cards, and code style (no semicolons, `.ts` import extensions,
   `erasableSyntaxOnly` → union types, never enums).
2. **Implementation research** (live WebMCP docs re-verification —
   current.md item 7): §2 below. No breaking API change found; constants
   the budgets test enforces remain as Phase 1 set them.
3. **Testing strategy**: vitest node env, `include: ['src/**/*.test.ts',
   'evals/**/*.test.ts']`, colocated `<tool>.test.ts` files with
   `beforeEach(resetForTests)` + module-scope `CALL`, injected-clock
   closure pattern (`let t = …; setClockForTests(() => t)`), "never
   throws" garbage sweeps, subscriber-count assertions,
   `evals/functional/` narrative + demo-script patterns. NOTE:
   `evals/**` tests are NOT covered by `tsc -b` (tsconfig.app includes
   `src` only) — vitest transpiles them; keep eval files simple.
4. **Reliability/review history**: the 8 Phase-1 review findings map to
   Phase-2 risk classes (see §4); L003 (exact numeric bounds, calendar
   honesty) and L004 (every contract-named cycle gets a same-increment
   test) are the two live disciplines. ADR-0004 pre-authorizes the store
   extension.

Conflict resolution: investigator 4 recommended `untrustedContentHint` on
catalog-returning tools; investigator 1 established Phase 1 deliberately
sets none (our catalog is first-party synthetic data, not UGC/external).
Resolved per project precedent: **no `untrustedContentHint`** — same
stance as the five flight tools; consistency with Phase 1 wins (the brief
targets externally sourced content). Investigator 3 noted the 1.5K output
budget is enforced for only two tools; investigator 4 flagged the same as
risk #2 — resolved by extending budgets.test.ts coverage to every Phase-2
tool output in each tool's increment (see §4).

## 1. Cross-cutting decisions

### D007 (ADR-0005) — Synthetic hotel + ground-transport datasets

Same conventions as `flights.json`: static JSON in `src/data/`, types +
`validateDataset` in `src/domain/`, invariant tests in
`src/domain/<x>.test.ts`, schema doc in `docs/domain/<x>-dataset.md`,
entirely synthetic, arithmetic drift fails the build. Sizing: **18
hotels** and **2 routes × 3 vehicle types** (6 priceable combos) —
deliberately smaller than the 26-flight set because the *search space* is
smaller (one metro area, two airports), while preserving discriminating
power on every filter (both sides of each cut). Full schema: ADR-0005 +
the two docs/domain files.

**`near_airport` tie-in (dispatch decision, TOOL 1):** it reuses the SAME
MIA/FLL destination concept as the flight tools — same codes, same enum
source (`scenario.constraints_hint.destination_airports` where possible).
It is deliberately NOT a proxy for `city`: the dataset includes
Miami-city hotels whose nearest airport is FLL (Aventura/Sunny Isles
corridor), so `city` and `near_airport` filter independently, and a
geography invariant ties them to port distance (near MIA ⇒ ≤ 20 km to
PortMiami; near FLL ⇒ ≥ 20 km). Rationale: the FLL widening is the
scenario's Phase-1 narrative payoff; the hotel search must honor it.

### D008 — Hotel reservation lifecycle without new booking tools

The dispatch fixes the tool list at six (deploy = exactly 11 tools), yet
asks TOOL 2 to stay "consistent with the flight tools' hold/confirm
pattern if reasonably possible". A hotel hold/confirm pair would need two
extra tools — violating the 11-tool ceiling — and no remaining Phase-2
tool can own "book a hotel" without abusing its name. Decision:

- The store **seeds one scenario hotel reservation** — the original
  trip's booking (the cancelled AA 918 trip plausibly included a hotel;
  the recovery narrative is "shift my hotel to the new dates", exactly
  what a stranded traveler asks). It is a real reservation in state from
  page load: `HTL-R001`, a downtown-Miami hotel (port-proximate, correct
  for both MIA and FLL arrivals — which is why ground transport exists),
  2 nights, `updated_at: null`.
- `update_hotel_reservation` operates on it (and any future reservation
  state) with flight-tool conventions: structured `NOT_FOUND` with valid
  ids + count, deterministic idempotency (same `new_check_in` → same
  result + `idempotent: true`), `check_out` shifts to preserve nights,
  cross-tool validation against the confirmed flight (see T6 contract).
- No hotel hold/TTL: holds exist to time-box a *decision*; the seeded
  reservation removes the decision point. Documented as a simplification
  in ADR-0004's Phase-2 addendum, not silently.

Alternatives rejected: (a) `hold_hotel`/`confirm_hotel_booking` tools —
breaks the 11-tool DONE criterion; (b) upsert semantics inside
`update_hotel_reservation` (first call "creates") — semantic dishonesty
in the tool name, worse for agent selection than a seeded state; (c) no
hotel state at all — guts `calculate_total_cost`'s multi-domain point.

### D009 — Store extension (ADR-0004 addendum, not a new ADR)

Additive fields on the same singleton, same Map/subscribe/notify/lazy
discipline, same injectable clock for every timestamp:

- `hotelReservations: Map<id, HotelReservation>` — seeded with the
  scenario reservation (D008). No expiry (no holds — D008).
- `transportBooking: TransportBooking | null` — singleton (one trip, one
  ground leg); re-booking **replaces** with `replaced_previous: true`
  (agent-friendly: no cancel tool exists, so an error would dead-end; the
  flight pattern's "one active X" rule is preserved by replacement).
- `notifications: SentNotification[]` — append-only record of simulated
  notifications (feeds `generate_itinerary_summary`).
- `lastHotelSearch: { filters, results } | null` — the hotel results
  panel, mirroring `lastSearch` WITHOUT touching the existing
  `LastSearch` type or its `via` union (zero Phase-1 type churn).

`resetForTests()` re-seeds all four. All new time paths use `now()`/
`nowIso()` (review-finding-8 class).

### D010 — Cost + itinerary composition as a shared pure function

`src/domain/trip.ts`: pure `buildCostBreakdown(inputs)` + itinerary
composition used by BOTH `calculate_total_cost` (T9),
`generate_itinerary_summary` (T10), and the UI's live running-total card
(the grocery-demo pattern the dispatch names). One definition of "the
trip total"; the tool wrappers stay thin. Budget semantics per dispatch:
`total_usd` (flight + hotel + transport) vs the STORED
`constraints.maxPriceUsd` (seeded 650, last set by `update_constraints`)
— the caller never re-supplies a budget. Flight cost = `latestBooking()`
(most recent confirmation is the active itinerary; earlier mistaken
bookings don't double-count — documented).

### Errors-as-data, annotations, registration (unchanged)

Flat `{ok:false, code, error}` envelope, SCREAMING_SNAKE codes,
actionable error text naming valid options. `readOnlyHint: false` on
every tool that mutates store state (all six except none — every Phase-2
tool writes at least one store/UI surface; `search_hotels` writes
`lastHotelSearch`, mirroring T1's amended annotation honesty).
`notify_contact` is transactional-looking → expect ChatGPT's confirmation
gate (current.md "Observed": budget a "Yes" turn; Phase 3 demo script
must plan for it). Registration: append six `registerX()` calls to App's
`Promise.all` — registrar is generic, untouched.

## 2. Research re-verification (live docs, 2026-08-31)

Re-verified before p2c1 (current.md item 7) against the W3C CG spec
draft (webmachinelearning.github.io/webmcp, rev 2026-08-26), Chrome docs
(developer.chrome.com/docs/ai/webmcp — hub, imperative-api, secure-tools,
best-practices, build-tools, evals; pages current through 2026-08-26),
and learn.chatgpt.com/docs/webmcp. Outcome:

- **No API delta affecting Phase 2.** `document.modelContext.registerTool
  ({name, description, inputSchema, execute}, {signal})` unchanged; the
  spec's register/execute algorithms still contain NO schema-validation
  step (open Issue #92) — validate in `execute`, as every existing tool
  does; errors-as-returned-data confirmed (a rejected `execute` reaches
  the agent as an opaque null/false); results reach the agent as a
  serialized JSON string; `ToolAnnotations` still exactly
  `readOnlyHint` + `untrustedContentHint`.
- **Budgets confirmed verbatim** in Chrome secure-tools (500/150/30/1.5K)
  — framed as recommendations against agent guardrails, not API-enforced;
  budgets.test.ts keeps enforcing them mechanically regardless.
- **11 tools**: no documented per-page limit, but Chrome's best
  practices + the brief warn selection degrades as descriptions consume
  context; practitioner reports put the falloff around a dozen tools.
  Prescriptions adopted for Phase 2: (a) aim **150–300 chars** per tool
  description (Phase 1 ran 438–494 — Phase 2 tightens, using the same
  budget headroom to keep ALL eleven descriptions lean); (b) zero
  schema/description overlap between siblings — each Phase-2 description
  names its distinct trigger ("hotels", "ground transport", "notify",
  "running total", "final receipt"); (c) evaluate with all tools
  registered (the functional eval imports real tool modules — satisfied
  by construction).
- Known-new but not needed: Chrome 153 unregister-doesn't-cancel-in-
  flight semantics; cross-origin `exposedTo`/Permissions-Policy surface;
  `requestUserInteraction()` (Chrome forward-references it; the spec
  still lacks it — Issue #165 open). None change our registrar.
- Housekeeping: `webmcp.dev` is an UNRELATED third-party project (not the
  spec site); L001's trusted-source list was already correct.

## 3. Task contracts (one per tool — Layer 1 format)

Numbering continues Phase 1 (T1–T4). Contracts are frozen per-tool before
that tool's code, same discipline as Phase 1.

---

### Contract T5 — search_hotels({city, check_in, check_out, near_airport})

```
TASK: Implement search_hotels({city, check_in, check_out, near_airport})
ACCEPTANCE CRITERIA:
  1. city is required, enum "Miami" | "Fort Lauderdale" (case-sensitive) →
     unknown/non-enum → {ok:false, code:"UNKNOWN_CITY", error} naming the
     two valid values.
  2. near_airport optional, enum "MIA" | "FLL" → else UNKNOWN_AIRPORT with
     valid values. Filters on Hotel.near_airport — the SAME airport concept
     the flight tools use (D007 tie-in), independent of city.
  3. check_in / check_out optional ISO-8601-with-offset (getIsoDatetime):
     both-or-neither — exactly one provided → INVALID_INPUT saying both are
     needed; check_out <= check_in → INVALID_INPUT; the stay must be a whole
     number of nights (>= 1) → else INVALID_INPUT. When provided, hotels
     sold out on ANY night of the stay are excluded (Hotel.sold_out dates).
  4. Results sorted by price ascending (nightly; tie: guest_rating desc,
     then id). With a stay window each row also carries total_stay_usd =
     nights * price_per_night_usd. Empty result set is valid output
     ({ok:true, count:0, results:[]}) — same convention as search_flights.
  5. Tool payload compacted to <= 8 rows + "Showing N of M" note (payload
     helper); full results + filters written to store.lastHotelSearch
     (subscriber notified) for the UI; invocation logged.
  6. Schema: exactly the four params, descriptions <= 150 chars; tool
     description <= 500 chars; annotations readOnlyHint:false (writes
     lastHotelSearch); registered via registerSearchHotels() in App.
VERIFICATION: unit tests — happy path (Miami, price-ascending, count>0);
city+near_airport cross-filter (Miami near FLL exists and is found);
check_in/check_out pairing errors (one-sided, reversed, non-whole nights);
sold-out exclusion shifts results; empty result (city with impossible
window) is ok:true; malformed inputs (bad enum, bad ISO, unknown keys,
non-object, never-throws sweep); subscriber notified; budgets.test.ts
TOOLS entry + output <= 1.5K assertion; domain tests — hotels dataset
validateDataset returns [] + discriminating-power assertions (both sides
of a price cut, both cities, both near_airport values, >= 1 hotel
available for the scenario window).
CONSTRAINTS: dataset static (no rooms_left mutation — documented);
pure domain fn searchHotels(hotels, filters) in src/domain/hotels.ts,
tool wrapper thin (same split as searchFlights); no timers.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

---

### Contract T6 — update_hotel_reservation({reservation_id, new_check_in})

```
TASK: Implement update_hotel_reservation({reservation_id, new_check_in})
ACCEPTANCE CRITERIA:
  1. reservation_id must reference a reservation in store state → else
     {ok:false, code:"NOT_FOUND", error} listing active reservation ids
     and the count (flight NOT_FOUND convention).
  2. new_check_in required, ISO-8601-with-offset, real-calendar
     (getIsoDatetime) → else INVALID_INPUT.
  3. check_out shifts to preserve nights (nights constant); total_usd
     unchanged (nightly rate constant); updated_at set to nowIso() on the
     first real change only.
  4. Idempotent: same new_check_in as current dates → same result +
     idempotent:true, updated_at unchanged (flight confirm_booking
     convention; determinism is the mechanism).
  5. Cross-tool validation: IF a confirmed flight booking exists and
     new_check_in's calendar date is BEFORE the flight's arrival date →
     {ok:false, code:"CHECK_IN_BEFORE_ARRIVAL", error} naming the arrival
     instant. No confirmed flight → allowed (hotel may predate the
     rebooking; documented).
  6. Success returns the full updated reservation (reservation_id,
     hotel_id, hotel_name, check_in, check_out, nights, price_per_night_usd,
     total_usd, updated_at) + note stating simulation; store mutated,
     subscribers notified, invocation logged.
  7. Schema: two params, descriptions <= 150; description <= 500;
     readOnlyHint:false; registerUpdateHotelReservation() in App.
VERIFICATION: unit tests — happy path (dates shift, nights preserved);
unknown reservation_id; idempotent re-update; check-in before confirmed
arrival rejected; check-in same-day-as-arrival allowed; no-flight state
allows any valid date; malformed inputs (missing/bad ISO incl. calendar
rollover, unknown keys, non-object, never-throws); subscriber notified;
budgets TOOLS entry.
CONSTRAINTS: no sold-out check on own-reservation moves (simplification,
D008 — seeded hotel is never sold out on reachable dates); no hold/TTL
for hotels (D008); dataset static.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

---

### Contract T7 — book_ground_transport({type, pickup_time})

```
TASK: Implement book_ground_transport({type, pickup_time})
ACCEPTANCE CRITERIA:
  1. type required, enum "taxi" | "shuttle" | "rideshare" (the full
     ground-transport fleet, D007/ADR-0005) → else {ok:false,
     code:"UNKNOWN_TYPE", error} naming the three.
  2. pickup_time required, ISO-8601-with-offset, real-calendar → else
     INVALID_INPUT.
  3. Cross-tool state (D009 store, NOT a new store): requires a confirmed
     flight booking → else {ok:false, code:"NO_CONFIRMED_FLIGHT", error}
     pointing at confirm_booking. Route derived from state: from_airport =
     latest booking's destination code (MIA|FLL), to_zone = hotel
     reservation's zone (downtown-Miami). Both routes must exist in the
     dataset.
  4. pickup_time validated against the confirmed flight's arrival:
     reject before arrival + 15 min (deplane) → code:"PICKUP_TOO_EARLY"
     naming the arrival instant; reject after arrival + 8 h →
     code:"PICKUP_TOO_LATE". Window documented in the description.
  5. Cost from the dataset fare model (base + per_km × route distance),
     rounded to cents once; est_travel_minutes + est_dropoff_iso =
     pickup + typical minutes + type wait minutes.
  6. Re-booking replaces the singleton booking and returns
     replaced_previous:true with the prior ref (agent-correction friendly;
     no cancel tool exists — D009). First booking: replaced_previous absent.
  7. Success: {ok:true, status:"booked", booking_ref (deterministic:
     RPLN-GT-<TYPE>-<AIRPORT>), type, from_airport, to_zone, pickup_time,
     est_travel_minutes, est_dropoff_iso, price_usd, note(simulated)} ;
     store mutated, subscribers notified, logged; budgets TOOLS entry.
VERIFICATION: unit tests — happy path MIA route (cost = model, dropoff =
pickup + travel); FLL route (longer distance, higher fare); type enum
rejection; pickup 10 min after arrival rejected (PICKUP_TOO_EARLY), 20
min accepted (boundary), > 8 h rejected; no confirmed flight rejected;
replace flow (second call replaces, prior ref returned); malformed inputs
(bad ISO, unknown keys, non-object, never-throws); subscriber notified;
domain tests — transport dataset validateDataset [] + fare-model ordering
invariants (shuttle < rideshare < taxi on the FLL route).
CONSTRAINTS: pickup LOCATION never caller-supplied (derived — documented);
dataset static; no timers.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

---

### Contract T8 — notify_contact({contact, new_arrival_time})

```
TASK: Implement notify_contact({contact, new_arrival_time}) — SIMULATED
ACCEPTANCE CRITERIA:
  1. contact required, object with optional keys name, phone, email,
     relationship — unknown keys → INVALID_INPUT; >= 1 of phone/email
     must be a non-empty string → else INVALID_INPUT naming what a
     contact needs; name if present must be non-empty string.
  2. new_arrival_time required, ISO-8601-with-offset, real-calendar →
     else INVALID_INPUT.
  3. Returns a structured confirmation of what WOULD have been sent:
     {ok:true, simulated:true, notification_id (deterministic NTF-### by
     sequence), channel ("sms" if phone given else "email"), recipient
     {name?, target}, message (one sentence naming the new arrival time),
     sent_at (nowIso()), note("Simulated only — no real message was
     sent.")}. NOTHING is transmitted — hackathon scope, stated in the
     description AND the return note.
  4. Appends a SentNotification to store.notifications (summary source),
     subscribers notified, logged; budgets TOOLS entry; readOnlyHint:false.
  5. new_arrival_time is NOT cross-validated against flight state — the
     traveler may inform anyone of anything (documented choice).
VERIFICATION: unit tests — happy path sms (phone), email fallback (email
only), missing phone+email rejected, unknown contact key rejected, empty
name rejected, bad ISO rejected, two notifications get NTF-001/NTF-002
sequence, never-throws sweep, subscriber notified, output <= 1.5K.
CONSTRAINTS: no real-world contact validation (no RFC email/phone
checks — dispatch says don't over-engineer); no transmission code of any
kind; deterministic ids (no Math.random / Date.now).
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

---

### Contract T9 — calculate_total_cost({items})

```
TASK: Implement calculate_total_cost({items}) via shared pure breakdown
ACCEPTANCE CRITERIA:
  1. items optional array of enum "flight" | "hotel" | "transport";
     non-array / bad member / duplicate → INVALID_INPUT naming valid
     kinds. Absent or null → all booked items (the running total).
  2. Costs read from store state: flight = latest booking's price_usd;
     hotel = each reservation's total_usd; transport = booking price_usd.
     An EXPLICITLY requested kind with no state → {ok:false,
     code:"NOT_BOOKED", error} naming the kind(s) and the tool that
     creates them. Default call on empty state → {ok:true, items:[],
     total_usd:0} (valid, not an error).
  3. Budget: read snapshot constraints.maxPriceUsd (seeded 650 from the
     scenario, last set by update_constraints) — never caller-supplied.
     Response carries budget:{max_price_usd, within_budget:
     total<=max, delta_usd (+ over / − under)}.
  4. Structured breakdown, not a bare number: items:[{kind, id,
     description, cost_usd}], total_usd (cents-rounded once — L003), +
     note stating the budget source. UI renders this as the running-total
     card (D010 shared pure fn in src/domain/trip.ts).
  5. Store read-only; logged; budgets TOOLS entry; output <= 1.5K;
     registerCalculateTotalCost() in App.
VERIFICATION: unit tests — flight only (post-confirm), flight+hotel
(seeded), all three, empty state default ok:true total 0, explicit
missing kind NOT_BOOKED, malformed items (non-array, bad member, dup,
unknown keys, non-object, never-throws), budget boundary exactly at max
(within) and 1 cent over (not within), latest-of-two-bookings used,
subscriber NOT required (read-only — assert no notify is out of scope;
assert snapshot unchanged).
CONSTRAINTS: no rounding of stored values before the single final
total_usd rounding; pure breakdown unit-tested independently of the tool.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

---

### Contract T10 — generate_itinerary_summary()

```
TASK: Implement generate_itinerary_summary() — the final-receipt moment
ACCEPTANCE CRITERIA:
  1. No input parameters (empty object schema). Any input keys →
     INVALID_INPUT. Never errors on partial state — errors-as-data only;
     callable at ANY point in the flow.
  2. Consolidates: confirmed flight (latest booking, compact — NO
     segments), hotel reservation(s) (dates, nights, total, updated_at),
     transport booking (type, route, pickup, price), notifications
     (count + last), and the T9 cost breakdown (shared pure fn, D010).
  3. completeness: status:"complete" when flight+hotel+transport all
     present, else "partial" with missing:[kinds] naming what's left and
     the tool that books it. Budget status included (T9 AC3 semantics).
  4. Output <= 1.5K (compact fields only — the receipt, not the ledger);
     read-only; logged; budgets TOOLS entry; registerGenerateItinerary-
     Summary() in App.
VERIFICATION: unit tests — empty state (status partial, missing all
three, ok:true, total 0); flight only (the dispatch's named edge); full
chain (complete, receipt fields exact); after notify (count included);
partial with transport but no flight is impossible via tools — assert
summary tolerates arbitrary store state directly seeded; malformed input
(extra keys, non-object, never-throws); output budget.
CONSTRAINTS: never mutates store; reuses buildCostBreakdown (no second
cost definition); deterministic field order for byte-stable demo pins.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

---

## 4. Verification strategy

- **Per-tool unit tests** per each contract's VERIFICATION list — every
  named cycle gets its same-increment test (L004). Idiom: colocated
  `<tool>.test.ts`, `beforeEach(resetForTests)`, `CALL` constant,
  injected clock where time matters, garbage "never throws" sweeps,
  subscriber counting, exact-boundary assertions (L003).
- **budgets.test.ts**: each increment adds its tool to TOOLS (D005's one
  manual step — a checklist line in every increment) AND adds its output
  to the ≤1.5K assertion (investigator 3+4 risk: budget currently
  enforced for two tools only).
- **Domain tests**: hotels + transport `validateDataset() → []` +
  discriminating-power assertions, mirroring `flights.test.ts`.
- **Functional eval** (`evals/functional/multi-domain-narrative.test.ts`):
  full chain search_hotels → update_hotel_reservation → (flight
  confirm via existing tools) → book_ground_transport → notify_contact →
  calculate_total_cost → generate_itinerary_summary, incl. one
  error-recovery loop per dispatch ("mirroring the rebooking-narrative
  test's pattern").
- **Independent review** BEFORE deploy (methodology reviewer-independence
  rule): fresh reviewer on the full Phase-2 diff (contracts vs
  implementation, validation gaps, state-machine holes, budget misses).
  Findings disclosed + fixed with regression tests, then §6 Amendments.
- **Deploy evidence**: `vercel deploy --prod` → `verify.sh --url
  https://replan-phi.vercel.app` exit 0 + served-bundle grep for ALL
  ELEVEN tool names (F001/F002: deployed alias only, no loopback smokes).
- **Process**: one verified increment = one commit, verify.sh exit 0
  gates each; no AI-attribution trailers, re-verified after each push.

## 5. Commit plan (one verified increment per tool, per dispatch)

| Commit | Contents | Gate |
|---|---|---|
| p2c1 | This plan + ADR-0005 (datasets) + ADR-0004 Phase-2 addendum | verify.sh (docs-only) |
| p2c2 | hotels dataset + domain + search_hotels (T5) + tests + budgets | verify.sh |
| p2c3 | hotel-reservation store state + update_hotel_reservation (T6) + tests + budgets | verify.sh |
| p2c4 | transport dataset + book_ground_transport (T7) + tests + budgets | verify.sh |
| p2c5 | notify_contact (T8) + store notifications + tests + budgets | verify.sh |
| p2c6 | domain/trip.ts breakdown + calculate_total_cost (T9) + tests + budgets | verify.sh |
| p2c7 | generate_itinerary_summary (T10) + tests + budgets | verify.sh |
| p2c8 | UI wiring: register 11 tools, hotel/transport/running-total cards, phase note | verify.sh |
| p2c9 | evals/functional multi-domain narrative eval | verify.sh |
| p2c10 | independent-review fixes + §6 Amendments | verify.sh |
| p2c11 | closure: deploy + bundle grep (11 names) + push + trailer re-check + agent-memory | verify.sh --url |

## 6. Open items (carried / new)

- budgets.test.ts TOOLS entry — per-increment checklist (risk #1).
- evals/regression/ README promises per-failure entries; Phase 1/2 keep
  regressions colocated as named tests (convention) — reconcile the
  README wording at Phase 2 closure.
- ChatGPT confirmation gate: expect extra "Yes" turns before
  update_hotel_reservation / book_ground_transport / notify_contact
  (current.md Observed; Phase 3 demo script must budget them).
- Phase 3 (in-app-browser human verification of the six) assumptions get
  written into current.md at closure.

## 7. Amendments

(none yet — post-review amendments land here, Phase 1 §6 convention.)
