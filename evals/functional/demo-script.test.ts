/**
 * Pins the EXACT values promised by the human demo script in
 * agent-memory/current.md ("In-app-browser demo script — five tools").
 * If the dataset or filter logic drifts, the script's printed expectations
 * would silently go stale — this test makes that a verify.sh failure
 * instead. Expectations derived from src/data/flights.json (26 flights).
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { resetForTests, setClockForTests } from '../../src/state/store.ts'
import { searchFlightsTool } from '../../src/tools/search.ts'
import { updateConstraintsTool } from '../../src/tools/constraints.ts'
import { holdReservationTool } from '../../src/tools/hold.ts'
import { confirmBookingTool } from '../../src/tools/confirm.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

interface Row {
  id: string
  airline: string
  route: string
  departs: string
  arrives: string
  price_usd: number
}

describe('demo script — step (b): search_flights MIA, deadline, ≤4h layover', () => {
  it('returns 17 matches, cheapest FL-015 $299, capped at 8 rows', async () => {
    const r = await searchFlightsTool.execute(
      {
        destination: 'MIA',
        arrive_before: '2026-09-13T15:00:00-04:00',
        max_layover_hours: 4,
      },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(17)
    expect(r['showing']).toBe(8)
    expect(r['note']).toBe('Showing 8 of 17 — tighten filters to narrow.')
    const rows = r['results'] as Row[]
    expect(rows.map((x) => x.id)).toEqual([
      'FL-015', // $299 AV via SJO
      'FL-017', // $318 AM via MEX
      'FL-010', // $329 CM via PTY
      'FL-016', // $356 CM via PTY (65min)
      'FL-009', // $387 AV via BOG
      'FL-014', // $403 AA via MCO
      'FL-013', // $441 UA via IAH
      'FL-007', // $449 AA nonstop red-eye
    ])
    expect(rows[0]!.price_usd).toBe(299)
    expect(rows[0]!.airline).toBe('AV')
    expect(rows[0]!.route).toBe('LIM→MIA (1-stop)')
    expect(rows[0]!.departs).toBe('2026-09-12T11:20:00-05:00')
    expect(rows[0]!.arrives).toBe('2026-09-12T22:00:00-04:00')
  })
})

describe('demo script — step (c)+(e): hold FL-016 then confirm', () => {
  it('holds with a 15-minute TTL and books under ref RPLN-FL016', async () => {
    setClockForTests(() => Date.parse('2026-09-12T14:00:00Z'))
    const hold = await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    expect(hold['ok']).toBe(true)
    expect(hold['flight_id']).toBe('FL-016')
    expect(hold['ttl_minutes']).toBe(15)
    expect(hold['hold_expires_at']).toBe('2026-09-12T14:15:00.000Z')

    const confirm = await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    expect(confirm['ok']).toBe(true)
    expect(confirm['status']).toBe('confirmed')
    expect(confirm['confirmation_ref']).toBe('RPLN-FL016')
    expect(confirm['price_usd']).toBe(356)
    expect(confirm['cabin']).toBe('economy')
    const flight = confirm['flight'] as Record<string, unknown>
    expect(flight['route']).toBe('LIM→MIA (1-stop)')
  })
})

describe('demo script — step (d): update_constraints max_layover_hours=2', () => {
  it('visibly changes the set: 17→14 MIA-only→MIA+FLL, FL-015 drops, FLL tops the list', async () => {
    // The scenario constraint set (both airports, deadline, $650) merged with
    // the tightened 2h layover:
    const r = await updateConstraintsTool.execute({ max_layover_hours: 2 }, CALL)
    expect(r['ok']).toBe(true)
    const c = r['constraints'] as Record<string, unknown>
    expect(c['max_layover_hours']).toBe(2)
    expect(c['max_price_usd']).toBe(650) // persisted scenario default
    expect(c['destination_airports']).toEqual(['MIA', 'FLL'])
    expect(r['count']).toBe(14)
    expect(r['showing']).toBe(8)
    expect(r['note']).toBe('Showing 8 of 14 — tighten filters to narrow.')
    const rows = r['results'] as Row[]
    // Concrete before/after: FL-015 ($299, 220min layover via SJO) — the
    // step-(b) CHEAPEST — is gone; four FLL alternates now lead the list.
    expect(rows.some((x) => x.id === 'FL-015')).toBe(false)
    expect(rows.map((x) => x.id)).toEqual([
      'FL-021', // $198 NK nonstop → FLL
      'FL-022', // $221 NK nonstop → FLL
      'FL-023', // $267 B6 nonstop → FLL
      'FL-024', // $289 AV 1-stop (105min) → FLL
      'FL-010', // $329 CM via PTY (110min) → MIA
      'FL-016', // $356 CM via PTY (65min) → MIA
      'FL-009', // $387 AV via BOG (115min) → MIA
      'FL-014', // $403 AA via MCO (85min) → MIA
    ])
    expect(rows[0]!.price_usd).toBe(198)
    expect(rows[0]!.route).toBe('LIM→FLL (nonstop)')
  })
})
