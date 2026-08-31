# Flight Dataset — Schema & Scenario

Dataset: `src/data/flights.json` · Validator: `src/domain/flights.ts`
(`validateDataset`) · Tests: `src/domain/flights.test.ts` (run by
`scripts/verify.sh`).

**Entirely synthetic.** Fictional schedules and prices; airline codes are
flavor. Every edit to the JSON is checked against the invariants below by the
unit suite — arithmetic drift fails the build.

## Scenario anchor

The traveler's nonstop **LIM→MIA (AA 918, dep 2026-09-12T08:05−05:00)** was
cancelled by the airline on the morning of 2026-09-12. They must reach Miami —
or Fort Lauderdale, reachable by ground transport (later phase) — in time for a
cruise departing **PortMiami at 18:00 on 2026-09-13, boarding closing 15:00**.

`scenario.constraints_hint` (the canonical filter defaults for later tools):

| Constraint | Value |
|---|---|
| `must_arrive_by_iso` | `2026-09-13T15:00:00-04:00` |
| `destination_airports` | `MIA`, `FLL` |
| `max_price_usd` | 650 |
| `max_layover_hours` | 4 |

Timezones: America/Lima is UTC−5 year-round (no DST); Miami/Fort Lauderdale
are EDT (UTC−4) on these dates. All ISO timestamps carry explicit offsets, so
comparisons are offset-safe.

## Contents

26 flights: 20 → MIA (8 nonstop, 11 one-stop, 1 two-stop) and 6 → FLL
(3 nonstop, 2 one-stop, 1 late-morning nonstop that **misses the deadline** —
a deliberate discriminator). Price range $186–$942 (economy → business).

## Flight schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | `FL-###`, unique |
| `origin` | `{code, city, tz}` | always `LIM` / Lima / America/Lima |
| `destination` | `{code, city, tz}` | `MIA` or `FLL`, America/New_York |
| `depart_iso` / `arrive_iso` | ISO 8601 string | **must carry explicit ±offset** |
| `duration_minutes` | number | door-to-door incl. layovers; invariant: exact `(arrive − depart)` |
| `stops` | 0 \| 1 \| 2 | invariant: `segments.length − 1` |
| `segments[]` | `{flight_number, airline_code, from, to, depart_iso, arrive_iso}` | chain: starts at origin, ends at destination, consecutive `to`→`from` match |
| `layovers[]` | `{airport, minutes}` | invariant: `minutes` = exact gap between adjacent segments |
| `total_layover_minutes` | number | invariant: exact sum of `layovers[]`; 0 for nonstop |
| `price_usd` | number | > 0; `currency` always `USD` |
| `cabin` | `economy` \| `premium_economy` \| `business` | |
| `seats_left` | int 0–9 | GDS-style capped display |
| `refundable` | boolean | |
| `baggage_included` | boolean | false on budget carriers/fares |
| `tags[]` | string[] | ≥ 1 per flight — see below |

## Filter-field mapping (Phase 1 search tool)

| Filter (planned) | Dataset field |
|---|---|
| destination | `destination.code` |
| arrival deadline | `arrive_iso` (parse + compare — offsets explicit) |
| max price | `price_usd` |
| max layover hours | `total_layover_minutes / 60` |

Discriminating power is asserted by tests: the dataset contains flights on
**both sides** of every constraint (before/after deadline, under/over price,
under/over layover cap) and ≥1 flight satisfying all constraints at once.

## Tags

Controlled vocabulary (used later for semantic search + embeddings):
`nonstop`, `one-stop`, `two-stop`, `red-eye`, `morning-departure`,
`afternoon-departure`, `evening-departure`, `tight-connection` (layover ≤ 75
min), `long-layover` (≥ 240 min), `budget` (< $250), `premium`, `business`,
`last-seats` (≤ 3 left), `cutting-it-close` (arrives < 2 h before deadline),
`misses-deadline`, `alternate-airport` (FLL).

## Maintenance rule

Any dataset edit must leave `validateDataset()` returning `[]` — run
`scripts/verify.sh`. Adding destinations beyond MIA/FLL requires updating the
validator allowlist **and** this doc in the same commit.
