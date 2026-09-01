/**
 * Trip-level composition — the ONE definition of "the trip total" (D010).
 *
 * Pure functions over a structural snapshot: calculate_total_cost,
 * generate_itinerary_summary, and the UI's running-total card all call
 * buildCostBreakdown so two implementations can never drift. Imports from
 * the store are TYPE-ONLY (erased at build) — no runtime dependency, the
 * store remains the only mutable owner.
 */

import { hotelById, loadHotelsDataset } from './hotels.ts'
import type { StoreSnapshot } from '../state/store.ts'
import { round2 } from './transport.ts'

export type CostKind = 'flight' | 'hotel' | 'transport'
export const COST_KINDS: readonly CostKind[] = ['flight', 'hotel', 'transport']

export interface CostItem {
  kind: CostKind
  id: string
  description: string
  cost_usd: number
}

export interface CostBreakdown {
  items: CostItem[]
  total_usd: number
  /** The stored constraint (update_constraints last set it; scenario default). */
  budget: {
    max_price_usd: number
    within_budget: boolean
    /** total − max: positive = over by that much, negative = under. */
    delta_usd: number
  }
  /**
   * Present when more than one distinct flight is booked: the total uses
   * only the latest booking, and hiding that would violate the same
   * read-time honesty standard as stale_reason (audit B2). The fields are
   * a STATE fact — they appear regardless of the requested kinds.
   */
  multiple_bookings_detected?: boolean
  superseded_flight_ids?: string[]
}

/** Latest confirmed booking by confirmed_at (insertion order breaks ties). */
function latestBookingOf(snapshot: StoreSnapshot): StoreSnapshot['bookings'][number] | null {
  const all = snapshot.bookings
  if (all.length === 0) return null
  return all.reduce((a, b) => (a.confirmedAt <= b.confirmedAt ? b : a))
}

export function buildCostBreakdown(
  snapshot: StoreSnapshot,
  kinds: readonly CostKind[] = COST_KINDS,
): CostBreakdown {
  const items: CostItem[] = []
  const include = (k: CostKind) => kinds.includes(k)

  if (include('flight')) {
    const booking = latestBookingOf(snapshot)
    if (booking) {
      const flight = booking.itinerary['flight'] as { route?: string } | undefined
      items.push({
        kind: 'flight',
        id: booking.flightId,
        description: flight?.route ?? booking.flightId,
        cost_usd: Number(booking.itinerary['price_usd'] ?? 0),
      })
    }
  }

  if (include('hotel')) {
    for (const res of snapshot.hotelReservations) {
      const hotel = hotelById(loadHotelsDataset().hotels, res.hotelId)
      items.push({
        kind: 'hotel',
        id: res.reservationId,
        description: `${hotel ? hotel.name : res.hotelId}, ${res.nights} night${res.nights === 1 ? '' : 's'}`,
        cost_usd: res.totalUsd,
      })
    }
  }

  if (include('transport') && snapshot.transportBooking) {
    const t = snapshot.transportBooking
    items.push({
      kind: 'transport',
      id: t.bookingRef,
      description: `${t.type} ${t.fromAirport}→${t.toZone}`,
      cost_usd: t.priceUsd,
    })
  }

  const total = round2(items.reduce((sum, i) => sum + i.cost_usd, 0))
  const max = snapshot.constraints.maxPriceUsd

  // Audit B2: when several distinct flights are booked, the flight item
  // above uses only the latest — surface the others instead of silently
  // dropping them (same honesty standard as the receipt's stale_reason).
  const latest = latestBookingOf(snapshot)
  const superseded = latest
    ? snapshot.bookings.filter((b) => b !== latest).map((b) => b.flightId)
    : []

  return {
    items,
    total_usd: total,
    budget: {
      max_price_usd: max,
      within_budget: total <= max,
      delta_usd: round2(total - max),
    },
    ...(superseded.length > 0
      ? { multiple_bookings_detected: true, superseded_flight_ids: superseded }
      : {}),
  }
}

/** Which booked domains are present — drives generate_itinerary_summary's missing list. */
export function bookedKinds(snapshot: StoreSnapshot): CostKind[] {
  const kinds: CostKind[] = []
  if (latestBookingOf(snapshot)) kinds.push('flight')
  if (snapshot.hotelReservations.length > 0) kinds.push('hotel')
  if (snapshot.transportBooking) kinds.push('transport')
  return kinds
}

// ---------------------------------------------------------------------------
// Itinerary composition — the final-receipt moment (T10). Compact by
// design: no flight segments, no tag lists; the ledger lives in the store.
// ---------------------------------------------------------------------------

