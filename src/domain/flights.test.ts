import { describe, expect, it } from 'vitest'

import { loadDataset, validateDataset } from './flights.ts'

const data = loadDataset()

describe('flight dataset invariants', () => {
  it('passes validateDataset with zero violations', () => {
    const violations = validateDataset(data)
    expect(violations).toEqual([])
  })

  it('has 20–30 flights with unique ids', () => {
    expect(data.flights.length).toBeGreaterThanOrEqual(20)
    expect(data.flights.length).toBeLessThanOrEqual(30)
    expect(new Set(data.flights.map((f) => f.id)).size).toBe(data.flights.length)
  })

  it('covers both destination airports (MIA majority, FLL alternates)', () => {
    const dests = new Set(data.flights.map((f) => f.destination.code))
    expect(dests).toEqual(new Set(['MIA', 'FLL']))
    const mia = data.flights.filter((f) => f.destination.code === 'MIA').length
    expect(mia).toBeGreaterThan(data.flights.length - mia)
  })

  it('spans nonstop / one-stop / two-stop itineraries', () => {
    const stops = new Set(data.flights.map((f) => f.stops))
    expect(stops).toEqual(new Set([0, 1, 2]))
  })
})

describe('filter-field discriminating power (scenario constraints)', () => {
  const c = data.scenario.constraints_hint
  const deadline = Date.parse(c.must_arrive_by_iso)

  it('has flights arriving before AND after the arrival deadline', () => {
    const before = data.flights.filter((f) => Date.parse(f.arrive_iso) <= deadline)
    const after = data.flights.filter((f) => Date.parse(f.arrive_iso) > deadline)
    expect(before.length).toBeGreaterThan(0)
    expect(after.length).toBeGreaterThan(0)
  })

  it('has flights under AND over the max price', () => {
    const under = data.flights.filter((f) => f.price_usd <= c.max_price_usd)
    const over = data.flights.filter((f) => f.price_usd > c.max_price_usd)
    expect(under.length).toBeGreaterThan(0)
    expect(over.length).toBeGreaterThan(0)
  })

  it('has layovers under AND over the max layover hours', () => {
    const maxMin = c.max_layover_hours * 60
    const under = data.flights.filter((f) => f.total_layover_minutes <= maxMin)
    const over = data.flights.filter((f) => f.total_layover_minutes > maxMin)
    expect(under.length).toBeGreaterThan(0)
    expect(over.length).toBeGreaterThan(0)
  })

  it('has at least one flight satisfying ALL scenario constraints at once', () => {
    const maxMin = c.max_layover_hours * 60
    const ok = data.flights.filter(
      (f) =>
        c.destination_airports.includes(f.destination.code) &&
        Date.parse(f.arrive_iso) <= deadline &&
        f.price_usd <= c.max_price_usd &&
        f.total_layover_minutes <= maxMin,
    )
    expect(ok.length).toBeGreaterThan(0)
  })
})
