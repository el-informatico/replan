import { describe, expect, it } from 'vitest'

import { buildCostBreakdown, bookedKinds, composeItinerary } from './trip.ts'
import type { StoreSnapshot } from '../state/store.ts'

/** Structural snapshot factory — pure-function tests, no store mutation. */
function snapshot(partial: Partial<StoreSnapshot> = {}): StoreSnapshot {
  return {
    holds: [],
    bookings: [],
    constraints: {
      destinationAirports: ['MIA', 'FLL'],
      arriveBefore: '2026-09-13T15:00:00-04:00',
      maxPriceUsd: 650,
      maxLayoverHours: 4,
      preferredTime: null,
    },
    lastSearch: null,
    lastHotelSearch: null,
    hotelReservations: [],
    transportBooking: null,
    notifications: [],
    ...partial,
  }
}

describe('buildCostBreakdown (pure)', () => {
  it('empty state: no items, total 0, within budget', () => {
    const b = buildCostBreakdown(snapshot())
    expect(b.items).toEqual([])
    expect(b.total_usd).toBe(0)
    expect(b.budget).toEqual({ max_price_usd: 650, within_budget: true, delta_usd: -650 })
  })

  it('uses the LATEST booking when several flights are booked (no double count)', () => {
    const snap = snapshot({
      bookings: [
        {
          confirmationRef: 'RPLN-FL001',
          flightId: 'FL-001',
          confirmedAt: '2026-09-12T12:00:00.000Z',
          itinerary: { price_usd: 400, flight: { route: 'LIM→MIA (1-stop)' } },
        },
        {
          confirmationRef: 'RPLN-FL002',
          flightId: 'FL-002',
          confirmedAt: '2026-09-12T12:05:00.000Z',
          itinerary: { price_usd: 356, flight: { route: 'LIM→MIA (nonstop)' } },
        },
      ],
    })
    const b = buildCostBreakdown(snap)
    expect(b.items).toHaveLength(1)
    expect(b.items[0]!.id).toBe('FL-002')
    expect(b.items[0]!.cost_usd).toBe(356)
    expect(b.total_usd).toBe(356)
  })

  it('composes flight + hotel + transport with one final rounding', () => {
    const snap = snapshot({
      bookings: [
        {
          confirmationRef: 'RPLN-FL016',
          flightId: 'FL-016',
          confirmedAt: '2026-09-12T12:00:00.000Z',
          itinerary: { price_usd: 356, flight: { route: 'LIM→MIA (1-stop)' } },
        },
      ],
      hotelReservations: [
        {
          reservationId: 'HTL-R001',
          hotelId: 'HT-002',
          status: 'booked' as const,
          checkInIso: '2026-09-13T15:00:00-04:00',
          checkOutIso: '2026-09-15T15:00:00-04:00',
          nights: 2,
          pricePerNightUsd: 148,
          totalUsd: 296,
          updatedAtIso: null,
          source: 'scenario' as const,
        },
      ],
      transportBooking: {
        bookingRef: 'RPLN-GT-SHUTTLE-MIA',
        type: 'shuttle' as const,
        fromAirport: 'MIA',
        toZone: 'downtown-miami',
        pickupIso: '2026-09-12T14:30:00-04:00',
        estTravelMinutes: 45,
        estDropoffIso: '2026-09-12T19:15:00.000Z',
        priceUsd: 12.62,
        bookedAtIso: '2026-09-12T12:10:00.000Z',
      },
    })
    const b = buildCostBreakdown(snap)
    expect(b.items.map((i) => i.kind)).toEqual(['flight', 'hotel', 'transport'])
    expect(b.items[1]!.description).toBe('Bayside Inn Downtown, 2 nights')
    expect(b.items[2]!.description).toBe('shuttle MIA→downtown-miami')
    expect(b.total_usd).toBe(664.62) // 356 + 296 + 12.62 — OVER the $650 budget
    expect(b.budget.within_budget).toBe(false)
    expect(b.budget.delta_usd).toBe(14.62)
  })

  it('flags over-budget totals with a positive delta', () => {
    const snap = snapshot({
      bookings: [
        {
          confirmationRef: 'RPLN-FL005',
          flightId: 'FL-005',
          confirmedAt: '2026-09-12T12:00:00.000Z',
          itinerary: { price_usd: 700, flight: { route: 'LIM→MIA (nonstop)' } },
        },
      ],
    })
    const b = buildCostBreakdown(snap)
    expect(b.budget.within_budget).toBe(false)
    expect(b.budget.delta_usd).toBe(50)
  })

  it('filters by requested kinds', () => {
    const snap = snapshot({
      bookings: [
        {
          confirmationRef: 'RPLN-FL016',
          flightId: 'FL-016',
          confirmedAt: '2026-09-12T12:00:00.000Z',
          itinerary: { price_usd: 356, flight: { route: 'LIM→MIA (1-stop)' } },
        },
      ],
      hotelReservations: [
        {
          reservationId: 'HTL-R001',
          hotelId: 'HT-002',
          status: 'booked' as const,
          checkInIso: '2026-09-12T15:00:00-04:00',
          checkOutIso: '2026-09-14T15:00:00-04:00',
          nights: 2,
          pricePerNightUsd: 148,
          totalUsd: 296,
          updatedAtIso: null,
          source: 'scenario' as const,
        },
      ],
    })
    expect(buildCostBreakdown(snap, ['hotel']).total_usd).toBe(296)
    expect(buildCostBreakdown(snap, ['flight']).total_usd).toBe(356)
    expect(buildCostBreakdown(snap, ['transport']).items).toEqual([])
  })

  it('reads the budget from the CURRENT constraints, not a constant', () => {
    const snap = snapshot({
      constraints: {
        destinationAirports: ['MIA', 'FLL'],
        arriveBefore: '2026-09-13T15:00:00-04:00',
        maxPriceUsd: 300,
        maxLayoverHours: 4,
        preferredTime: null,
      },
    })
    expect(buildCostBreakdown(snap).budget.max_price_usd).toBe(300)
  })
})

describe('bookedKinds (pure)', () => {
  it('lists only what state actually holds', () => {
    expect(bookedKinds(snapshot())).toEqual([])
    const withHotel = snapshot({
      hotelReservations: [
        {
          reservationId: 'HTL-R001',
          hotelId: 'HT-002',
          status: 'booked' as const,
          checkInIso: '2026-09-12T15:00:00-04:00',
          checkOutIso: '2026-09-14T15:00:00-04:00',
          nights: 2,
          pricePerNightUsd: 148,
          totalUsd: 296,
          updatedAtIso: null,
          source: 'scenario' as const,
        },
      ],
    })
    expect(bookedKinds(withHotel)).toEqual(['hotel'])
  })
})

describe('composeItinerary (pure)', () => {
  it('empty structural snapshot: partial, all three missing with book-via pointers, total 0 (reviewer finding 4)', () => {
    const s = composeItinerary(snapshot())
    expect(s.status).toBe('partial')
    expect(s.missing).toEqual([
      { kind: 'flight', book_via: 'hold_reservation + confirm_booking' },
      { kind: 'hotel', book_via: 'update_hotel_reservation' },
      { kind: 'transport', book_via: 'book_ground_transport' },
    ])
    expect(s.flight).toBeNull()
    expect(s.hotels).toEqual([])
    expect(s.transport).toBeNull()
    expect(s.notifications).toEqual({ count: 0, last: null })
    expect(s.cost.total_usd).toBe(0)
    expect(s.cost.budget.within_budget).toBe(true)
  })
})
