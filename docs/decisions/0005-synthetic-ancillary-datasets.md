# ADR-0005: Synthetic hotel + ground-transport datasets

- **Status:** Accepted
- **Date:** 2026-08-31
- **Ledger:** D007 in `agent-memory/decisions.md`

## Context

Phase 2 extends the recovery flow beyond the flight (dispatch TOOLS 1–3:
hotel search, hotel-reservation update, ground transport). The scenario is
anchored on PortMiami: the traveller must reach Miami **or Fort Lauderdale**
(the Phase-1 FLL widening) for a cruise departing 2026-09-13 18:00. The
dispatch requires the two new datasets to be synthetic, sized and shaped
consistently with the 26-flight dataset's conventions, and documented in
`docs/domain/`.

## Decision

Two datasets, same conventions as `flights.json` — static JSON under
`src/data/`, types + `validateDataset()` under `src/domain/`, invariant +
discriminating-power tests colocated, schema doc under `docs/domain/`,
entirely synthetic, and a maintenance rule (any edit keeps
`validateDataset()` at `[]`; allowlist changes update the doc in the same
commit).

### Hotels — `src/data/hotels.json` (18 hotels)

| Field | Type | Notes |
|---|---|---|
| `id` | `HT-###` | unique |
| `name` | string | fictional |
| `city` | `Miami` \| `Fort Lauderdale` | search filter |
| `zone` | `downtown-miami` \| `miami-beach` \| `fort-lauderdale` | shared enum with transport routes — the ground-leg join key |
| `near_airport` | `MIA` \| `FLL` | **same airport concept as the flight tools** — see tie-in below |
| `star_rating` | 2 \| 3 \| 4 \| 5 | |
| `guest_rating` | 1.0–5.0 | one decimal |
| `price_per_night_usd` | > 0 | `currency` always USD |
| `rooms_left` | int 0–9 | GDS-style capped display (seats_left convention) |
| `refundable` | boolean | |
| `breakfast_included` | boolean | baggage_included convention |
| `distance_to_port_km` | > 0 | **invariant**: near MIA ⇒ ≤ 20; near FLL ⇒ ≥ 20 |
| `sold_out` | `YYYY-MM-DD`[] | unique dates in the 2026-09 window; a requested stay is unavailable if ANY night overlaps |
| `tags[]` | ≥ 1 | `port-shuttle`, `airport-shuttle`, `beachfront`, `budget` (< $120), `premium`, `family-friendly`, `breakfast`, `last-rooms` (≤ 2), `walkable-port` (≤ 3 km) |

Distribution: 12 Miami (9 near MIA, **3 near FLL** — the
Aventura/Sunny-Isles corridor) + 6 Fort Lauderdale (all near FLL). Price
range $79–$349/night. Three hotels sold out on 2026-09-12 and one on
2026-09-13 (cruise-prep crunch) — sold-out dates give `check_in`/
`check_out` real filtering power instead of being price inputs only.

**`scenario.original_hotel_reservation`** mirrors flights.json's
`original_booking`: `HTL-R001` at a downtown-Miami hotel (`HT-002`),
check-in `2026-09-12T16:00:00-04:00`, check-out `2026-09-14T11:00:00-04:00`
(2 nights) — the booking tied to the cancelled flight. The store seeds
this reservation (ADR-0004 addendum); `update_hotel_reservation` shifts
it. The seeded hotel is deliberately never sold out on any date the
reservation could move to (no cancel/rebook tool exists — a dead end there
would trap the agent).

**`near_airport` tie-in:** it reuses the MIA/FLL destination concept from
the flight tools (same codes, same scenario widening) and is deliberately
NOT a proxy for `city` — Miami-city hotels near FLL exist, so the two
filters cut independently, and the port-distance invariant keeps the
geography honest.

### Ground transport — `src/data/ground-transport.json`

Not a vehicle list — a **fare model**: 3 vehicle types × 6 routes.

- `vehicle_types[]`: `{type: taxi|shuttle|rideshare, base_fare_usd (>0),
  per_km_usd (>0), wait_minutes (0–60)}`.
- `routes[]`: `{from_airport: MIA|FLL, to_zone: <hotel zone enum>,
  distance_km (>0), typical_minutes (>0)}` — full 2×3 coverage of
  airports × zones, so every (arrival airport, hotel zone) pair the store
  can produce has a route.
- Cost = `round2(base_fare_usd + per_km_usd × distance_km)`; door-to-door
  time = `wait_minutes + typical_minutes` (both feed
  `est_dropoff_iso`).

Fare-model ordering invariant (test-asserted): on FLL→downtown-miami,
`shuttle < rideshare < taxi` ($25.64 < $65.90 < $95.90) — the realistic
pattern that makes the type choice a genuine trade-off in the demo.

### Sizing rationale

18 hotels / 6 priceable transport combos vs 26 flights: the hotel search
space is one metro area, not intercontinental schedules — smaller fits,
and the dataset's job is discriminating power (both sides of every cut),
not volume. Tests assert: both cities, both `near_airport` values, all
three zones, both sides of a $150/night cut, ≥ 1 available stay in each
city for the scenario window, and the Miami-near-FLL independence case.

## Options rejected

| Option | Why rejected |
|---|---|
| Live hotel/transit APIs | No backend exists or is wanted (ADR-0001); judging must be deterministic and offline-safe; the product surface is the tools, not the data source. |
| Reuse the flight schema verbatim | Hotels have no segments/layovers; forcing the shape would fake invariants. Conventions (ids, USD, capped availability counters, tags, validator+tests+doc) transfer; fields don't. |
| 50+ hotels / per-room-type rates | Volume without discriminating power bloats the bundle and the 1.5K-bounded results page; per-room pricing is over-modelling for a tool whose output must stay compact. |
| Free-text neighbourhood strings | The transport join needs a controlled zone enum; free text breaks the (airport, zone) route lookup. |
| `near_airport` as boolean or city-alias | Kills the FLL-widening payoff: the agent must be able to say "Miami hotels near FLL" and get a distinct, useful cut. |

## Consequences

- Two more `docs/domain/` docs with the flight doc's structure; two more
  `validateDataset()` suites inside `verify.sh` — arithmetic drift fails
  the build, same as flights.
- The zone enum is shared between datasets (hotels reference zones,
  routes key on them) — widening it requires updating both validators and
  both docs in one commit.
- `search_hotels` pricing (`total_stay_usd = nights × nightly`) is
  computed at query time, so dataset prices stay per-night only.
- Transport prices are derived, not stored per combo — one fare edit
  re-prices all six routes coherently.
