/**
 * Flight dataset domain types + invariant validator.
 *
 * The dataset (src/data/flights.json) is hand-authored synthetic data; these
 * invariants are what make it trustworthy enough to build filtering tools on.
 * They are enforced by src/domain/flights.test.ts, which runs in
 * scripts/verify.sh — a dataset edit that breaks arithmetic fails the build.
 */

import raw from '../data/flights.json'

export interface AirportRef {
  code: string
  city: string
  tz: string
}

export interface FlightSegment {
  flight_number: string
  airline_code: string
  from: string
  to: string
  depart_iso: string
  arrive_iso: string
}

export interface Layover {
  airport: string
  minutes: number
}

export type Cabin = 'economy' | 'premium_economy' | 'business'

export interface Flight {
  id: string
  origin: AirportRef
  destination: AirportRef
  depart_iso: string
  arrive_iso: string
  duration_minutes: number
  stops: number
  segments: FlightSegment[]
  layovers: Layover[]
  total_layover_minutes: number
  price_usd: number
  currency: string
  cabin: Cabin
  seats_left: number
  refundable: boolean
  baggage_included: boolean
  tags: string[]
}

export interface ScenarioConstraints {
  must_arrive_by_iso: string
  destination_airports: string[]
  max_price_usd: number
  max_layover_hours: number
}

export interface Scenario {
  name: string
  description: string
  original_booking: {
    flight_number: string
    route: string
    depart_iso: string
    arrive_iso: string
    status: string
    refund_due_usd: number
  }
  constraints_hint: ScenarioConstraints
}

export interface FlightDataset {
  generated_at: string
  scenario: Scenario
  flights: Flight[]
}

/** ISO 8601 with mandatory explicit offset, e.g. 2026-09-12T08:10:00-05:00 */
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/

const CABINS: readonly string[] = ['economy', 'premium_economy', 'business']

/**
 * Validates the dataset against every documented invariant.
 * Returns a list of human-readable violations; empty array = valid.
 */
export function validateDataset(data: FlightDataset): string[] {
  const v: string[] = []
  const push = (id: string, msg: string) => v.push(`${id}: ${msg}`)

  if (data.flights.length < 20 || data.flights.length > 30) {
    v.push(`dataset: expected 20–30 flights, got ${data.flights.length}`)
  }

  const ids = new Set<string>()
  for (const f of data.flights) {
    if (ids.has(f.id)) v.push(`dataset: duplicate id ${f.id}`)
    ids.add(f.id)
  }

  for (const f of data.flights) {
    if (f.origin.code !== 'LIM') push(f.id, `origin must be LIM, got ${f.origin.code}`)
    if (!['MIA', 'FLL'].includes(f.destination.code)) {
      push(f.id, `destination must be MIA|FLL, got ${f.destination.code}`)
    }

    // Timestamp format + ordering
    for (const [label, ts] of [
      ['depart_iso', f.depart_iso],
      ['arrive_iso', f.arrive_iso],
    ] as const) {
      if (!ISO_WITH_OFFSET.test(ts)) push(f.id, `${label} not ISO-with-offset: ${ts}`)
    }
    const dep = Date.parse(f.depart_iso)
    const arr = Date.parse(f.arrive_iso)
    if (Number.isNaN(dep) || Number.isNaN(arr)) {
      push(f.id, 'depart/arrive not parseable')
      continue
    }
    if (arr <= dep) push(f.id, `arrive must be after depart (${f.arrive_iso} ≤ ${f.depart_iso})`)
    if ((arr - dep) / 60000 !== f.duration_minutes) {
      push(f.id, `duration_minutes ${f.duration_minutes} != actual ${(arr - dep) / 60000}`)
    }

    // Segment chain shape
    if (f.segments.length < 1) {
      push(f.id, 'must have ≥1 segment')
      continue
    }
    if (f.stops !== f.segments.length - 1) {
      push(f.id, `stops ${f.stops} != segments-1 (${f.segments.length - 1})`)
    }
    if (f.layovers.length !== f.stops) {
      push(f.id, `layovers count ${f.layovers.length} != stops ${f.stops}`)
    }
    if (f.segments[0]!.from !== f.origin.code) {
      push(f.id, `first segment departs ${f.segments[0]!.from}, not ${f.origin.code}`)
    }
    const last = f.segments[f.segments.length - 1]!
    if (last.to !== f.destination.code) {
      push(f.id, `last segment arrives ${last.to}, not ${f.destination.code}`)
    }
    if (f.segments[0]!.depart_iso !== f.depart_iso) {
      push(f.id, 'first segment depart != flight depart_iso')
    }
    if (last.arrive_iso !== f.arrive_iso) {
      push(f.id, 'last segment arrive != flight arrive_iso')
    }

    // Segment chain continuity + per-layover minutes + segment times
    let layoverSum = 0
    for (let i = 0; i < f.segments.length; i++) {
      const s = f.segments[i]!
      const sDep = Date.parse(s.depart_iso)
      const sArr = Date.parse(s.arrive_iso)
      if (Number.isNaN(sDep) || Number.isNaN(sArr) || sArr <= sDep) {
        push(f.id, `segment ${i} (${s.flight_number}) times invalid or non-positive`)
      }
      if (i > 0) {
        const prev = f.segments[i - 1]!
        if (prev.to !== s.from) {
          push(f.id, `segment chain broken: ${prev.flight_number}→${prev.to} then ${s.from}→…`)
        }
        const gapMin = (sDep - Date.parse(prev.arrive_iso)) / 60000
        const lay = f.layovers[i - 1]
        if (lay && lay.airport !== s.from) {
          push(f.id, `layover ${i - 1} airport ${lay.airport} != segment origin ${s.from}`)
        }
        if (lay && lay.minutes !== gapMin) {
          push(f.id, `layover ${i - 1} minutes ${lay.minutes} != actual gap ${gapMin}`)
        }
        layoverSum += lay ? lay.minutes : 0
      }
    }
    if (f.total_layover_minutes !== layoverSum) {
      push(f.id, `total_layover_minutes ${f.total_layover_minutes} != sum ${layoverSum}`)
    }

    // Commercial fields
    if (!(f.price_usd > 0)) push(f.id, `price_usd must be > 0, got ${f.price_usd}`)
    if (f.currency !== 'USD') push(f.id, `currency must be USD, got ${f.currency}`)
    if (!CABINS.includes(f.cabin)) push(f.id, `unknown cabin ${f.cabin}`)
    if (!Number.isInteger(f.seats_left) || f.seats_left < 0 || f.seats_left > 9) {
      push(f.id, `seats_left must be integer 0–9, got ${f.seats_left}`)
    }
    if (f.tags.length === 0) push(f.id, 'must carry ≥1 tag')
  }

  return v
}

/**
 * Convenience loader used by tests (and, later, by flight tools). The double
 * cast is deliberate: TS infers wide types (e.g. `cabin: string`) from JSON;
 * validateDataset() is what actually checks the shape at runtime.
 */
export function loadDataset(): FlightDataset {
  return raw as unknown as FlightDataset
}
