import { beforeEach, describe, expect, it } from 'vitest'

import {
  getSnapshot,
  resetForTests,
  setClockForTests,
  setTransportBooking,
  subscribe,
} from '../state/store.ts'
import { confirmBookingTool } from './confirm.ts'
import { holdReservationTool } from './hold.ts'
import { notifyContactTool } from './notify.ts'
import { generateItinerarySummaryTool } from './summary.ts'
import { updateHotelReservationTool } from './hotel-reservation.ts'
import { bookGroundTransportTool } from './transport.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('generate_itinerary_summary — partial states (never an error)', () => {
  it('fresh state (seeded hotel only): partial, missing flight + transport', async () => {
    const r = await generateItinerarySummaryTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    expect(r['status']).toBe('partial')
    expect(r['missing']).toEqual([
      { kind: 'flight', book_via: 'hold_reservation + confirm_booking' },
      { kind: 'transport', book_via: 'book_ground_transport' },
    ])
    expect(r['flight']).toBeNull()
    expect(r['hotels']).toEqual([
      {
        reservation_id: 'HTL-R001',
        hotel_name: 'Bayside Inn Downtown',
        check_in: '2026-09-12T15:00:00-04:00',
        check_out: '2026-09-14T15:00:00-04:00',
        nights: 2,
        total_usd: 296,
        updated: false,
        stale_reason: null,
      },
    ])
    expect(r['transport']).toBeNull()
    expect(r['notifications']).toEqual({ count: 0, last: null })
    expect(r['cost']).toEqual({
      items: [
        { kind: 'hotel', id: 'HTL-R001', description: 'Bayside Inn Downtown, 2 nights', cost_usd: 296 },
      ],
      total_usd: 296,
      budget: { max_price_usd: 650, within_budget: true, delta_usd: -354 },
    })
  })

  it('the dispatch’s named edge — only a flight confirmed, nothing else booked', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    const confirmed = await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    expect(confirmed['ok']).toBe(true)

    const r = await generateItinerarySummaryTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    expect(r['status']).toBe('partial')
    expect(r['missing']).toEqual([{ kind: 'transport', book_via: 'book_ground_transport' }])
    const flight = r['flight'] as Record<string, unknown>
    expect(flight['confirmation_ref']).toBe('RPLN-FL016')
    expect(flight['route']).toBe('LIM→MIA (1-stop)')
    expect(flight['arrives']).toBe('2026-09-12T13:45:00-04:00')
    // No segments in the receipt — compact by contract.
    expect(JSON.stringify(r)).not.toContain('segments')
    // Hotel is scenario-seeded (D008): it is present but un-updated.
    const hotel = (r['hotels'] as Record<string, unknown>[])[0]!
    expect(hotel['updated']).toBe(false)
    expect(r['cost']).toEqual(
      expect.objectContaining({ total_usd: 652 }), // 356 + 296
    )
  })

  it('tolerates a tool-impossible store state (transport without a flight)', async () => {
    setTransportBooking({
      bookingRef: 'RPLN-GT-TAXI-MIA',
      type: 'taxi',
      fromAirport: 'MIA',
      toZone: 'downtown-miami',
      pickupIso: '2026-09-12T14:05:00-04:00',
      estTravelMinutes: 25,
      estDropoffIso: '2026-09-12T18:30:00.000Z',
      priceUsd: 27.7,
      bookedAtIso: '2026-09-12T12:10:00.000Z',
    })
    const r = await generateItinerarySummaryTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    expect(r['status']).toBe('partial')
    expect(r['missing']).toEqual([{ kind: 'flight', book_via: 'hold_reservation + confirm_booking' }])
    expect((r['transport'] as Record<string, unknown>)['booking_ref']).toBe('RPLN-GT-TAXI-MIA')
  })

  it('flags a stale transport leg when a later flight supersedes it (reviewer finding 2)', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL) // MIA
    await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    t += 60_000
    await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    // The traveler switches to an FLL flight landing the next morning.
    t += 3_600_000
    await holdReservationTool.execute({ flight_id: 'FL-021' }, CALL)
    await confirmBookingTool.execute({ flight_id: 'FL-021' }, CALL)

    const r = await generateItinerarySummaryTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    // Nothing is missing — but the MIA leg no longer fits the FLL itinerary.
    expect(r['status']).toBe('needs_attention')
    expect(r['missing']).toEqual([])
    const transport = r['transport'] as Record<string, unknown>
    expect(transport['from_airport']).toBe('MIA')
    expect(transport['stale_reason'] as string).toContain('FLL')
    expect(transport['stale_reason'] as string).toContain('book_ground_transport')
    // The cost total still reflects the leg currently in state (T9 = sum
    // of state); honesty about it lives in the receipt, not the sum.
    // FL-021 ($198) + hotel ($296) + the stale MIA taxi ($27.70).
    expect((r['cost'] as Record<string, unknown>)['total_usd']).toBe(521.7)
    // Two bookings exist in this scenario — the receipt's cost carries the
    // same honesty flag as the tool (audit B2, same read-time standard).
    expect((r['cost'] as Record<string, unknown>)['multiple_bookings_detected']).toBe(true)
  })

  it('flags a hotel check-in that predates a later-confirmed arrival (reviewer finding 2)', async () => {
    // No flight yet: any date is accepted (T6 AC5)...
    const early = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-11T15:00:00-04:00' },
      CALL,
    )
    expect(early['ok']).toBe(true)
    // ...then a flight lands on 09-12 and the receipt says so.
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)

    const r = await generateItinerarySummaryTool.execute({}, CALL)
    expect(r['status']).toBe('needs_attention')
    const hotel = (r['hotels'] as Record<string, unknown>[])[0]!
    expect(hotel['stale_reason'] as string).toContain('arrival')
    expect(hotel['stale_reason'] as string).toContain('update_hotel_reservation')
  })

  it('reports the LAST of several notifications with an exact count (reviewer finding 11)', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await notifyContactTool.execute(
      { contact: { phone: '+1 305 555 0100' }, new_arrival_time: '2026-09-12T13:45:00-04:00' },
      CALL,
    )
    t += 60_000
    await notifyContactTool.execute(
      { contact: { email: 'cousin@example.com' }, new_arrival_time: '2026-09-12T13:45:00-04:00' },
      CALL,
    )
    const r = await generateItinerarySummaryTool.execute({}, CALL)
    expect(r['notifications']).toEqual({
      count: 2,
      last: {
        id: 'NTF-002',
        channel: 'email',
        target: 'cousin@example.com',
        sent_at: '2026-09-12T12:01:00.000Z',
      },
    })
  })
})

