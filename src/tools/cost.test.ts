import { beforeEach, describe, expect, it } from 'vitest'

import { getSnapshot, resetForTests, setClockForTests, subscribe } from '../state/store.ts'
import { confirmBookingTool } from './confirm.ts'
import { updateConstraintsTool } from './constraints.ts'
import { holdReservationTool } from './hold.ts'
import { calculateTotalCostTool } from './cost.ts'
import { bookGroundTransportTool } from './transport.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

async function confirmFlight(flightId: string) {
  await holdReservationTool.execute({ flight_id: flightId }, CALL)
  return confirmBookingTool.execute({ flight_id: flightId }, CALL)
}

describe('calculate_total_cost — happy path', () => {
  it('fresh state with no items arg: valid, hotel-only (D008 seeds the reservation)', async () => {
    const r = await calculateTotalCostTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    expect(r['total_usd']).toBe(296)
    expect(r['budget']).toEqual({ max_price_usd: 650, within_budget: true, delta_usd: -354 })
  })

  it('explicit empty subset items:[] is valid and totals 0', async () => {
    const r = await calculateTotalCostTool.execute({ items: [] }, CALL)
    expect(r['ok']).toBe(true)
    expect(r['items']).toEqual([])
    expect(r['total_usd']).toBe(0)
    expect(r['budget']).toEqual({ max_price_usd: 650, within_budget: true, delta_usd: -650 })
  })

  it('seeded state alone: the hotel reservation is the only item', async () => {
    const r = await calculateTotalCostTool.execute({}, CALL)
    // resetForTests re-seeds HTL-R001, so the hotel IS booked on a fresh reset.
    expect(r['items']).toEqual([
      { kind: 'hotel', id: 'HTL-R001', description: 'Bayside Inn Downtown, 2 nights', cost_usd: 296 },
    ])
    expect(r['total_usd']).toBe(296)
  })

  it('full chain: flight + hotel + transport, over-budget flagged', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await confirmFlight('FL-016') // $356, arrives MIA 13:45-04:00
    t += 60_000
    await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )

    const r = await calculateTotalCostTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    expect(r['items']).toEqual([
      { kind: 'flight', id: 'FL-016', description: 'LIM→MIA (1-stop)', cost_usd: 356 },
      { kind: 'hotel', id: 'HTL-R001', description: 'Bayside Inn Downtown, 2 nights', cost_usd: 296 },
      { kind: 'transport', id: 'RPLN-GT-TAXI-MIA', description: 'taxi MIA→downtown-miami', cost_usd: 27.7 },
    ])
    expect(r['total_usd']).toBe(679.7)
    expect(r['budget']).toEqual({ max_price_usd: 650, within_budget: false, delta_usd: 29.7 })
    // Full chain is the widest output this tool produces (reviewer
    // finding 7) — assert the 1.5K budget where the fixture lives.
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(1500)
  })

  it('subset totals via items', async () => {
    await confirmFlight('FL-016')
    const flightOnly = await calculateTotalCostTool.execute({ items: ['flight'] }, CALL)
    expect(flightOnly['total_usd']).toBe(356)
    const hotelOnly = await calculateTotalCostTool.execute({ items: ['hotel'] }, CALL)
    expect(hotelOnly['total_usd']).toBe(296)
    const pair = await calculateTotalCostTool.execute({ items: ['flight', 'hotel'] }, CALL)
    expect(pair['total_usd']).toBe(652)
  })
})

describe('calculate_total_cost — state-dependent edges', () => {
  it('budget boundary is exact: equality fits, one cent over does not', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await confirmFlight('FL-016') // 356
    t += 60_000
    await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    // total = 679.7 (356 + 296 + 27.7)

    t += 60_000
    const atMax = await updateConstraintsTool.execute({ max_price: 679.7 }, CALL)
    expect(atMax['ok']).toBe(true)
    const equal = await calculateTotalCostTool.execute({}, CALL)
    expect(equal['budget']).toEqual({ max_price_usd: 679.7, within_budget: true, delta_usd: 0 })

    t += 60_000
    await updateConstraintsTool.execute({ max_price: 679.69 }, CALL)
    const over = await calculateTotalCostTool.execute({}, CALL)
    const overBudget = over['budget'] as { within_budget: boolean; delta_usd: number }
    expect(overBudget.within_budget).toBe(false)
    expect(overBudget.delta_usd).toBe(0.01)
  })

  it('uses the LATEST of two bookings', async () => {
    let t = Date.parse('2026-09-12T12:00:00Z')
    setClockForTests(() => t)
    await confirmFlight('FL-001')
    t += 3_600_000
    await confirmFlight('FL-002') // later confirmedAt
    const r = await calculateTotalCostTool.execute({ items: ['flight'] }, CALL)
    expect(r['items']).toEqual([
      expect.objectContaining({ id: 'FL-002' }),
    ])
  })

  it('explicitly requested but unbooked kind → NOT_BOOKED pointing at the booking tool', async () => {
    const r = await calculateTotalCostTool.execute({ items: ['transport'] }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('NOT_BOOKED')
    expect(r['error'] as string).toContain('book_ground_transport')

    const noFlight = await calculateTotalCostTool.execute({ items: ['flight'] }, CALL)
    expect(noFlight['code']).toBe('NOT_BOOKED')
    expect(noFlight['error'] as string).toContain('confirm_booking')
  })

  it('is read-only: no subscriber notification, snapshot unchanged', async () => {
    await confirmFlight('FL-016')
    const before = JSON.stringify(getSnapshot())
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await calculateTotalCostTool.execute({}, CALL)
    unsub()
    expect(notified).toBe(0)
    expect(JSON.stringify(getSnapshot())).toBe(before)
  })
})

describe('calculate_total_cost — malformed input (errors as data)', () => {
  it('rejects non-array items, unknown kinds, duplicates, unknown keys', async () => {
    for (const bad of [
      { items: 42 },
      { items: 'flight' },
      { items: ['flight', 'x'] },
      { items: ['flight', 'flight'] },
      { extra: 1 },
    ]) {
      const r = await calculateTotalCostTool.execute(bad as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(r['code']).toBe('INVALID_INPUT')
      expect(typeof r['error']).toBe('string')
    }
  })

  it('treats null items as the default (all booked items)', async () => {
    const r = await calculateTotalCostTool.execute({ items: null }, CALL)
    expect(r['ok']).toBe(true)
  })

  it('never throws — non-object input returns an error object', async () => {
    for (const bad of [null, 42, 'x', []]) {
      const r = await calculateTotalCostTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})
