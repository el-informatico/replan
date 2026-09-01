/**
 * Pins the EXACT values promised by the human demo script in
 * agent-memory/current.md ("In-app-browser demo script — five tools").
 * If the dataset or filter logic drifts, the script's printed expectations
 * would silently go stale — this test makes that a verify.sh failure
 * instead. Expectations derived from src/data/flights.json (26 flights).
 *
 * The "eleven-tool full narrative" describe pins the v2 script
 * (docs/demo/eleven-tool-demo-script.md) — the FULL 11-tool story with
 * the 5 confirmation gates the ChatGPT in-app browser inserts (observed
 * live in Phase 1). Its structure counts (32 turns / 11 tool calls /
 * 5 gates) are checked against the document itself, and every tool
 * output in the script is executed against the real modules.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it } from 'vitest'

import { resetForTests, setClockForTests } from '../../src/state/store.ts'
import { searchFlightsTool } from '../../src/tools/search.ts'
import { updateConstraintsTool } from '../../src/tools/constraints.ts'
import { holdReservationTool } from '../../src/tools/hold.ts'
import { confirmBookingTool } from '../../src/tools/confirm.ts'
import { searchHotelsTool } from '../../src/tools/hotels.ts'
import { updateHotelReservationTool } from '../../src/tools/hotel-reservation.ts'
import { bookGroundTransportTool } from '../../src/tools/transport.ts'
import { notifyContactTool } from '../../src/tools/notify.ts'
import { calculateTotalCostTool } from '../../src/tools/cost.ts'
import { generateItinerarySummaryTool } from '../../src/tools/summary.ts'
import { pingTool } from '../../src/tools/ping.ts'

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

describe('eleven-tool full narrative — script document structure', () => {
  const full = readFileSync(
    fileURLToPath(new URL('../../docs/demo/eleven-tool-demo-script.md', import.meta.url)),
    'utf8',
  )
  // Count only the scripted body — the header's Turn-key prose names the
  // markers when explaining them, which would double-count.
  const doc = full.slice(full.indexOf('\n---\n') + 1)

  it('has exactly 32 conversational turns: 16 human, 16 agent, numbered 1..32', () => {
    const humans = doc.match(/\*\*TURN \d+ — HUMAN/g) ?? []
    const agents = doc.match(/\*\*TURN \d+ — AGENT/g) ?? []
    expect(humans.length).toBe(16)
    expect(agents.length).toBe(16)
    const numbers = [...doc.matchAll(/\*\*TURN (\d+) —/g)].map((m) => Number(m[1]))
    expect(numbers).toEqual(Array.from({ length: 32 }, (_, i) => i + 1))
  })

  it('invokes each of the 11 tools exactly once', () => {
    const calls = doc.match(/\*\*Tool call:\*\*/g) ?? []
    expect(calls.length).toBe(11)
    // Every call in the script is written `tool( — prose mentions (e.g. the
    // gate list at the bottom) are followed by a space, not a paren.
    for (const tool of [
      'ping',
      'search_flights',
      'hold_reservation',
      'update_constraints',
      'confirm_booking',
      'search_hotels',
      'update_hotel_reservation',
      'book_ground_transport',
      'notify_contact',
      'calculate_total_cost',
      'generate_itinerary_summary',
    ]) {
      expect((doc.match(new RegExp('`' + tool + '\\(', 'g')) ?? []).length, tool).toBe(1)
    }
  })

  it('marks exactly the 5 gate-expected tools with a confirmation gate', () => {
    const gates = doc.match(/\[confirmation gate: human says yes\]/g) ?? []
    expect(gates.length).toBe(5)
    // A tool's gate (or its absence) is decided within its own agent turn.
    const turnBlocks = doc.split(/\*\*TURN \d+ —/)
    const blockFor = (tool: string) => turnBlocks.find((b) => b.includes('`' + tool + '(')) ?? ''
    for (const tool of ['hold_reservation', 'confirm_booking', 'update_hotel_reservation', 'book_ground_transport', 'notify_contact']) {
      expect(blockFor(tool), tool).toMatch(/confirmation gate/)
    }
    for (const ungated of ['ping', 'search_flights', 'update_constraints', 'search_hotels', 'calculate_total_cost', 'generate_itinerary_summary']) {
      expect(blockFor(ungated), `${ungated} must NOT be gated`).not.toMatch(/confirmation gate/)
    }
  })
})

