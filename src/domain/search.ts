/**
 * Pure flight-search logic — shared by search_flights (Tool 1) and
 * update_constraints (Tool 3, which must re-run the search with merged
 * constraints per its task contract). No store, no DOM, no side effects:
 * trivially unit-testable and reusable.
 */

import type { Flight, FlightSegment } from './flights.ts'

export interface SearchFilters {
  /** Airport code, or a list of codes (any-of) — required at the T1 tool boundary. */
  destination?: string | readonly string[]
  /** ISO-with-offset; flights arriving at or before this instant pass. */
  arriveBefore?: string
  maxPriceUsd?: number
  maxLayoverHours?: number
  /** ISO-with-offset; ordering hint only — closest departure first. */
  preferredTime?: string | null
}

export interface SegmentSummary {
  flight_number: string
  from: string
  to: string
  depart_iso: string
  arrive_iso: string
}

export interface FlightSummary {
  id: string
  airline_code: string
  route: string
  depart_iso: string
  arrive_iso: string
  duration_minutes: number
  stops: number
  total_layover_minutes: number
  price_usd: number
  cabin: string
  seats_left: number
  refundable: boolean
  tags: string[]
  segments: SegmentSummary[]
}

export function toSummary(f: Flight): FlightSummary {
  const airlines = [...new Set(f.segments.map((s) => s.airline_code))]
  const routeStops = f.stops === 0 ? 'nonstop' : `${f.stops}-stop`
  return {
    id: f.id,
    airline_code: airlines.join('+'),
    route: `${f.origin.code}→${f.destination.code} (${routeStops})`,
    depart_iso: f.depart_iso,
    arrive_iso: f.arrive_iso,
    duration_minutes: f.duration_minutes,
    stops: f.stops,
    total_layover_minutes: f.total_layover_minutes,
    price_usd: f.price_usd,
    cabin: f.cabin,
    seats_left: f.seats_left,
    refundable: f.refundable,
    tags: f.tags,
    segments: f.segments.map((s: FlightSegment): SegmentSummary => ({
      flight_number: s.flight_number,
      from: s.from,
      to: s.to,
      depart_iso: s.depart_iso,
      arrive_iso: s.arrive_iso,
    })),
  }
}

function comparePriceThenDurationThenId(a: Flight, b: Flight): number {
  if (a.price_usd !== b.price_usd) return a.price_usd - b.price_usd
  if (a.duration_minutes !== b.duration_minutes) {
    return a.duration_minutes - b.duration_minutes
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function compareClosestToPreferred(preferredMs: number) {
  return (a: Flight, b: Flight): number => {
    const da = Math.abs(Date.parse(a.depart_iso) - preferredMs)
    const db = Math.abs(Date.parse(b.depart_iso) - preferredMs)
    if (da !== db) return da - db
    return comparePriceThenDurationThenId(a, b)
  }
}

export function searchFlights(
  flights: Flight[],
  filters: SearchFilters,
): FlightSummary[] {
  const pass = (f: Flight): boolean => {
    if (filters.destination !== undefined) {
      const allowed =
        typeof filters.destination === 'string'
          ? [filters.destination]
          : filters.destination
      if (!allowed.includes(f.destination.code)) return false
    }
    if (
      filters.arriveBefore !== undefined &&
      Date.parse(f.arrive_iso) > Date.parse(filters.arriveBefore)
    ) {
      return false
    }
    if (filters.maxPriceUsd !== undefined && f.price_usd > filters.maxPriceUsd) {
      return false
    }
    if (
      filters.maxLayoverHours !== undefined &&
      f.total_layover_minutes > filters.maxLayoverHours * 60
    ) {
      return false
    }
    return true
  }

  const matched = flights.filter(pass)
  if (filters.preferredTime) {
    const preferredMs = Date.parse(filters.preferredTime)
    if (!Number.isNaN(preferredMs)) {
      matched.sort(compareClosestToPreferred(preferredMs))
      return matched.map(toSummary)
    }
  }
  matched.sort(comparePriceThenDurationThenId)
  return matched.map(toSummary)
}
