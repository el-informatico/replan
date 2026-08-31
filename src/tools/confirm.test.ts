import { beforeEach, describe, expect, it } from 'vitest'

import {
  getSnapshot,
  latestBooking,
  resetForTests,
  setClockForTests,
  subscribe,
} from '../state/store.ts'
import { confirmBookingTool } from './confirm.ts'
import { holdReservationTool } from './hold.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('confirm_booking — requires an active hold', () => {
  it('rejects with NO_ACTIVE_HOLD and points at hold_reservation', async () => {
    const r = await confirmBookingTool.execute({ flight_id: 'FL-001' }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('NO_ACTIVE_HOLD')
    expect(r['error'] as string).toContain('hold_reservation')
    expect(getSnapshot().bookings).toHaveLength(0)
  })

  it('rejects with HOLD_EXPIRED and the expiry instant after the hold lapses', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    t += 16 * 60_000
    const r = await confirmBookingTool.execute({ flight_id: 'FL-001' }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('HOLD_EXPIRED')
    expect(r['error'] as string).toContain('2026-09-12T12:15:00.000Z')
  })

  it('rejects an unknown flight_id with NOT_FOUND', async () => {
    const r = await confirmBookingTool.execute({ flight_id: 'ZZZ-1' }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('NOT_FOUND')
  })
})

describe('confirm_booking — happy path', () => {
  it('books a held flight with a deterministic reference and full itinerary', async () => {
    setClockForTests(() => Date.parse('2026-09-12T12:00:00Z'))
    await holdReservationTool.execute({ flight_id: 'FL-009' }, CALL)
    const r = await confirmBookingTool.execute({ flight_id: 'FL-009' }, CALL)
    expect(r['ok']).toBe(true)
    expect(r['status']).toBe('confirmed')
    expect(r['confirmation_ref']).toBe('RPLN-FL009')
    expect(r['confirmed_at']).toBe('2026-09-12T12:00:00.000Z')
    const flight = r['flight'] as Record<string, unknown>
    expect(flight['id']).toBe('FL-009')
    expect(flight['route']).toBe('LIM→MIA (1-stop)')
    expect(Array.isArray(flight['segments'])).toBe(true)
    expect(r['price_usd']).toBe(387)
    // Hold consumed, booking recorded and latest
    expect(getSnapshot().holds).toHaveLength(0)
    expect(latestBooking()?.flightId).toBe('FL-009')
  })

  it('notifies subscribers (UI switches to confirmed view)', async () => {
    setClockForTests(() => Date.parse('2026-09-12T12:00:00Z'))
    await holdReservationTool.execute({ flight_id: 'FL-003' }, CALL)
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await confirmBookingTool.execute({ flight_id: 'FL-003' }, CALL)
    unsub()
    expect(notified).toBeGreaterThan(0)
  })
})

describe('confirm_booking — idempotency', () => {
  it('re-confirming returns the SAME confirmation, no duplicate booking', async () => {
    setClockForTests(() => Date.parse('2026-09-12T12:00:00Z'))
    await holdReservationTool.execute({ flight_id: 'FL-005' }, CALL)
    const first = await confirmBookingTool.execute({ flight_id: 'FL-005' }, CALL)
    expect(first['ok']).toBe(true)
    expect(first['idempotent']).toBeUndefined()

    const second = await confirmBookingTool.execute({ flight_id: 'FL-005' }, CALL)
    expect(second['ok']).toBe(true)
    expect(second['confirmation_ref']).toBe(first['confirmation_ref'])
    expect(second['confirmed_at']).toBe(first['confirmed_at'])
    expect(second['idempotent']).toBe(true)
    expect(getSnapshot().bookings).toHaveLength(1)
  })

  it('re-holding an ALREADY-BOOKED flight then confirming consumes the stray hold (reviewer finding 1)', async () => {
    setClockForTests(() => Date.parse('2026-09-12T12:00:00Z'))
    await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    await confirmBookingTool.execute({ flight_id: 'FL-001' }, CALL)
    // Agent/user re-holds the same flight after booking:
    const reHold = await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    expect(reHold['ok']).toBe(true)
    // Idempotent confirm must consume that hold — no "confirmed AND held" UI.
    const again = await confirmBookingTool.execute({ flight_id: 'FL-001' }, CALL)
    expect(again['idempotent']).toBe(true)
    expect(again['confirmation_ref']).toBe('RPLN-FL001')
    expect(getSnapshot().holds).toHaveLength(0)
    expect(getSnapshot().bookings).toHaveLength(1)
  })

  it('a different flight can still be booked afterwards (rebooking narrative)', async () => {
    setClockForTests(() => Date.parse('2026-09-12T12:00:00Z'))
    await holdReservationTool.execute({ flight_id: 'FL-001' }, CALL)
    await confirmBookingTool.execute({ flight_id: 'FL-001' }, CALL)
    await holdReservationTool.execute({ flight_id: 'FL-021' }, CALL)
    const second = await confirmBookingTool.execute({ flight_id: 'FL-021' }, CALL)
    expect(second['ok']).toBe(true)
    expect(getSnapshot().bookings).toHaveLength(2)
    expect(latestBooking()?.flightId).toBe('FL-021')
  })
})

describe('confirm_booking — malformed input', () => {
  it('rejects missing/empty/wrong-typed flight_id with INVALID_INPUT', async () => {
    for (const bad of [{}, { flight_id: '' }, { flight_id: 9 }]) {
      const r = await confirmBookingTool.execute(bad as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(r['code']).toBe('INVALID_INPUT')
    }
  })

  it('never throws for non-object input', async () => {
    for (const bad of [null, 3, 'FL-001']) {
      const r = await confirmBookingTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})
