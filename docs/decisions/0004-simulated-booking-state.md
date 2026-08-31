# ADR-0004: Simulated booking state — module-level in-memory observable store

- **Status:** Accepted
- **Date:** 2026-08-31
- **Ledger:** D004 in `agent-memory/decisions.md`

## Context

Phase 1 tools (hold_reservation, update_constraints, confirm_booking) mutate
booking state that the UI must render live. There is no backend — the whole
product is a static client-side bundle, and the WebMCP tools are plain
functions invoked by the browser's agent outside any React tree. The dispatch
explicitly requires the state-location choice to be made and justified.

## Decision

A **plain TypeScript module singleton** (`src/state/store.ts`) owns all
simulated booking state: `holds: Map<flightId, Hold>`,
`bookings: Map<flightId, Booking>`, `constraints` (seeded from
`scenario.constraints_hint`), `lastResults`. It exposes `subscribe(listener)`
for React (via `useSyncExternalStore`-equivalent effect subscription) and an
**injectable clock** for deterministic tests. Hold TTL = 15 wall-clock
minutes (`HOLD_TTL_MS = 15 * 60_000`) — "simulated" refers to there being no
real airline; the countdown itself is real time. Expiry is **lazy**: read
paths sweep expired holds; no background timers (correctness never depends
on a timer firing; the UI's 1s interval is cosmetic countdown only).

## Options rejected

| Option | Why rejected |
|---|---|
| React state (useReducer/context) | Tool `execute` functions run outside React's render tree — they cannot call hooks. Wrapping every mutation as a synthetic React event is plumbing in service of the wrong owner. |
| localStorage / sessionStorage | State surviving reload clashes with wall-clock expiry (a refreshed page would show holds already dead with no visual history — confusing for judges); WebMCP tools themselves die with the document (spec: unloading cleanup), so page-scoped state is the lifetime model the tools already imply; per-viewer storage makes demos nondeterministic across judge sessions. |
| Backend (any) | Out of scope by design (no server runtime — ADR-0001); adds deploy moving parts for a simulation. |

## Consequences

- Reload = clean slate: constraints re-seed from the scenario, holds and
  bookings vanish. This is stated in the hold tool's own return note so the
  agent can tell the user.
- The store is trivially unit-testable in Node (no DOM) with `setClockForTests`.
- Phase 2 (hotels/transport/cost summary) extends the same store — one
  subscription point for the whole UI.
- If a future phase needs cross-reload persistence, the swap is localized to
  the store module (hydrate on init, persist on mutation) — no tool changes.
