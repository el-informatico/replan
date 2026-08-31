import { beforeEach, describe, expect, it } from 'vitest'

import { loadDataset } from '../domain/flights.ts'
import {
  getSnapshot,
  resetForTests,
  setConstraints,
  subscribe,
  type Constraints,
} from '../state/store.ts'
import { updateConstraintsTool } from './constraints.ts'

const hint = loadDataset().scenario.constraints_hint
const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('update_constraints — seeding and merge', () => {
  it('active constraints start seeded from scenario.constraints_hint', () => {
    const c = getSnapshot().constraints
    expect(c.destinationAirports).toEqual(hint.destination_airports)
    expect(c.arriveBefore).toBe(hint.must_arrive_by_iso)
    expect(c.maxPriceUsd).toBe(hint.max_price_usd)
    expect(c.maxLayoverHours).toBe(hint.max_layover_hours)
    expect(c.preferredTime).toBeNull()
  })

  it('a one-key update leaves the other constraints intact', async () => {
    const before = getSnapshot().constraints
    const r = await updateConstraintsTool.execute({ max_price: 300 }, CALL)
    expect(r['ok']).toBe(true)
    const returned = r['constraints'] as Record<string, unknown>
    expect(returned['max_price_usd']).toBe(300)
    expect(returned['max_layover_hours']).toBe(before.maxLayoverHours)
    expect(returned['arrive_before']).toBe(before.arriveBefore)
    expect(returned['destination_airports']).toEqual(before.destinationAirports)
    expect(getSnapshot().constraints.maxPriceUsd).toBe(300)
  })

  it('multi-key update merges all provided keys at once', async () => {
    const r = await updateConstraintsTool.execute(
      { max_price: 500, max_layover_hours: 2 },
      CALL,
    )
    const c = r['constraints'] as Record<string, unknown>
    expect(c['max_price_usd']).toBe(500)
    expect(c['max_layover_hours']).toBe(2)
  })

  it('empty object re-runs the search with unchanged constraints', async () => {
    const r = await updateConstraintsTool.execute({}, CALL)
    expect(r['ok']).toBe(true)
    expect(getSnapshot().constraints.maxPriceUsd).toBe(hint.max_price_usd)
    expect(r['count'] as number).toBeGreaterThan(0)
  })
})

describe('update_constraints — merged re-search (the narrative payoff)', () => {
  it('tightening max_price re-filters across BOTH airports', async () => {
    const r = await updateConstraintsTool.execute({ max_price: 300 }, CALL)
    expect(r['ok']).toBe(true)
    const results = r['results'] as { price_usd: number; route: string }[]
    for (const x of results) expect(x.price_usd).toBeLessThanOrEqual(300)
    const airports = new Set(results.map((x) => x.route.split('→')[1]!.slice(0, 3)))
    expect(airports).toEqual(new Set(['MIA', 'FLL']))
  })

  it('results respect the seeded arrival deadline', async () => {
    const r = await updateConstraintsTool.execute({}, CALL)
    const results = r['results'] as { arrives: string }[]
    const cutoff = Date.parse(hint.must_arrive_by_iso)
    for (const x of results) {
      expect(Date.parse(x.arrives)).toBeLessThanOrEqual(cutoff)
    }
  })

  it('preferred_time reorders by closest departure over lowest price', async () => {
    const r = await updateConstraintsTool.execute(
      { preferred_time: '2026-09-13T01:00:00-05:00' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    const results = r['results'] as { departs: string }[]
    // The real contract: results are non-decreasing in distance from the
    // preferred departure instant (price must not dominate the order).
    const target = Date.parse('2026-09-13T01:00:00-05:00')
    const dists = results.map((x) => Math.abs(Date.parse(x.departs) - target))
    expect([...dists].sort((a, b) => a - b)).toEqual(dists)
    expect(getSnapshot().constraints.preferredTime).toBe('2026-09-13T01:00:00-05:00')
  })

  it('lastSearch records via=update_constraints and notifies subscribers', async () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await updateConstraintsTool.execute({ max_layover_hours: 3 }, CALL)
    unsub()
    const snap = getSnapshot()
    expect(snap.lastSearch?.via).toBe('update_constraints')
    expect(snap.constraints.maxLayoverHours).toBe(3)
    expect(notified).toBeGreaterThan(0)
  })
})

describe('update_constraints — malformed input', () => {
  it('rejects unknown fields, listing accepted keys', async () => {
    const r = await updateConstraintsTool.execute({ destination: 'MIA' }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('destination')
    expect(r['error'] as string).toContain('preferred_time')
  })

  it('rejects invalid values per field', async () => {
    for (const bad of [
      { max_price: -1 },
      { max_price: 'cheap' },
      { max_layover_hours: -2 },
      { preferred_time: 'tomorrow morning' },
    ]) {
      const r = await updateConstraintsTool.execute(bad, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })

  it('never throws for non-object input', async () => {
    for (const bad of [null, 7, 'x', []]) {
      const r = await updateConstraintsTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
    }
  })
})

describe('update_constraints — store interplay', () => {
  it('a direct setConstraints change is visible to the next update', async () => {
    const custom: Constraints = {
      ...getSnapshot().constraints,
      maxPriceUsd: 250,
    }
    setConstraints(custom)
    const r = await updateConstraintsTool.execute({ max_layover_hours: 1 }, CALL)
    const c = r['constraints'] as Record<string, unknown>
    expect(c['max_price_usd']).toBe(250) // persisted, untouched by this update
    expect(c['max_layover_hours']).toBe(1)
  })
})
