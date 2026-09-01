# Hotel Dataset — Schema & Scenario

Dataset: `src/data/hotels.json` · Validator: `src/domain/hotels.ts`
(`validateHotelsDataset`) · Tests: `src/domain/hotels.test.ts` (run by
`scripts/verify.sh`).

**Entirely synthetic.** Fictional properties and prices. Every edit to the
JSON is checked against the invariants below by the unit suite — arithmetic
drift fails the build.

## Scenario anchor

The traveller's original trip (cancelled AA 918 nonstop, LIM→MIA) included
a hotel booking. `scenario.original_hotel_reservation` carries it:

| Field | Value |
|---|---|
| `reservation_id` | `HTL-R001` |
| `hotel_id` | `HT-002` (Bayside Inn Downtown, 1.8 km from PortMiami) |
| `check_in` | `2026-09-12T15:00:00-04:00` |
| `check_out` | `2026-09-14T15:00:00-04:00` (2 nights) |
| `status` | `booked` |

The store seeds this reservation at page load (ADR-0004 Phase-2 addendum);
`update_hotel_reservation` shifts its dates once the replacement flight is
known. **D008 invariant:** the seeded hotel is never sold out on any date
the reservation could plausibly move to (2026-09-11…16) — no dead ends,
because no rebook-hotel tool exists.

## Contents

18 hotels: 12 in Miami (9 nearest MIA, **3 nearest FLL** — the
Aventura/Sunny-Isles corridor) and 6 in Fort Lauderdale (all nearest FLL).
Zones split 6/6/6 across `downtown-miami`, `miami-beach`,
`fort-lauderdale`. Price range $79–$349/night. Three hotels are sold out
on 2026-09-12 and three on 2026-09-13 (cruise-prep crunch) — which also
makes `city:"Miami" + near_airport:"FLL"` on the night of 09-13 a valid
**empty** result. One hotel has `rooms_left: 0` (excluded from results).

## Hotel schema

| Field | Type | Notes |
|---|---|---|
| `id` | string | `HT-###`, unique |
| `name` | string | non-empty, unique |
| `city` | `Miami` \| `Fort Lauderdale` | search filter |
| `zone` | `downtown-miami` \| `miami-beach` \| `fort-lauderdale` | shared enum with transport routes (the ground-leg join key); validator enforces zone↔city |
| `near_airport` | `MIA` \| `FLL` | same airport concept as the flight tools; independent of `city` |
| `star_rating` | int 2–5 | |
| `guest_rating` | 1.0–5.0 | exactly one decimal |
| `price_per_night_usd` | number | > 0; `currency` always `USD` |
| `rooms_left` | int 0–9 | GDS-style capped display; 0 = excluded from results |
| `refundable` | boolean | |
| `breakfast_included` | boolean | ⇔ `breakfast` tag (validator) |
| `distance_to_port_km` | number | > 0; **near MIA ⇒ ≤ 20, near FLL ⇒ ≥ 20** |
| `sold_out` | `YYYY-MM-DD`[] | unique, valid 2026-09 dates; a stay is excluded if ANY night overlaps |
| `tags[]` | string[] | ≥ 1, controlled vocabulary, no duplicates |

Stay pricing is computed at query time: `total_stay_usd = nights ×
price_per_night_usd`, nights in whole 24 h steps (check-in date counts as a
night, check-out does not).

## Filter-field mapping (Phase 2 search tool)

| Filter | Dataset field |
|---|---|
| city | `city` (exact) |
| near_airport | `near_airport` (exact) |
| check_in + check_out | `sold_out` (per-night overlap), `rooms_left > 0`; pricing via nights |

Discriminating power is asserted by tests: hotels exist in both cities,
both airports, all three zones, on both sides of $150/night, with and
without port shuttles, and the Miami-near-FLL cross proves `city` and
`near_airport` cut independently.

## Tags

Controlled vocabulary with validator-enforced equivalences:
`port-shuttle`, `airport-shuttle`, `beachfront` (beach zones only),
`budget` (< $120/night), `premium` (⇔ star_rating ≥ 4), `family-friendly`,
`breakfast` (⇔ breakfast_included), `last-rooms` (⇔ 1 ≤ rooms_left ≤ 2 —
0 means sold out entirely, a different state), `walkable-port` (⇔ distance
≤ 3 km).

## Maintenance rule

Any dataset edit must leave `validateHotelsDataset()` returning `[]` —
run `scripts/verify.sh`. Widening cities, zones, or the sold-out date
window requires updating the validator allowlist **and** this doc in the
same commit. The seeded reservation's hotel must stay bookable inside
2026-09-11…16 (D008).
