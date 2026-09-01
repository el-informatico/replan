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
  return {
    items,
    total_usd: total,
    budget: {
      max_price_usd: max,
      within_budget: total <= max,
      delta_usd: round2(total - max),
    },
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
  status: 'complete' | 'partial'
  missing: CostKind[]
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
  }[]
  transport:
    | {
        booking_ref: string
        type: string
        from_airport: string
        to_zone: string
        pickup_time: string
        price_usd: number
      }
    | null
  notifications: {
    count: number
    last: { id: string; channel: string; target: string; sent_at: string } | null
  }
  cost: CostBreakdown
}

export function composeItinerary(snapshot: StoreSnapshot): ItinerarySummary {
  const booked = new Set(bookedKinds(snapshot))
  const missing = COST_KINDS.filter((k) => !booked.has(k))

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

  const hotels = snapshot.hotelReservations.map((res) => {
    const hotel = hotelById(loadHotelsDataset().hotels, res.hotelId)
    return {
      reservation_id: res.reservationId,
      hotel_name: hotel ? hotel.name : res.hotelId,
      check_in: res.checkInIso,
      check_out: res.checkOutIso,
      nights: res.nights,
      total_usd: res.totalUsd,
      updated: res.updatedAtIso !== null,
    }
  })

  const t = snapshot.transportBooking
  const transport = t
    ? {
        booking_ref: t.bookingRef,
        type: t.type,
        from_airport: t.fromAirport,
        to_zone: t.toZone,
        pickup_time: t.pickupIso,
        price_usd: t.priceUsd,
      }
    : null

  const last = snapshot.notifications.length > 0 ? snapshot.notifications.at(-1)! : null

  return {
    status: missing.length === 0 ? 'complete' : 'partial',
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
