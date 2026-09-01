# Decisions ledger

D-series running ledger. Full Context/Decision/Consequences live in
`docs/decisions/` ADRs; this ledger carries the Why/How-applied one-liners
and links. Newest at the bottom.

## D001 — Static client-side Vite + TS(strict) + React, not Next.js
**Date:** 2026-08-31
**Why:** WebMCP is 100% client-side (`[SecureContext]` DOM API, no server
component); dataset is static; methodology demands deterministic
typecheck/lint/build/unit legs; Phase 1+ needs a tool-reactive UI.
**How applied:** current official `create-vite` react-ts template — Vite 8,
TS 6 strict, React 19, oxlint (template default; sibling ESLint convention
deliberately not replicated — ADR-0001), Vitest added. ADR:
`docs/decisions/0001-stack-choice.md`.

## D002 — Methodology §1 layout scoped for a WebMCP-only frontend
**Date:** 2026-08-31
**Why:** general-purpose tree over-fits a static frontend; each omission must
be justified, not silent.
**How applied:** kept all criterion-required layers; omitted `.claude/*`
(no repeatable workflows yet), top-level `tests/` (colocated vitest),
`health-check.sh` (folded into `verify.sh --url`); never applied backend
trees. ADR: `docs/decisions/0002-repo-layout-scoping.md`.

## D005 — Authoring budgets adopted and test-enforced
**Date:** 2026-08-31
**Why:** research brief (docs/research/webmcp-tool-authoring-brief.md) gives
hard guidance: ≤500-char tool descriptions, ≤150-char param descriptions,
~1.5K tool outputs, "minimum essential information" payloads.
**How applied:** p1c6 pass (compact payload cap 8 + showing-note, trimmed
descriptions, structured error codes, readOnlyHint accuracy) + p1c8 added
output-budget tests to budgets.test.ts. New tools must be added to its TOOLS
array — the one manual step.

## D006 — Static registration kept; dynamic registration deferred
**Date:** 2026-08-31
**Why:** the brief flags state-gated register/unregister as a "WebMCP
Leverage" opportunity (register hold_reservation only when results exist,
etc.). Rejected for now: judge-facing predictability (all five tools visible
immediately on any visit), ADR-0003's static-at-load commitment, and the
Sep 3 deadline make the churn a bad trade.
**How applied:** all tools register at mount; revisit only with slack, and
measure against the held-out eval set (per methodology) if tried.

## D007 — Synthetic hotel + ground-transport datasets (ADR-0005)
**Date:** 2026-08-31
**Why:** Phase 2 extends the flow beyond flights; dispatch requires the
two datasets sized/shaped consistently with the 26-flight conventions and
documented in docs/domain/. near_airport reuses the flight tools' MIA/FLL
concept, deliberately independent of city (Aventura corridor), with a
port-distance invariant keeping geography honest.
**How applied:** src/data/hotels.json (18 hotels, zones as controlled enum,
sold_out dates for real filtering power, scenario.original_hotel_reservation
seed) + src/data/ground-transport.json (fare model: 3 types × 6 routes,
derived pricing) + validators/tests/docs per ADR-0005.

## D008 — Hotel lifecycle: scenario-seeded reservation, no hold/confirm pair
**Date:** 2026-08-31
**Why:** dispatch fixes the tool list at six (11-tool deploy ceiling), yet
asks for consistency with the flight hold/confirm pattern "if reasonably
possible" — two extra tools is NOT reasonably possible; upsert semantics
inside update_hotel_reservation would be name-dishonest.
**How applied:** store seeds HTL-R001 (original trip's downtown-Miami
booking, 2 nights); update_hotel_reservation shifts it with flight-tool
conventions (NOT_FOUND with ids+count, deterministic idempotency,
cross-tool arrival validation). No hotel hold/TTL — deviation documented
in ADR-0004 addendum, not silent.

## D009 — Store extension: additive fields on the ADR-0004 singleton
**Date:** 2026-08-31
**Why:** ADR-0004's extension clause; one subscription point drives the UI.
**How applied:** hotelReservations Map (seeded), transportBooking singleton
(replace-on-rebook — no cancel tool, an error would dead-end the agent),
notifications log, lastHotelSearch (separate field — LastSearch type
untouched). resetForTests re-seeds all; clock via now()/nowIso() only.

## D010 — Shared pure trip-breakdown function (domain/trip.ts)
**Date:** 2026-08-31
**Why:** calculate_total_cost, generate_itinerary_summary AND the UI's
running-total card need ONE definition of "the trip total"; two
implementations would drift.
**How applied:** pure buildCostBreakdown in src/domain/trip.ts; tools stay
thin wrappers; budget = stored constraints.maxPriceUsd (never
caller-supplied, per dispatch); flight cost = latestBooking (active
itinerary, no double-count of mistaken earlier bookings).

## D011 — Live Convex vector search: the one backend exception (ADR-0006)
**Date:** 2026-08-31
**Why:** Phase-4 dispatch asks for real semantic flight search via a live
vector DB for the judges; human confirmed GO after the Gate-1 preflight
(docs/research/convex-vector-preflight.md — loop proven, 194–199 ms
end-to-end) and picked Gemini gemini-embedding-001 with the existing
verified key.
**How applied:** ONE tool, search_flights_semantic (T11), backed by a
free-plan Convex project; flights.json stays the source of truth (Convex =
derived index, rows hydrated locally by flight_id); 768-dim embeddings,
key lives only in Convex env vars (bundle-grepped for absence); public
httpAction route + native fetch = zero new runtime deps; tool count
11→12 on explicit human instruction (D006 premise revised). ADR:
`docs/decisions/0006-live-convex-semantic-search.md`.
