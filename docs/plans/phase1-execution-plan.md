# Phase 1 — Core Flight Tools: Execution Plan

Date: 2026-08-31 · Status: EXECUTING · Builds on Phase 0 (closed, verified).

## 0. Repo analysis (direct — no delegation; context fresh from Phase 0)

Current state (commit `caf20d7`, clean, synced with origin):
- `src/tools/webmcp.ts` — registrar: feature-detect, per-name AbortController,
  typed status, `logToolCall`/`subscribeToolLog`. **Generic — no changes
  needed for Phase 1.**
- `src/tools/ping.ts` — Phase 0 smoke tool. **UNTOUCHED: no Phase 1
  dependency requires modifying it** (new tools only import the registrar).
- `src/domain/flights.ts` — types, `validateDataset`, `loadDataset`;
  `src/data/flights.json` — 26 flights, invariant-tested.
- `src/App.tsx` — registers ping, renders status card + tool-call log.
- Gaps Phase 1 fills: no state store, no search logic, no results/constraints/
  holds/itinerary rendering; only one tool registered.

Delegation: (a) tool-authoring best-practices research (running); (b)
independent reviewer on the phase diff before closure (post-implementation).
Codebase analysis done directly (trivial — repo built this session, 6 source
files).

## 1. Cross-cutting decisions

### D004 (ADR-0004) — Simulated booking state: module-level in-memory observable store

`src/state/store.ts`: plain TS singleton — `holds: Map<flightId, Hold>`,
`bookings: Map<flightId, Booking>`, `constraints: Constraints` (seeded from
`scenario.constraints_hint`), `lastResults`, `subscribe(listener)`,
injectable clock (`setClockForTests`), `HOLD_TTL_MS = 15 * 60_000` (wall-clock
"simulated minutes" — real time, 15 of it).

| Option | Verdict | Why |
|---|---|---|
| React state | rejected | Tools are plain functions invoked by the browser outside React's tree; they cannot reach hook state. |
| localStorage/sessionStorage | rejected | Holds surviving reload clash with wall-clock expiry (a "fresh" page would show instantly-expired holds); WebMCP tools themselves die with the document — state dying with the page is the coherent lifetime; per-viewer storage also makes judge demos nondeterministic. |
| **Module singleton + subscription** | **chosen** | Reachable from tool code; React subscribes for live rendering; dies with the page like the tools do; unit-testable in Node with an injected clock, no jsdom. |

Expiry is **lazy**: every read path sweeps expired holds (cheap, correct
without timers). UI countdown is a 1s `setInterval` re-render in the App
(display only — never authoritative).

### Shared search logic

`src/domain/search.ts`: pure `searchFlights(flights, filters)`. TOOL 1 calls
it directly; TOOL 3 calls it with the merged constraint set (the dispatch
requires re-invocation of the search logic, not acknowledgment).

### Errors-as-data (unchanged from ADR-0003)

Every tool returns `{ok: true, …}` or `{ok: false, error: "…what was wrong +
how to fix the input…"}`. No deliberate rejections.

### UI notification contract

Tools mutate store → store notifies subscribers → `App` re-renders the
constraints/results/holds/itinerary cards. Verified at two levels: unit tests
assert subscriber notification; p1c6 demonstrates rendering.

## 2. Task contracts (one per tool — Layer 1 format)

### Contract T1 — search_flights

```
TASK: Implement search_flights({destination, arrive_before?, max_price?,
max_layover_hours?})
ACCEPTANCE CRITERIA:
  1. destination REQUIRED, must be "MIA" or "FLL" (schema enum + execute
     validation); other values → {ok:false, error} naming the valid codes.
  2. arrive_before: optional ISO 8601 datetime WITH explicit offset; invalid
     format → structured error showing the expected shape.
  3. max_price: optional number > 0; max_layover_hours: optional number ≥ 0;
     non-numeric/negative → structured error.
  4. Missing optional filters = unconstrained; empty result is valid:
     {ok:true, count:0, results:[]} — never an error.
  5. Results sorted by price_usd ascending (tie-break: duration, then id);
     each result carries id, route (origin→destination codes), airline,
     depart/arrive ISO, stops, total_layover_minutes, price_usd, cabin,
     seats_left, refundable, tags.
  6. Registered via the Phase 0 registrar; annotations.readOnlyHint = true;
     invocations logged via logToolCall.
VERIFICATION: unit tests — happy path (all filters, both destinations),
unconstrained filter omission, empty-result case, malformed input for EVERY
parameter (bad destination, bad ISO, negative price, negative layover),
ordering assertions, filter-correctness assertions vs dataset invariants.
CONSTRAINTS: pure logic in src/domain/search.ts (no store dependency); tool
is a thin validation+call+log wrapper; ping.ts and webmcp.ts unmodified.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

### Contract T2 — hold_reservation

```
TASK: Implement hold_reservation({flight_id})
ACCEPTANCE CRITERIA:
  1. flight_id must exist in the dataset → else {ok:false, error} with a
     valid example id and the count of available flights.
  2. Creates exactly one ACTIVE hold per flight_id: double-hold while active
     → {ok:false, error} including the existing hold's expires_at and the
     TTL policy.
  3. Hold TTL = 15 wall-clock minutes (HOLD_TTL_MS); returns
     {ok:true, flight_id, hold_expires_at (ISO), ttl_minutes, note} where
     note states the simulation (no backend; expires on page close too).
  4. Expiry is lazy: any read after expiry treats the hold as gone; holding
     again after expiry succeeds.
  5. Hold state lives in the D004 store; store notifies subscribers (UI
     contract); invocations logged.