export interface ItinerarySummary {
  status: 'complete' | 'partial' | 'needs_attention'
  /** What is still unbooked, each naming the tool that books it (T10 AC3). */
  missing: { kind: CostKind; book_via: string }[]
  flight:
    | {
        confirmation_ref: string
        id: string
        route: string
        departs: string
        arrives: string
        price_usd: number
      }
    | null
  hotels: {
    reservation_id: string
    hotel_name: string
    check_in: string
    check_out: string
    nights: number
    total_usd: number
    updated: boolean
    /** Set when the entry no longer fits the CURRENT confirmed flight. */
    stale_reason: string | null
  }[]
  transport:
    | {
        booking_ref: string
        type: string
        from_airport: string
        to_zone: string
        pickup_time: string
        price_usd: number
        stale_reason: string | null
      }
    | null
  notifications: {
    count: number
    last: { id: string; channel: string; target: string; sent_at: string } | null
  }
  cost: CostBreakdown
}

const BOOK_VIA: Record<CostKind, string> = {
  flight: 'hold_reservation + confirm_booking',
  hotel: 'update_hotel_reservation',
  transport: 'book_ground_transport',
}

/** Arrival instant of a booking's flight, if present. */
function arrivalOf(booking: StoreSnapshot['bookings'][number]): string | null {
  const flight = booking.itinerary['flight'] as { arrive_iso?: string } | undefined
  return flight?.arrive_iso ?? null
}

/** Destination airport of a booking (last segment's landing). */
function destinationOf(booking: StoreSnapshot['bookings'][number]): string | null {
  const segments = (booking.itinerary['flight'] as { segments?: { to: string }[] } | undefined)
    ?.segments
  return segments && segments.length > 0 ? segments[segments.length - 1]!.to : null
}

export function composeItinerary(snapshot: StoreSnapshot): ItinerarySummary {
  const booked = new Set(bookedKinds(snapshot))
  const missing = COST_KINDS.filter((k) => !booked.has(k)).map((kind) => ({
    kind,
    book_via: BOOK_VIA[kind],
  }))

  const booking = latestBookingOf(snapshot)
  const flight = booking
    ? (() => {
        const f = booking.itinerary['flight'] as
          | { route?: string; depart_iso?: string; arrive_iso?: string }
          | undefined
        return {
          confirmation_ref: booking.confirmationRef,
          id: booking.flightId,
          route: f?.route ?? booking.flightId,
          departs: f?.depart_iso ?? '',
          arrives: f?.arrive_iso ?? '',
          price_usd: Number(booking.itinerary['price_usd'] ?? 0),
        }
      })()
    : null

  // Read-time honesty (reviewer finding 2): write-time validation can be
  // superseded by a later flight re-confirmation. Cross-check every entry
  // against the CURRENT booking and say so, instead of attesting a
  // coherent trip that no longer is one.
  const arrival = booking ? arrivalOf(booking) : null
  const destination = booking ? destinationOf(booking) : null

  const hotels = snapshot.hotelReservations.map((res) => {
    const hotel = hotelById(loadHotelsDataset().hotels, res.hotelId)
    const stale =
      arrival !== null && res.checkInIso.slice(0, 10) < arrival.slice(0, 10)
        ? `check-in ${res.checkInIso} precedes the confirmed flight's arrival (${arrival}) — shift it with update_hotel_reservation`
        : null
    return {
      reservation_id: res.reservationId,
      hotel_name: hotel ? hotel.name : res.hotelId,
      check_in: res.checkInIso,
      check_out: res.checkOutIso,
      nights: res.nights,
      total_usd: res.totalUsd,
      updated: res.updatedAtIso !== null,
      stale_reason: stale,
    }
  })

  const t = snapshot.transportBooking
  let transportStale: string | null = null
  if (t && arrival !== null) {
    const pickupMs = Date.parse(t.pickupIso)
    const arrivalMs = Date.parse(arrival)
    if (destination !== null && t.fromAirport !== destination) {
      transportStale = `booked from ${t.fromAirport} but the confirmed flight now arrives at ${destination} (${arrival}) — re-run book_ground_transport`
    } else if (pickupMs < arrivalMs + 15 * 60_000 || pickupMs > arrivalMs + 8 * 3_600_000) {
      transportStale = `pickup ${t.pickupIso} no longer fits the confirmed arrival (${arrival}) — re-run book_ground_transport`
    }
  }
  const transport = t
    ? {
        booking_ref: t.bookingRef,
        type: t.type,
        from_airport: t.fromAirport,
        to_zone: t.toZone,
        pickup_time: t.pickupIso,
        price_usd: t.priceUsd,
        stale_reason: transportStale,
      }
    : null

  const anyStale =
    hotels.some((h) => h.stale_reason !== null) || transportStale !== null

  const last = snapshot.notifications.length > 0 ? snapshot.notifications.at(-1)! : null

  return {
    // Stale dominates missing: a booked-but-now-wrong entry is more urgent
    // than an unbought one; the receipt carries both lists either way.
    status: anyStale ? 'needs_attention' : missing.length > 0 ? 'partial' : 'complete',
    missing,
    flight,
    hotels,
    transport,
    notifications: {
      count: snapshot.notifications.length,
      last: last
        ? {
            id: last.notificationId,
            channel: last.channel,
            target: last.recipientTarget,
            sent_at: last.sentAtIso,
          }
        : null,
    },
    cost: buildCostBreakdown(snapshot),
  }
}
