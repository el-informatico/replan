import { beforeEach, describe, expect, it } from 'vitest'

import {
  getSnapshot,
  getTransportBooking,
  resetForTests,
  subscribe,
} from '../state/store.ts'
import { confirmBookingTool } from './confirm.ts'
import { holdReservationTool } from './hold.ts'
import { bookGroundTransportTool } from './transport.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

/** FL-016 arrives MIA 2026-09-12T13:45:00-04:00; FL-021 arrives FLL 2026-09-13T06:05:00-04:00. */
async function confirmFlight(flightId: string) {
  await holdReservationTool.execute({ flight_id: flightId }, CALL)
  return confirmBookingTool.execute({ flight_id: flightId }, CALL)
}

describe('book_ground_transport — happy path', () => {
  it('books the MIA leg with derived route, fare, and dropoff estimate', async () => {
    const confirmed = await confirmFlight('FL-016')
    expect(confirmed['ok']).toBe(true)

    const r = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['status']).toBe('booked')
    expect(r['booking_ref']).toBe('RPLN-GT-TAXI-MIA')
    expect(r['from_airport']).toBe('MIA')
    expect(r['to_zone']).toBe('downtown-miami') // seeded hotel HT-002's zone
    expect(r['price_usd']).toBe(27.7) // 3.5 + 2.2×11
    expect(r['est_travel_minutes']).toBe(25) // wait 5 + typical 20
    expect(r['est_dropoff_iso']).toBe('2026-09-12T18:30:00.000Z') // 14:05-04:00 + 25 min
    expect(r['replaced_previous']).toBeUndefined()
  })

  it('prices the long FLL→downtown leg from the same fare model', async () => {
    await confirmFlight('FL-021') // FLL nonstop
    const r = await bookGroundTransportTool.execute(
      { type: 'shuttle', pickup_time: '2026-09-13T06:30:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['booking_ref']).toBe('RPLN-GT-SHUTTLE-FLL')
    expect(r['price_usd']).toBe(25.64) // 8 + 0.42×42
    expect(r['est_travel_minutes']).toBe(80) // wait 25 + typical 55
  })

  it('mutates the store and notifies subscribers', async () => {
    await confirmFlight('FL-016')
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await bookGroundTransportTool.execute(
      { type: 'rideshare', pickup_time: '2026-09-12T14:30:00-04:00' },
      CALL,
    )
    unsub()
    expect(notified).toBeGreaterThan(0)
    const stored = getTransportBooking()
    expect(stored!.type).toBe('rideshare')
    expect(stored!.priceUsd).toBe(20.95)
    expect(getSnapshot().transportBooking).not.toBeNull()
  })
})

describe('book_ground_transport — state-dependent edges', () => {
  it('requires a confirmed flight (cross-tool state)', async () => {
    const r = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('NO_CONFIRMED_FLIGHT')
    expect(r['error'] as string).toContain('confirm_booking')
  })

  it('enforces the pickup window exactly at both boundaries', async () => {
    await confirmFlight('FL-016') // lands 2026-09-12T13:45:00-04:00

    const atEarliest = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:00:00-04:00' }, // arrival + 15 min
      CALL,
    )
    expect(atEarliest['ok']).toBe(true)

    const justEarly = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T13:59:00-04:00' }, // arrival + 14 min
      CALL,
    )
    expect(justEarly['ok']).toBe(false)
    expect(justEarly['code']).toBe('PICKUP_TOO_EARLY')
    expect(justEarly['error'] as string).toContain('2026-09-12T13:45:00-04:00')

    const atLatest = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T21:45:00-04:00' }, // arrival + 8 h
      CALL,
    )
    expect(atLatest['ok']).toBe(true)

    const justLate = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T21:46:00-04:00' }, // arrival + 8 h + 1 min
      CALL,
    )
    expect(justLate['ok']).toBe(false)
    expect(justLate['code']).toBe('PICKUP_TOO_LATE')
  })

  it('re-booking replaces the singleton and reports the prior ref', async () => {
    await confirmFlight('FL-016')
    const first = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    expect(first['replaced_previous']).toBeUndefined()
    const second = await bookGroundTransportTool.execute(
      { type: 'shuttle', pickup_time: '2026-09-12T14:30:00-04:00' },
      CALL,
    )
    expect(second['ok']).toBe(true)
    expect(second['replaced_previous']).toBe('RPLN-GT-TAXI-MIA')
    expect(getTransportBooking()!.type).toBe('shuttle')
    expect(getTransportBooking()!.bookingRef).toBe('RPLN-GT-SHUTTLE-MIA')
  })

  it('rejects an unknown vehicle type naming all three', async () => {
    await confirmFlight('FL-016')
    const r = await bookGroundTransportTool.execute(
      { type: 'limo', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('UNKNOWN_TYPE')
    expect(r['error'] as string).toContain('taxi')
    expect(r['error'] as string).toContain('shuttle')
    expect(r['error'] as string).toContain('rideshare')
  })
})

describe('book_ground_transport — malformed input (errors as data)', () => {
  it('rejects missing fields, bad ISO, calendar rollovers, unknown keys', async () => {
    await confirmFlight('FL-016')
    for (const bad of [
      {},
      { type: 'taxi' },
      { type: 'taxi', pickup_time: 'tomorrow' },
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00' }, // no offset
      { type: 'taxi', pickup_time: '2026-02-30T14:05:00-04:00' }, // calendar
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00', extra: 1 },
    ]) {
      const r = await bookGroundTransportTool.execute(bad as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })

  it('never throws — non-object input returns an error object', async () => {
    for (const bad of [null, 42, 'taxi', []]) {
      const r = await bookGroundTransportTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})