VERIFICATION: unit tests — happy path (expires_at ≈ now+15min via injected
clock), unknown id, double-hold, hold-after-expiry (clock advanced 16min).
CONSTRAINTS: seats_left NOT decremented (dataset static — documented);
no timers created (lazy sweep only).
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

### Contract T3 — update_constraints

```
TASK: Implement update_constraints({max_layover_hours?, max_price?,
preferred_time?}) — human-in-the-loop replanning
ACCEPTANCE CRITERIA:
  1. Partial update: ONLY provided keys change; unmentioned constraints
     persist from prior state. Initial state seeded from
     scenario.constraints_hint (destinations [MIA, FLL],
     arrive_before = must_arrive_by_iso, max_price_usd, max_layover_hours).
  2. Validation per provided key: max_layover_hours ≥ 0 number; max_price
     > 0 number; preferred_time ISO-with-offset datetime. Unknown keys →
     structured error listing the accepted keys.
  3. MUST internally re-run the search (src/domain/search.ts) over the
     destination_airports with the merged constraints and return the new
     result set — {ok:true, constraints (effective, complete), count,
     results} — not just an acknowledgment.
  4. preferred_time, when set, switches result ordering to
     closest-departure-to-preferred_time first (then price); unset keeps
     price-ascending. Documented in the tool description.
  5. Store: constraints AND lastResults updated; subscribers notified (UI
     renders both live — the contract for UI notification).
  6. Invocations logged; annotations readOnlyHint ABSENT (mutates state).
VERIFICATION: unit tests — seed equality, partial update (one key) leaves
others intact, merged re-search correctness (e.g. max_price=300 → all
results ≤ 300 across both airports), preferred_time reordering, unknown-key
rejection, invalid-value rejection, subscriber notification fired.
CONSTRAINTS: reuse searchFlights — no duplicated filter logic; TOOL 1's
behavior unchanged by this tool's existence.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

### Contract T4 — confirm_booking

```
TASK: Implement confirm_booking({flight_id})
ACCEPTANCE CRITERIA:
  1. Requires an ACTIVE hold on flight_id: no hold ever → {ok:false, error}
     directing to hold_reservation; expired hold → {ok:false, error}
     including when it expired.
  2. Produces itinerary: {confirmation_ref, status:"confirmed",
     confirmed_at (ISO), flight summary (incl. segments), price_usd, cabin}.
     confirmation_ref is DETERMINISTIC per flight_id (RPLN-<slug>) — the
     basis of idempotency.
  3. Idempotent: confirming an already-booked flight_id returns the SAME
     itinerary + {idempotent:true} — no error, no duplicate booking.
  4. Consumes the hold (released on confirm); booking a second, different
     flight is allowed (rebooking narrative) — store keeps all bookings,
     UI renders the latest as the confirmed state.
  5. Store notifies subscribers; invocations logged; no readOnlyHint.
VERIFICATION: unit tests — no-hold error, happy path (ref format, itinerary
fields), idempotent re-confirm (same ref, idempotent flag, booking count
unchanged), expired-hold error (injected clock past expiry), confirm after
confirm-then-hold-again cycle.
CONSTRAINTS: no side effects beyond the store; refs derived, not random
(deterministic across calls and reloads of the same flight).
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

## 3. Commit plan (one verified increment per tool, per dispatch)

| Commit | Contents | Gate |
|---|---|---|
| p1c1 | This plan + ADR-0004 | verify.sh exit 0 (docs-only) |
| p1c2 | store + search domain + search_flights + tests | verify.sh |
| p1c3 | hold_reservation + tests | verify.sh |
| p1c4 | update_constraints + tests | verify.sh |
| p1c5 | confirm_booking + tests | verify.sh |
| p1c6 | UI wiring (constraints/results/holds/itinerary cards, register 5 tools) | verify.sh |
| p1c7 | reviewer fixes (if any) + deploy + live smoke + memory closure + push | verify.sh + bundle grep + smoke harness |

## 4. Verification strategy

- **Unit (per tool)**: contracts above; vitest, node env, injected clock for
  time-dependent paths; store isolated per test file (vitest default).
- **Live smoke (TOOL 1 + TOOL 3 together, per dispatch)**: no WebMCP browser
  in this session, so three evidence legs:
  1. `scripts/verify.sh --url https://replan-phi.vercel.app` exit 0;
  2. deployed bundle grep: all five tool `name:`s present in the served JS;
  3. Node harness executing the SHIPPED source modules' execute() in the
     documented agent sequence (search → update_constraints → verify merged
     re-search) — the exact code path the deployed bundle bundles.
  In-app-browser confirmation remains the human 5-minute check (procedure in
  current.md from Phase 0; updated for 5 tools at closure).
- **Independent review**: reviewer subagent on the phase diff (validation
  gaps, state-machine holes, description quality) before p1c7.

## 5. Open items (carried / new)

- Human in-app-browser check now covers all five tools (procedure updated at
  closure).
- Commit rule: no AI-attribution trailers (re-verify after each push).
- Research agent's authoring guidance lands before p1c2 and shapes
  descriptions/schemas; conflicts resolved in favor of spec + Chrome docs.
