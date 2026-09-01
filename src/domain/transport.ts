/**
 * Ground-transport domain — fare-model types, dataset validation, pure
 * pricing. Design record: docs/decisions/0005-synthetic-ancillary-datasets.md
 * (ADR-0005); schema doc: docs/domain/ground-transport-dataset.md.
 *
 * Not a vehicle list: 3 vehicle types × 6 routes; every priceable
 * combination is DERIVED (base + per_km × distance), so one fare edit
 * re-prices all routes coherently.
 */

import raw from '../data/ground-transport.json'
import { HOTEL_ZONES, type HotelZone } from './hotels.ts'

export type TransportType = 'taxi' | 'shuttle' | 'rideshare'
export const TRANSPORT_TYPES: readonly TransportType[] = ['taxi', 'shuttle', 'rideshare']
export type FromAirport = 'MIA' | 'FLL'
export const FROM_AIRPORTS: readonly FromAirport[] = ['MIA', 'FLL']

export interface VehicleTypeFare {
  type: TransportType
  base_fare_usd: number
  per_km_usd: number
  wait_minutes: number
}

export interface TransportRoute {
  from_airport: FromAirport
  to_zone: HotelZone
  distance_km: number
  typical_minutes: number
}

export interface GroundTransportDataset {
  generated_at: string
  scenario: { name: string }
  vehicle_types: VehicleTypeFare[]
  routes: TransportRoute[]
}

export function validateGroundTransportDataset(data: GroundTransportDataset): string[] {
  const errors: string[] = []

  const types = data.vehicle_types
  if (types.length !== TRANSPORT_TYPES.length) {
    errors.push(`Expected exactly ${TRANSPORT_TYPES.length} vehicle types, got ${types.length}.`)
  }
  const seenTypes = new Set<string>()
  for (const t of types) {
    if (!(TRANSPORT_TYPES as readonly string[]).includes(t.type)) {
      errors.push(`Unknown vehicle type "${t.type}".`)
    }
    if (seenTypes.has(t.type)) errors.push(`Duplicate vehicle type "${t.type}".`)
    seenTypes.add(t.type)
    if (!(t.base_fare_usd > 0)) errors.push(`${t.type}: base_fare_usd must be > 0.`)
    if (!(t.per_km_usd > 0)) errors.push(`${t.type}: per_km_usd must be > 0.`)
    if (!Number.isInteger(t.wait_minutes) || t.wait_minutes < 0 || t.wait_minutes > 60) {
      errors.push(`${t.type}: wait_minutes must be an integer 0-60.`)
    }
  }

  const routes = data.routes
  if (routes.length !== FROM_AIRPORTS.length * HOTEL_ZONES.length) {
    errors.push(`Expected ${FROM_AIRPORTS.length * HOTEL_ZONES.length} routes, got ${routes.length}.`)
  }
  const seenRoutes = new Set<string>()
  for (const r of routes) {
    if (!FROM_AIRPORTS.includes(r.from_airport)) {
      errors.push(`Route ${r.from_airport}→${r.to_zone}: from_airport must be MIA or FLL.`)
    }
    if (!HOTEL_ZONES.includes(r.to_zone)) {
      errors.push(`Route ${r.from_airport}→${r.to_zone}: to_zone must be one of ${HOTEL_ZONES.join(', ')}.`)
    }
    const key = `${r.from_airport}→${r.to_zone}`
    if (seenRoutes.has(key)) errors.push(`Duplicate route ${key}.`)
    seenRoutes.add(key)
    if (!(r.distance_km > 0)) errors.push(`Route ${key}: distance_km must be > 0.`)
    if (!Number.isInteger(r.typical_minutes) || r.typical_minutes <= 0 || r.typical_minutes > 180) {
      errors.push(`Route ${key}: typical_minutes must be an integer 1-180.`)
    }
  }
  // Full airport × zone coverage — every (arrival, hotel zone) pair the
  // store can produce must have a route.
  for (const a of FROM_AIRPORTS) {
    for (const z of HOTEL_ZONES) {
      if (!seenRoutes.has(`${a}→${z}`)) errors.push(`Missing route ${a}→${z}.`)
    }
  }

  // Fare ordering on the long FLL→downtown-miami route: shuttle cheapest,
  // taxi priciest — the genuine trade-off the demo narrates.
  const fll = findRoute(data, 'FLL', 'downtown-miami')
  if (fll) {
    const prices = Object.fromEntries(
      types.map((t) => [t.type, fareFor(t, fll)]),
    ) as Record<string, number>
    if (!(prices['shuttle']! < prices['rideshare']! && prices['rideshare']! < prices['taxi']!)) {
      errors.push(
        `FLL→downtown-miami fares must satisfy shuttle < rideshare < taxi (got ${prices['shuttle']} / ${prices['rideshare']} / ${prices['taxi']}).`,
      )
    }
  }

  return errors
}

export function loadGroundTransportDataset(): GroundTransportDataset {
  return raw as unknown as GroundTransportDataset
}

// ---------------------------------------------------------------------------
// Pure pricing (no store, no DOM, no side effects).
// ---------------------------------------------------------------------------

/** Round to cents once, at the final value (L003: no intermediate rounding). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function findRoute(
  data: GroundTransportDataset,
  fromAirport: string,
  toZone: string,
): TransportRoute | null {
  return data.routes.find((r) => r.from_airport === fromAirport && r.to_zone === toZone) ?? null
}

export function findFare(data: GroundTransportDataset, type: string): VehicleTypeFare | null {
  return data.vehicle_types.find((t) => t.type === type) ?? null
}

export function fareFor(fare: VehicleTypeFare, route: TransportRoute): number {
  return round2(fare.base_fare_usd + fare.per_km_usd * route.distance_km)
}

/** Door-to-door from pickup: boarding wait + typical drive time. */
export function estimateTravelMinutes(fare: VehicleTypeFare, route: TransportRoute): number {
  return fare.wait_minutes + route.typical_minutes
}
