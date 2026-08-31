/**
 * Simulated booking state — module-level in-memory observable store.
 * Design record: docs/decisions/0004-simulated-booking-state.md (ADR-0004).
 *
 * Owns holds, bookings, active search constraints, and the last result set.
 * Tools mutate; React subscribes (via subscribe + getSnapshot) and renders
 * live. State dies with the page — same lifetime as the WebMCP tools
 * themselves (spec: tools are removed on document unload).
 *
 * Time is injectable (setClockForTests) so expiry logic is deterministic in
 * unit tests. Expiry is lazy: read paths sweep expired holds; correctness
 * never depends on a timer firing.
 */

import { loadDataset } from '../domain/flights.ts'
import type { FlightSummary, SearchFilters } from '../domain/search.ts'

/** Hold TTL: 15 wall-clock minutes ("simulated" = no real airline involved). */
export const HOLD_TTL_MS = 15 * 60_000

export interface Constraints {
  destinationAirports: string[]
  arriveBefore: string
  maxPriceUsd: number
  maxLayoverHours: number
  preferredTime: string | null
}

export interface Hold {
  flightId: string
  createdAt: number
  expiresAt: number
}

export interface Booking {
  confirmationRef: string
  flightId: string
  confirmedAt: string
  itinerary: Record<string, unknown>
}

export interface LastSearch {
  via: 'search_flights' | 'update_constraints'
  filters: SearchFilters
  results: FlightSummary[]
}

export interface StoreSnapshot {
  holds: Hold[]
  bookings: Booking[]
  constraints: Constraints
  lastSearch: LastSearch | null
}

function initialConstraints(): Constraints {
  const hint = loadDataset().scenario.constraints_hint
  return {
    destinationAirports: [...hint.destination_airports],
    arriveBefore: hint.must_arrive_by_iso,
    maxPriceUsd: hint.max_price_usd,
    maxLayoverHours: hint.max_layover_hours,
    preferredTime: null,
  }
}

const holds = new Map<string, Hold>()
const bookings = new Map<string, Booking>()
/** flightId → expiry instant of the last hold that lapsed for it. */
const expiredHolds = new Map<string, number>()
let constraints: Constraints = initialConstraints()
let lastSearch: LastSearch | null = null

const listeners = new Set<() => void>()

let nowFn: () => number = () => Date.now()

/** Test seam: deterministic clock for expiry logic. */
export function setClockForTests(fn: () => number): void {
  nowFn = fn
}

export function now(): number {
  return nowFn()
}

export function nowIso(): string {
  return new Date(nowFn()).toISOString()
}

function notify(): void {
  for (const l of listeners) l()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Lazy sweep: drop holds whose expiry has passed. Called on every read path. */
function sweepExpiredHolds(): void {
  const t = nowFn()
  let changed = false
  for (const [id, h] of holds) {
    if (h.expiresAt <= t) {
      holds.delete(id)
      expiredHolds.set(id, h.expiresAt)
      changed = true
    }
  }
  if (changed) notify()
}

/** When the traveler's last hold on this flight lapsed, if ever. */
export function getExpiredHoldAt(flightId: string): number | null {
  return expiredHolds.get(flightId) ?? null
}

export function getSnapshot(): StoreSnapshot {
  sweepExpiredHolds()
  return {
    holds: [...holds.values()].sort((a, b) => a.expiresAt - b.expiresAt),
    bookings: [...bookings.values()],
    constraints,
    lastSearch,
  }
}

export function getActiveHold(flightId: string): Hold | null {
  sweepExpiredHolds()
  return holds.get(flightId) ?? null
}

/** Returns the hold that was rejected (still active) if the flight is held. */
export function createHold(flightId: string): Hold | { conflict: Hold } {
  sweepExpiredHolds()
  const existing = holds.get(flightId)
  if (existing) return { conflict: existing }
  const createdAt = nowFn()
  const hold: Hold = { flightId, createdAt, expiresAt: createdAt + HOLD_TTL_MS }
  holds.set(flightId, hold)
  notify()
  return hold
}

/** Consume (release) a hold — used by confirm_booking. */
export function consumeHold(flightId: string): Hold | null {
  sweepExpiredHolds()
  const h = holds.get(flightId)
  if (!h) return null
  holds.delete(flightId)
  notify()
  return h
}

export function getBooking(flightId: string): Booking | null {
  return bookings.get(flightId) ?? null
}

export function latestBooking(): Booking | null {
  const all = [...bookings.values()]
  if (all.length === 0) return null
  return all.reduce((a, b) => (a.confirmedAt <= b.confirmedAt ? b : a))
}

export function addBooking(booking: Booking): void {
  bookings.set(booking.flightId, booking)
  notify()
}

export function setConstraints(next: Constraints): void {
  constraints = next
  notify()
}

export function setLastSearch(search: LastSearch): void {
  lastSearch = search
  notify()
}

/** Test seam: reset to pristine state (constraints re-seeded from scenario). */
export function resetForTests(): void {
  holds.clear()
  bookings.clear()
  expiredHolds.clear()
  constraints = initialConstraints()
  lastSearch = null
  nowFn = () => Date.now()
  notify()
}
