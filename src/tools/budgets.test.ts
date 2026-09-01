import { beforeEach, describe, expect, it } from 'vitest'

import { resetForTests } from '../state/store.ts'
import { confirmBookingTool } from './confirm.ts'
import { calculateTotalCostTool } from './cost.ts'
import { updateConstraintsTool } from './constraints.ts'
import { holdReservationTool } from './hold.ts'
import { updateHotelReservationTool } from './hotel-reservation.ts'
import { searchHotelsTool } from './hotels.ts'
import { notifyContactTool } from './notify.ts'
import { pingTool } from './ping.ts'
import { searchFlightsTool } from './search.ts'
import { generateItinerarySummaryTool } from './summary.ts'
import { bookGroundTransportTool } from './transport.ts'

/**
 * Computational enforcement of the authoring budgets from the research brief
 * (docs/research/webmcp-tool-authoring-brief.md): ≤500 chars per tool
 * description, ≤150 per parameter description, names within the spec charset
 * and the secure-tools advisory length. A regression here fails verify.sh.
 *
 * Phase 2 rule (plan §2): every new tool lands here in its own increment,
 * and every list-shaped output joins the ≤1.5K assertion below.
 */

const TOOLS = [
  pingTool,
  searchFlightsTool,
  holdReservationTool,
  updateConstraintsTool,
  confirmBookingTool,
  searchHotelsTool,
  updateHotelReservationTool,
  bookGroundTransportTool,
  notifyContactTool,
  calculateTotalCostTool,
  generateItinerarySummaryTool,
]

// Reviewer finding 9: this file executes state-mutating tools, so the
// output-budget assertions must not depend on execution order — reset
// between tests to keep every "(fresh state)" label true.
beforeEach(() => {
  resetForTests()
})

describe('tool authoring budgets', () => {
  it('every tool description is non-empty and ≤500 chars', () => {
    for (const t of TOOLS) {
      expect(t.description.length, t.name).toBeGreaterThan(0)
      expect(t.description.length, `${t.name}: ${t.description.length} chars`).toBeLessThanOrEqual(500)
    }
  })

  it('every parameter description is non-empty and ≤150 chars', () => {
    for (const t of TOOLS) {
      const props = (t.inputSchema['properties'] ?? {}) as Record<
        string,
        { description?: string }
      >
      for (const [key, p] of Object.entries(props)) {
        expect(p.description, `${t.name}.${key}`).toBeDefined()
        expect(
          p.description!.length,
          `${t.name}.${key}: ${p.description!.length} chars`,
        ).toBeLessThanOrEqual(150)
      }
    }
  })

  it('tool names fit the spec charset and advisory length', () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[A-Za-z0-9_.-]{1,30}$/)
    }
  })

  it('tool names are unique across the page', () => {
    const names = TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('search_flights and update_constraints outputs fit the 1.5K budget', async () => {
    const call = { signal: new AbortController().signal }
    const search = await searchFlightsTool.execute({ destination: 'MIA' }, call)
    expect(
      JSON.stringify(search).length,
      `search_flights output: ${JSON.stringify(search).length} chars`,
    ).toBeLessThanOrEqual(1500)
    const updated = await updateConstraintsTool.execute({}, call)
    expect(
      JSON.stringify(updated).length,
      `update_constraints output: ${JSON.stringify(updated).length} chars`,
    ).toBeLessThanOrEqual(1500)
  })

  it('search_hotels output fits the 1.5K budget (post-crunch window is the widest case — 8 windowed rows)', async () => {
    const call = { signal: new AbortController().signal }
    // After the 09-12 sold-out crunch: 11 matches, 8 shown, every row
    // carrying nights + total_stay_usd — the payload the reviewer measured
    // at 1555 chars before the projection trim.
    const widest = await searchHotelsTool.execute(
      {
        city: 'Miami',
        check_in: '2026-09-14T15:00:00-04:00',
        check_out: '2026-09-16T15:00:00-04:00',
      },
      call,
    )
    expect(widest['showing']).toBe(8)
    expect(widest['count']).toBe(11)
    expect(
      JSON.stringify(widest).length,
      `search_hotels output: ${JSON.stringify(widest).length} chars`,
    ).toBeLessThanOrEqual(1500)
  })

  it('notify_contact output fits the 1.5K budget', async () => {
    const call = { signal: new AbortController().signal }
    const notify = await notifyContactTool.execute(
      {
        contact: { name: 'María', phone: '+51 987 654 321', relationship: 'sister' },
        new_arrival_time: '2026-09-13T06:05:00-04:00',
      },
      call,
    )
    expect(
      JSON.stringify(notify).length,
      `notify_contact output: ${JSON.stringify(notify).length} chars`,
    ).toBeLessThanOrEqual(1500)
  })

  it('calculate_total_cost output fits the 1.5K budget (fresh state)', async () => {
    const call = { signal: new AbortController().signal }
    const cost = await calculateTotalCostTool.execute({}, call)
    expect(
      JSON.stringify(cost).length,
      `calculate_total_cost output: ${JSON.stringify(cost).length} chars`,
    ).toBeLessThanOrEqual(1500)
  })

  it('generate_itinerary_summary output fits the 1.5K budget (fresh state; the complete-chain case is asserted in summary.test.ts)', async () => {
    const call = { signal: new AbortController().signal }
    const summary = await generateItinerarySummaryTool.execute({}, call)
    expect(
      JSON.stringify(summary).length,
      `generate_itinerary_summary output: ${JSON.stringify(summary).length} chars`,
    ).toBeLessThanOrEqual(1500)
  })
})
