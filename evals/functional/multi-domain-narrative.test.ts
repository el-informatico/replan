/**
 * Multi-domain recovery narrative (functional eval) — the Phase 2 chain
 * the dispatch requires: search_hotels → hotel reservation flow →
 * book_ground_transport → calculate_total_cost → generate_itinerary_summary.
 *
 * Executed as a scripted agent conversation against the real tool code
 * (the same modules the deployed bundle ships) — runnable in any Node
 * environment, plus a regression sentinel: if the narrative breaks,
 * verify.sh fails. Mirrors evals/functional/rebooking-narrative.test.ts.
 *
 * The flight hold+confirm is a PRECONDITION step (not part of the
 * dispatched chain): book_ground_transport derives its route from the
 * confirmed flight, so the agent must have rebooked first — exactly the
 * story the demo tells.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { getSnapshot, resetForTests, setClockForTests } from '../../src/state/store.ts'
import { confirmBookingTool } from '../../src/tools/confirm.ts'
import { updateConstraintsTool } from '../../src/tools/constraints.ts'
import { holdReservationTool } from '../../src/tools/hold.ts'
import { updateHotelReservationTool } from '../../src/tools/hotel-reservation.ts'
import { searchHotelsTool } from '../../src/tools/hotels.ts'
import { notifyContactTool } from '../../src/tools/notify.ts'
import { calculateTotalCostTool } from '../../src/tools/cost.ts'
import { generateItinerarySummaryTool } from '../../src/tools/summary.ts'
import { bookGroundTransportTool } from '../../src/tools/transport.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('multi-domain narrative (functional eval)', () => {
  it('the full recovery: hotels → hotel dates → transport → total → receipt', async () => {
    let t = Date.parse('2026-09-12T14:00:00Z')
    setClockForTests(() => t)

    // 0. Precondition — the agent has already rebooked: FL-016 (arrives
    //    MIA 2026-09-12T13:45:00-04:00, $356) is held and confirmed.
    await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    const confirmed = await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    expect(confirmed['ok']).toBe(true)
    expect(confirmed['confirmation_ref']).toBe('RPLN-FL016')

    // 1. Agent searches hotels for the recovery stay (scenario window).
    const hotels = await searchHotelsTool.execute(
      {
        city: 'Miami',
        near_airport: 'MIA',
        check_in: '2026-09-12T15:00:00-04:00',
        check_out: '2026-09-14T15:00:00-04:00',
      },
      CALL,
    )
    expect(hotels['ok']).toBe(true)
    expect(hotels['count'] as number).toBeGreaterThan(0)
    const rows = hotels['results'] as {
      id: string
      price_per_night_usd: number
      total_stay_usd: number
    }[]
    const prices = rows.map((x) => x.price_per_night_usd)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices) // cheapest first
    expect(rows.some((x) => x.id === 'HT-003')).toBe(false) // sold out 09-12

    // 2. The trip already HAS a hotel (seeded, D008): the agent shifts its
    //    check-in to match the new flight. A too-early date is corrected.
    const tooEarly = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-11T15:00:00-04:00' },
      CALL,
    )
    expect(tooEarly['ok']).toBe(false)
    expect(tooEarly['code']).toBe('CHECK_IN_BEFORE_ARRIVAL')

    t += 60_000
    const shifted = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-12T20:00:00-04:00' },
      CALL,
    )
    expect(shifted['ok']).toBe(true)
    expect(shifted['check_in']).toBe('2026-09-12T20:00:00-04:00')
    expect(shifted['check_out']).toBe('2026-09-14T20:00:00-04:00')
    expect(shifted['total_usd']).toBe(296)

    // 3. Ground transport: pickup ~20 min after landing. The agent first
    //    books a taxi, then corrects to the cheaper shuttle (replace flow).
    t += 60_000
    const taxi = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    expect(taxi['ok']).toBe(true)
    expect(taxi['price_usd']).toBe(27.7)

    t += 60_000
    const shuttle = await bookGroundTransportTool.execute(
      { type: 'shuttle', pickup_time: '2026-09-12T14:30:00-04:00' },
      CALL,
    )
    expect(shuttle['ok']).toBe(true)
    expect(shuttle['replaced_previous']).toBe('RPLN-GT-TAXI-MIA')
    expect(shuttle['price_usd']).toBe(12.62)
    expect(shuttle['booking_ref']).toBe('RPLN-GT-SHUTTLE-MIA')

    // 4. Notify the person meeting the traveler (simulated).
    t += 60_000
    const notified = await notifyContactTool.execute(
      {
        contact: { name: 'María', phone: '+51 987 654 321', relationship: 'sister' },
        new_arrival_time: '2026-09-12T13:45:00-04:00',
      },
      CALL,
    )
    expect(notified['ok']).toBe(true)
    expect(notified['simulated']).toBe(true)

    // 5. Running total — over the seeded $650 budget...
    const overBudget = await calculateTotalCostTool.execute({}, CALL)
    expect(overBudget['ok']).toBe(true)
    expect(overBudget['total_usd']).toBe(664.62) // 356 + 296 + 12.62
    const over = overBudget['budget'] as Record<string, unknown>
    expect(over['max_price_usd']).toBe(650)
    expect(over['within_budget']).toBe(false)
    expect(over['delta_usd']).toBe(14.62)

    //    ...the traveler raises the ceiling via update_constraints, and the
    //    SAME total re-reads against the NEW stored budget (T9 AC3).
    t += 60_000
    const raised = await updateConstraintsTool.execute({ max_price: 700 }, CALL)
    expect(raised['ok']).toBe(true)
    const nowWithin = await calculateTotalCostTool.execute({}, CALL)
    const within = nowWithin['budget'] as Record<string, unknown>
    expect(within['max_price_usd']).toBe(700)
    expect(within['within_budget']).toBe(true)
    expect(within['delta_usd']).toBe(-35.38) // 664.62 − 700

    // 6. The final receipt: complete, nothing missing.
    const receipt = await generateItinerarySummaryTool.execute({}, CALL)
    expect(receipt['ok']).toBe(true)
    expect(receipt['status']).toBe('complete')
    expect(receipt['missing']).toEqual([])
    const flight = receipt['flight'] as Record<string, unknown>
    expect(flight['confirmation_ref']).toBe('RPLN-FL016')
    const hotel = (receipt['hotels'] as Record<string, unknown>[])[0]!
    expect(hotel['check_in']).toBe('2026-09-12T20:00:00-04:00')
    expect(hotel['updated']).toBe(true)
    const transport = receipt['transport'] as Record<string, unknown>
    expect(transport['booking_ref']).toBe('RPLN-GT-SHUTTLE-MIA')
    const notifications = receipt['notifications'] as Record<string, unknown>
    expect(notifications['count']).toBe(1)
    const cost = receipt['cost'] as Record<string, unknown>
    expect(cost['total_usd']).toBe(664.62)

    // Store end-state: one booking, one reservation (shifted), one ground
    // leg (the shuttle replaced the taxi), one notification.
    const snap = getSnapshot()
    expect(snap.bookings).toHaveLength(1)
    expect(snap.hotelReservations).toHaveLength(1)
    expect(snap.hotelReservations[0]!.updatedAtIso).not.toBeNull()
    expect(snap.transportBooking!.type).toBe('shuttle')
    expect(snap.notifications).toHaveLength(1)
  })

  it('error-recovery loop: bad city → corrected retry (errors as data)', async () => {
    const bad = await searchHotelsTool.execute({ city: 'Miami Beach' }, CALL)
    expect(bad['ok']).toBe(false)
    expect(bad['code']).toBe('UNKNOWN_CITY')
    expect(bad['error'] as string).toContain('Miami')

    const retry = await searchHotelsTool.execute({ city: 'Miami' }, CALL)
    expect(retry['ok']).toBe(true)
    expect(retry['count'] as number).toBeGreaterThan(0)
  })

  it('transport before any flight: refused with a pointer, then the flow completes', async () => {
    const premature = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    expect(premature['ok']).toBe(false)
    expect(premature['code']).toBe('NO_CONFIRMED_FLIGHT')

    let t = Date.parse('2026-09-12T14:00:00Z')
    setClockForTests(() => t)
    await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    const after = await bookGroundTransportTool.execute(
      { type: 'taxi', pickup_time: '2026-09-12T14:05:00-04:00' },
      CALL,
    )
    expect(after['ok']).toBe(true)
  })
})
