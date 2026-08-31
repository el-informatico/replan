/**
 * Functional eval: the full human-in-the-loop rebooking narrative, executed
 * as a scripted agent conversation against the real tool code (the same
 * modules the deployed bundle ships). This is the Phase-1 "live smoke" for
 * TOOL 1 + TOOL 3 together — the dispatch's narrative payoff — runnable in
 * any environment (no browser needed), plus a regression sentinel: if the
 * narrative breaks, verify.sh fails.
 *
 * Scenario: AA 918 cancelled; traveler must reach MIA/FLL before the cruise
 * boarding deadline; budget ceiling tightens mid-conversation; traveler
 * prefers a red-eye; agent holds and books.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  getSnapshot,
  resetForTests,
  setClockForTests,
  subscribe,
} from '../../src/state/store.ts'
import { confirmBookingTool } from '../../src/tools/confirm.ts'
import { updateConstraintsTool } from '../../src/tools/constraints.ts'
import { holdReservationTool } from '../../src/tools/hold.ts'
import { searchFlightsTool } from '../../src/tools/search.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('rebooking narrative (functional eval)', () => {
  it('search → tighten constraints → prefer red-eye → hold → confirm', async () => {
    // Simulated "now": morning of the cancellation.
    setClockForTests(() => Date.parse('2026-09-12T14:00:00Z'))

    // 1. Agent searches Miami rebookings under the traveler's deadline.
    const search = await searchFlightsTool.execute(
      {
        destination: 'MIA',
        arrive_before: '2026-09-13T15:00:00-04:00',
        max_layover_hours: 4,
      },
      CALL,
    )
    expect(search['ok']).toBe(true)
    expect(search['count'] as number).toBeGreaterThan(0)
    const cheapest = (search['results'] as { id: string; price_usd: number }[])[0]!

    // 2. Traveler: "budget is tighter — $300 max". Agent updates constraints;
    //    the tool must RE-SEARCH and the store must reflect both changes.
    const uiUpdates: string[] = []
    const unsub = subscribe(() => uiUpdates.push('notified'))
    const updated = await updateConstraintsTool.execute({ max_price: 300 }, CALL)
    unsub()
    expect(updated['ok']).toBe(true)
    const constraints = updated['constraints'] as Record<string, unknown>
    expect(constraints['max_price_usd']).toBe(300)
    expect(constraints['max_layover_hours']).toBe(4) // persisted
    const updatedResults = updated['results'] as { price_usd: number; route: string }[]
    for (const r of updatedResults) expect(r.price_usd).toBeLessThanOrEqual(300)
    expect(updatedResults.length).toBeGreaterThan(0)
    expect(uiUpdates.length).toBeGreaterThan(0)
    expect(getSnapshot().lastSearch?.via).toBe('update_constraints')
    // The $300 ceiling must have cut the earlier cheapest MIA option if it
    // was over budget — the result set genuinely changed semantics.
    if (cheapest.price_usd > 300) {
      expect(updatedResults.some((r) => r.price_usd === cheapest.price_usd)).toBe(false)
    }

    // 3. Traveler: "I'd rather fly overnight." Agent sets a preferred time;
    //    ordering follows departure closeness, price no longer dominates.
    const redEye = await updateConstraintsTool.execute(
      { preferred_time: '2026-09-12T23:00:00-05:00' },
      CALL,
    )
    expect(redEye['ok']).toBe(true)
    const ordered = redEye['results'] as { departs: string }[]
    const target = Date.parse('2026-09-12T23:00:00-05:00')
    const dists = ordered.map((r) => Math.abs(Date.parse(r.departs) - target))
    expect([...dists].sort((a, b) => a - b)).toEqual(dists)

    // 4. Agent holds the best red-eye option (a cheap FLL alternate is fine
    //    under the merged multi-airport constraint set).
    const pick = ordered[0]!.departs
    const holdable = (redEye['results'] as { id: string; departs: string }[]).find(
      (r) => r.departs === pick,
    )!
    const hold = await holdReservationTool.execute({ flight_id: holdable.id }, CALL)
    expect(hold['ok']).toBe(true)
    expect(hold['hold_expires_at']).toBe('2026-09-12T14:15:00.000Z')

    // 5. Traveler confirms; page state switches to reservation-confirmed.
    const confirm = await confirmBookingTool.execute(
      { flight_id: holdable.id },
      CALL,
    )
    expect(confirm['ok']).toBe(true)
    expect(confirm['status']).toBe('confirmed')
    expect(getSnapshot().holds).toHaveLength(0)
    expect(getSnapshot().bookings).toHaveLength(1)
    expect(
      (getSnapshot().bookings[0]!.itinerary as Record<string, unknown>)[
        'confirmation_ref'
      ],
    ).toBe(confirm['confirmation_ref'])

    // 6. Re-confirm is idempotent — same reference, no double booking.
    const again = await confirmBookingTool.execute({ flight_id: holdable.id }, CALL)
    expect(again['confirmation_ref']).toBe(confirm['confirmation_ref'])
    expect(again['idempotent']).toBe(true)
    expect(getSnapshot().bookings).toHaveLength(1)
  })

  it('error-recovery loop: bad input → self-correcting retry (evals pattern)', async () => {
    setClockForTests(() => Date.parse('2026-09-12T14:00:00Z'))
    const bad = await searchFlightsTool.execute(
      { destination: 'Miami' },
      CALL,
    )
    expect(bad['ok']).toBe(false)
    expect(bad['code']).toBe('UNKNOWN_DESTINATION')
    expect(bad['error'] as string).toContain('MIA')

    const retry = await searchFlightsTool.execute({ destination: 'MIA' }, CALL)
    expect(retry['ok']).toBe(true)
    expect(retry['count'] as number).toBeGreaterThan(0)
  })

  it('expired hold mid-decision: HOLD_EXPIRED guides re-hold → confirm', async () => {
    let t = Date.parse('2026-09-12T14:00:00Z')
    setClockForTests(() => t)
    await holdReservationTool.execute({ flight_id: 'FL-003' }, CALL)

    t += 16 * 60_000 // traveler deliberated too long
    const failed = await confirmBookingTool.execute({ flight_id: 'FL-003' }, CALL)
    expect(failed['ok']).toBe(false)
    expect(failed['code']).toBe('HOLD_EXPIRED')

    await holdReservationTool.execute({ flight_id: 'FL-003' }, CALL)
    const confirmed = await confirmBookingTool.execute({ flight_id: 'FL-003' }, CALL)
    expect(confirmed['ok']).toBe(true)
    expect(confirmed['confirmation_ref']).toBe('RPLN-FL003')
  })
})
