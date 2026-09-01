import { beforeEach, describe, expect, it } from 'vitest'

import {
  getSnapshot,
  resetForTests,
  setClockForTests,
  subscribe,
} from '../state/store.ts'
import { confirmBookingTool } from './confirm.ts'
import { holdReservationTool } from './hold.ts'
import { shiftDays, updateHotelReservationTool } from './hotel-reservation.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

async function confirmFlight(flightId: string) {
  await holdReservationTool.execute({ flight_id: flightId }, CALL)
  return confirmBookingTool.execute({ flight_id: flightId }, CALL)
}

describe('update_hotel_reservation — happy path', () => {
  it('shifts check_in and check_out together, preserving nights and price', async () => {
    const T0 = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => T0)
    const r = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T15:00:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['status']).toBe('updated')
    expect(r['hotel_id']).toBe('HT-002')
    expect(r['hotel_name']).toBe('Bayside Inn Downtown')
    expect(r['check_in']).toBe('2026-09-13T15:00:00-04:00')
    expect(r['check_out']).toBe('2026-09-15T15:00:00-04:00')
    expect(r['nights']).toBe(2)
    expect(r['price_per_night_usd']).toBe(148)
    expect(r['total_usd']).toBe(296)
    expect(r['updated_at']).toBe('2026-09-12T12:00:00.000Z')
    expect(r['idempotent']).toBeUndefined()
    // Fixed-shape output — assert the 1.5K budget (reviewer finding 7).
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(1500)
  })

  it('mutates the store and notifies subscribers', async () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T15:00:00-04:00' },
      CALL,
    )
    unsub()
    expect(notified).toBeGreaterThan(0)
    const [res] = getSnapshot().hotelReservations
    expect(res!.checkInIso).toBe('2026-09-13T15:00:00-04:00')
    expect(res!.updatedAtIso).not.toBeNull()
  })

  it('preserves the offset spelling of the caller across the shift', async () => {
    const r = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T20:00:00-05:00' }, // Lima offset
      CALL,
    )
    expect(r['check_in']).toBe('2026-09-13T20:00:00-05:00')
    expect(r['check_out']).toBe('2026-09-15T20:00:00-05:00')
  })
})

describe('update_hotel_reservation — state-dependent edges', () => {
  it('rejects an unknown reservation_id listing the active ones', async () => {
    const r = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-999', new_check_in: '2026-09-13T15:00:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('NOT_FOUND')
    expect(r['error'] as string).toContain('HTL-R001')
    expect(r['error'] as string).toContain('1 total')
  })

  it('is idempotent for the same instant, including a different offset spelling', async () => {
    const T0 = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => T0)
    const first = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T15:00:00-04:00' },
      CALL,
    )
    expect(first['ok']).toBe(true)
    // Same instant expressed in UTC: 15:00-04:00 === 19:00Z.
    const second = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T19:00:00Z' },
      CALL,
    )
    expect(second['ok']).toBe(true)
    expect(second['idempotent']).toBe(true)
    expect(second['check_in']).toBe('2026-09-13T15:00:00-04:00') // stored spelling
    expect(second['updated_at']).toBe(first['updated_at']) // untouched
    expect(getSnapshot().hotelReservations).toHaveLength(1)
  })

  it('a no-op idempotent call does not notify subscribers', async () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    // Seeded check-in re-sent verbatim.
    const r = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-12T15:00:00-04:00' },
      CALL,
    )
    unsub()
    expect(r['idempotent']).toBe(true)
    expect(notified).toBe(0)
  })

  it('rejects a check-in before the confirmed flight’s arrival date', async () => {
    // FL-016 arrives 2026-09-12T13:45:00-04:00.
    const confirmed = await confirmFlight('FL-016')
    expect(confirmed['ok']).toBe(true)
    const r = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-11T15:00:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('CHECK_IN_BEFORE_ARRIVAL')
    expect(r['error'] as string).toContain('2026-09-12T13:45:00-04:00')
  })

  it('allows same-day-as-arrival and after-arrival check-ins', async () => {
    await confirmFlight('FL-016')
    const sameDay = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-12T20:00:00-04:00' },
      CALL,
    )
    expect(sameDay['ok']).toBe(true)
    const nextDay = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T01:00:00-04:00' },
      CALL,
    )
    expect(nextDay['ok']).toBe(true)
  })

  it('without a confirmed flight, any valid date is accepted', async () => {
    const r = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-10T15:00:00-04:00' },
      CALL,
    )
    expect(r['ok']).toBe(true)
  })

  it('idempotency does not mask a stored date a later flight invalidated (reviewer finding 2)', async () => {
    // No flight yet: 09-11 is accepted (T6 AC5).
    const early = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-11T15:00:00-04:00' },
      CALL,
    )
    expect(early['ok']).toBe(true)
    // Then a flight is confirmed landing 09-12T13:45-04:00...
    const T0 = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => T0)
    await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    // ...and re-sending the SAME stored date must error, not return
    // idempotent:true over stale state.
    const resend = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-11T15:00:00-04:00' },
      CALL,
    )
    expect(resend['ok']).toBe(false)
    expect(resend['code']).toBe('CHECK_IN_BEFORE_ARRIVAL')
  })

  it('resetForTests restores the seeded reservation', async () => {
    await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T15:00:00-04:00' },
      CALL,
    )
    resetForTests()
    const [res] = getSnapshot().hotelReservations
    expect(res!.checkInIso).toBe('2026-09-12T15:00:00-04:00')
    expect(res!.updatedAtIso).toBeNull()
    expect(res!.source).toBe('scenario')
  })
})

describe('update_hotel_reservation — malformed input (errors as data)', () => {
  it('rejects missing fields, bad types, unknown keys, bad ISO, calendar rollovers', async () => {
    for (const bad of [
      {},
      { reservation_id: 'HTL-R001' },
      { reservation_id: '', new_check_in: '2026-09-13T15:00:00-04:00' },
      { reservation_id: 'HTL-R001', new_check_in: 'not-a-date' },
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T15:00:00' }, // no offset
      { reservation_id: 'HTL-R001', new_check_in: '2026-02-30T15:00:00-04:00' }, // calendar
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-13T15:00:00-04:00', extra: 1 },
    ]) {
      const r = await updateHotelReservationTool.execute(bad as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })

  it('never throws — non-object input returns an error object', async () => {
    for (const bad of [null, 42, 'HTL-R001', []]) {
      const r = await updateHotelReservationTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})

describe('shiftDays (pure)', () => {
  it('adds whole days across month boundaries, keeping time and offset', () => {
    expect(shiftDays('2026-09-30T15:00:00-04:00', 2)).toBe('2026-10-02T15:00:00-04:00')
    expect(shiftDays('2026-09-12T23:30:00-05:00', 1)).toBe('2026-09-13T23:30:00-05:00')
    expect(shiftDays('2026-09-13T19:00:00Z', 2)).toBe('2026-09-15T19:00:00Z')
  })
})
