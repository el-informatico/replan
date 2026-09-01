# Ground-Transport Dataset — Schema & Scenario

Dataset: `src/data/ground-transport.json` · Validator:
`src/domain/transport.ts` (`validateGroundTransportDataset`) · Tests:
`src/domain/transport.test.ts` (run by `scripts/verify.sh`).

**Entirely synthetic.** Fictional fares. Every edit to the JSON is checked
against the invariants below by the unit suite — arithmetic drift fails
the build.

## Scenario anchor

The traveller lands at MIA **or FLL** (Phase-1 widening) and needs to
reach the hotel. The dataset is not a vehicle list — it is a **fare
model**: 3 vehicle types × 6 routes, every priceable combination **derived**
(`base_fare_usd + per_km_usd × distance_km`, cents-rounded once), so one
fare edit re-prices all routes coherently. Route selection is state-driven
(`book_ground_transport`): from_airport = the confirmed flight's arrival
airport; to_zone = the hotel reservation's zone (the shared `HotelZone`
enum is the join key between this dataset and `hotels.json`).

## Contents

| Type | Base | Per km | Wait |
|---|---|---|---|
| `taxi` | $3.50 | $2.20 | 5 min |
| `shuttle` | $8.00 | $0.42 | 25 min |
| `rideshare` | $5.00 | $1.45 | 8 min |

Routes (full 2×3 airport × zone coverage — validator-enforced):

| From | To zone | Distance | Typical |
|---|---|---|---|
| MIA | downtown-miami | 11 km | 20 min |
| MIA | miami-beach | 17 km | 28 min |
| MIA | fort-lauderdale | 42 km | 50 min |
| FLL | downtown-miami | 42 km | 55 min |
| FLL | miami-beach | 33 km | 40 min |
| FLL | fort-lauderdale | 8 km | 15 min |

Derived fares on the long FLL→downtown-miami leg: shuttle **$25.64** <
rideshare **$65.90** < taxi **$95.90** — the genuine trade-off
(`shuttle < rideshare < taxi` is a validator invariant). On the short
MIA→downtown-miami leg: $12.62 / $20.95 / $27.70.

## Schema

| Field | Type | Notes |
|---|---|---|
| `vehicle_types[].type` | `taxi` \| `shuttle` \| `rideshare` | exactly these three, no duplicates |
| `vehicle_types[].base_fare_usd` | number | > 0 |
| `vehicle_types[].per_km_usd` | number | > 0 |
| `vehicle_types[].wait_minutes` | int 0–60 | boarding wait, part of door-to-door time |
| `routes[].from_airport` | `MIA` \| `FLL` | same airport concept as flights/hotels |
| `routes[].to_zone` | `HotelZone` | shared enum with hotels.json |
| `routes[].distance_km` | number | > 0 |
| `routes[].typical_minutes` | int 1–180 | typical drive time |

Door-to-door estimate = `wait_minutes + typical_minutes`;
`est_dropoff_iso = pickup_time + door-to-door`. Cost rounding happens once
at the final value (`round2`) — no intermediate rounding (L003).

## Maintenance rule

Any dataset edit must leave `validateGroundTransportDataset()` returning
`[]` — run `scripts/verify.sh`. Widening vehicle types or zones requires
updating the validator allowlist **and** this doc in the same commit; zone
changes must stay in lockstep with `hotels.json` (shared enum).