describe('eleven-tool full narrative — the scripted sequence against real modules', () => {
  it('walks all 11 steps in script order with the pinned outputs', async () => {
    let t = Date.parse('2026-09-12T14:00:00Z')
    setClockForTests(() => t)
    const T = (n: number) => n // readability alias for turn comments

    // Turn 2 — ping (T1 ask).
    const ping = await pingTool.execute({ echo: 'ready' }, CALL)
    expect(ping['ok']).toBe(true)
    expect(ping['pong']).toBe(true)
    expect(ping['echo']).toBe('ready')

    // Turn 4 — search_flights (T3 ask).
    const search = await searchFlightsTool.execute(
      { destination: 'MIA', arrive_before: '2026-09-13T15:00:00-04:00', max_layover_hours: 4 },
      CALL,
    )
    expect(search['count']).toBe(17)
    expect((search['results'] as Row[])[0]!.id).toBe('FL-015')

    // Turn 6/8 — hold_reservation behind the first confirmation gate (T5/T7).
    const hold = await holdReservationTool.execute({ flight_id: 'FL-016' }, CALL)
    expect(hold['hold_expires_at']).toBe('2026-09-12T14:15:00.000Z')

    // Turn 10 — update_constraints (T9 ask).
    const updated = await updateConstraintsTool.execute({ max_layover_hours: 2 }, CALL)
    expect(updated['count']).toBe(14)
    expect((updated['results'] as Row[])[0]!.id).toBe('FL-021') // FLL leads

    // Turn 12/14 — confirm_booking behind the second gate (T11/T13).
    const confirm = await confirmBookingTool.execute({ flight_id: 'FL-016' }, CALL)
    expect(confirm['confirmation_ref']).toBe('RPLN-FL016')

    // Turn 16 — search_hotels (T15 ask): crunch night narrows Miami/MIA to 6.
    const hotels = await searchHotelsTool.execute(
      {
        city: 'Miami',
        near_airport: 'MIA',
        check_in: '2026-09-12T15:00:00-04:00',
        check_out: '2026-09-14T15:00:00-04:00',
      },
      CALL,
    )
    expect(hotels['count']).toBe(6)
    const hotelRows = hotels['results'] as { id: string; price_per_night_usd: number; nights: number; total_stay_usd: number }[]
    expect(hotelRows[0]!.id).toBe('HT-004')
    expect(hotelRows[0]!.price_per_night_usd).toBe(89)
    expect(hotelRows[0]!.total_stay_usd).toBe(178)

    // Turn 18/20 — update_hotel_reservation behind the third gate (T17/T19).
    t += 60_000
    const hotel = await updateHotelReservationTool.execute(
      { reservation_id: 'HTL-R001', new_check_in: '2026-09-12T20:00:00-04:00' },
      CALL,
    )
    expect(hotel['ok']).toBe(true)
    expect(hotel['check_in']).toBe('2026-09-12T20:00:00-04:00')
    expect(hotel['check_out']).toBe('2026-09-14T20:00:00-04:00')
    expect(hotel['total_usd']).toBe(296)

    // Turn 22/24 — book_ground_transport behind the fourth gate (T21/T23).
    t += 60_000
    const transport = await bookGroundTransportTool.execute(
      { type: 'shuttle', pickup_time: '2026-09-12T14:30:00-04:00' },
      CALL,
    )
    expect(transport['booking_ref']).toBe('RPLN-GT-SHUTTLE-MIA')
    expect(transport['price_usd']).toBe(12.62)
    expect(transport['est_travel_minutes']).toBe(45)
    expect(transport['est_dropoff_iso']).toBe('2026-09-12T19:15:00.000Z')

    // Turn 26/28 — notify_contact behind the fifth gate (T25/T27).
    t += 60_000
    const notify = await notifyContactTool.execute(
      {
        contact: { name: 'María', phone: '+51 987 654 321' },
        new_arrival_time: '2026-09-12T13:45:00-04:00',
      },
      CALL,
    )
    expect(notify['notification_id']).toBe('NTF-001')
    expect(notify['channel']).toBe('sms')
    expect(notify['simulated']).toBe(true)
    expect(notify['sent_at']).toBe('2026-09-12T14:03:00.000Z')

    // Turn 30 — calculate_total_cost (T29 ask): over the seeded $650.
    const cost = await calculateTotalCostTool.execute({}, CALL)
    expect(cost['total_usd']).toBe(664.62)
    expect(cost['budget']).toEqual({ max_price_usd: 650, within_budget: false, delta_usd: 14.62 })
    expect(cost['multiple_bookings_detected']).toBeUndefined() // one booking only

    // Turn 32 — generate_itinerary_summary (T31 ask): the receipt closes it.
    const summary = await generateItinerarySummaryTool.execute({}, CALL)
    expect(summary['status']).toBe('complete')
    expect(summary['missing']).toEqual([])
    const sNotifications = summary['notifications'] as Record<string, unknown>
    expect(sNotifications['count']).toBe(1)
    const sHotel = (summary['hotels'] as Record<string, unknown>[])[0]!
    expect(sHotel['updated']).toBe(true)
    expect(sHotel['stale_reason']).toBeNull()
    expect((summary['transport'] as Record<string, unknown>)['stale_reason']).toBeNull()
  })
})