describe('generate_itinerary_summary — the full receipt', () => {
  it('complete chain: flight + hotel update + transport + notification', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)

    await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    t += 60_000
    await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-12T20:00:00-04:00' },
      CALL,
    )
    t += 60_000
    await bookGroundTransportTool.execute(
      { type: 'shuttle', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    t += 60_000
    await notifyContactTool.execute(
      {
        contact: { name: 'María', phone: '+51 987 654 321' },
        new_arrival_time: '2026-09-12T13:45:00-04:00',
      },
      CALL,
    )

    const r = await generateItinerarySummaryTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    expect(r['status']).toBe('complete')
    expect(r['missing']).toEqual([])
    const hotel = (r['hotels'] as Record<string, unknown>[])[0]!
    expect(hotel['check_in']).toBe('2026-09-12T20:00:00-04:00')
    expect(hotel['check_out']).toBe('2026-09-14T20:00:00-04:00')
    expect(hotel['updated']).toBe(true)
    const transport = r['transport'] as Record<string, unknown>
    expect(transport['type']).toBe('shuttle')
    expect(transport['price_usd']).toBe(12.62)
    expect(r['notifications']).toEqual({
      count: 1,
      last: { id: 'NTF-001', channel: 'sms', target: '+51 987 654 321', sent_at: '2026-09-12T12:03:00.000Z' },
    })
    expect(r['cost']).toEqual(
      expect.objectContaining({ total_usd: 664.62 }), // 356 + 296 + 12.62
    )
    const budget = (r['cost'] as Record<string, unknown>)['budget'] as Record<string, unknown>
    expect(budget['within_budget']).toBe(false) // 664.62 > 650
    expect(budget['delta_usd']).toBe(14.62)

    // The complete receipt is the widest output this tool can produce —
    // it must fit the 1.5K budget (asserted here, where the chain exists).
    expect(
      JSON.stringify(r).length,
      `generate_itinerary_summary output: ${JSON.stringify(r).length} chars`,
    ).toBeLessThanOrEqual(1500)
  })
})

describe('generate_itinerary_summary — malformed input + read-only', () => {
  it('rejects any parameters', async () => {
    const r = await generateItinerarySummaryTool.execute({ anything: 1 }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('INVALID_INPUT')
    expect(r['error'] as string).toContain('anything')
  })

  it('never throws — non-object input returns an error object', async () => {
    for (const bad of [null, 42, 'x', []]) {
      const r = await generateItinerarySummaryTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })

  it('is read-only: no notifications to subscribers, snapshot unchanged', async () => {
    const before = JSON.stringify(getSnapshot())
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await generateItinerarySummaryTool.execute({}, CALL)
    unsub()
    expect(notified).toBe(0)
    expect(JSON.stringify(getSnapshot())).toBe(before)
  })
})
