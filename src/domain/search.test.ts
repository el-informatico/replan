import { describe, expect, it } from 'vitest'

import { loadDataset, type Flight } from './flights.ts'
import { searchFlights, toSummary } from './search.ts'

const data = loadDataset()
const flights = data.flights
const hint = data.scenario.constraints_hint

/** Minimal synthetic Flight factory for sort-order tests (pure logic). */
function fakeFlight(p: Partial<Flight> & { id: string }): Flight {
  return {
    origin: { code: 'LIM', city: 'Lima', tz: 'America/Lima' },
    destination: { code: 'MIA', city: 'Miami', tz: 'America/New_York' },
    depart_iso: '2026-09-12T10:00:00-05:00',
    arrive_iso: '2026-09-12T17:00:00-04:00',
    duration_minutes: 350,
    stops: 0,
    segments: [],
    layovers: [],
    total_layover_minutes: 0,
    price_usd: 500,
    currency: 'USD',
    cabin: 'economy',
    seats_left: 9,
    refundable: false,
    baggage_included: true,
    tags: ['nonstop'],
    ...p,
  }
}

describe('searchFlights — filtering', () => {
  it('filters by destination (dataset totals: 20 MIA / 6 FLL)', () => {
    expect(searchFlights(flights, { destination: 'MIA' })).toHaveLength(20)
    expect(searchFlights(flights, { destination: 'FLL' })).toHaveLength(6)
  })

  it('arrive_before keeps only flights arriving at or before the instant', () => {
    const results = searchFlights(flights, {
      destination: 'MIA',
      arriveBefore: hint.must_arrive_by_iso,
    })
    const cutoff = Date.parse(hint.must_arrive_by_iso)
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(Date.parse(r.arrive_iso)).toBeLessThanOrEqual(cutoff)
    }
    // FL-005 arrives 14:15 same day — inside the deadline
    expect(results.some((r) => r.id === 'FL-005')).toBe(true)
  })

  it('max_price bounds every result', () => {
    const results = searchFlights(flights, { destination: 'MIA', maxPriceUsd: 300 })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) expect(r.price_usd).toBeLessThanOrEqual(300)
  })

  it('max_layover_hours excludes long layovers (FL-011: 310min, FL-012: 285min)', () => {
    const results = searchFlights(flights, {
      destination: 'MIA',
      maxLayoverHours: 4,
    })
    expect(results.some((r) => r.id === 'FL-011')).toBe(false)
    expect(results.some((r) => r.id === 'FL-012')).toBe(false)
    for (const r of results) {
      expect(r.total_layover_minutes).toBeLessThanOrEqual(240)
    }
  })

  it('omitted filters are unconstrained', () => {
    const results = searchFlights(flights, { destination: 'FLL' })
    expect(results).toHaveLength(6)
  })

  it('combined scenario constraints yield a non-empty result set', () => {
    const results = searchFlights(flights, {
      destination: 'MIA',
      arriveBefore: hint.must_arrive_by_iso,
      maxPriceUsd: hint.max_price_usd,
      maxLayoverHours: hint.max_layover_hours,
    })
    expect(results.length).toBeGreaterThan(0)
  })
})

describe('searchFlights — ordering', () => {
  it('sorts by price ascending (dataset)', () => {
    const results = searchFlights(flights, { destination: 'MIA' })
    const prices = results.map((r) => r.price_usd)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('tie-breaks equal price by duration, then id (synthetic)', () => {
    const synth = [
      fakeFlight({ id: 'SYN-B', price_usd: 300, duration_minutes: 400 }),
      fakeFlight({ id: 'SYN-A', price_usd: 300, duration_minutes: 500 }),
      fakeFlight({ id: 'SYN-C', price_usd: 200, duration_minutes: 900 }),
    ]
    const ordered = searchFlights(synth, { destination: 'MIA' }).map((r) => r.id)
    expect(ordered).toEqual(['SYN-C', 'SYN-B', 'SYN-A'])
  })

  it('preferred_time orders by closest departure (synthetic)', () => {
    const synth = [
      fakeFlight({
        id: 'EARLY',
        depart_iso: '2026-09-12T06:00:00-05:00',
        arrive_iso: '2026-09-12T13:00:00-04:00',
        price_usd: 900,
      }),
      fakeFlight({
        id: 'LATE',
        depart_iso: '2026-09-12T23:00:00-05:00',
        arrive_iso: '2026-09-13T06:00:00-04:00',
        price_usd: 100,
      }),
    ]
    const ordered = searchFlights(synth, {
      destination: 'MIA',
      preferredTime: '2026-09-12T07:00:00-05:00',
    }).map((r) => r.id)
    // EARLY departs 1h from preferred; LATE 16h — price must NOT dominate
    expect(ordered).toEqual(['EARLY', 'LATE'])
  })
})

describe('toSummary', () => {
  it('carries every field an agent needs to reason about a flight', () => {
    const f = flights.find((x) => x.id === 'FL-009')!
    const s = toSummary(f)
    expect(s.id).toBe('FL-009')
    expect(s.route).toBe('LIM→MIA (1-stop)')
    expect(s.airline_code).toBe('AV')
    expect(s.segments).toHaveLength(2)
    expect(s.segments[0]!.from).toBe('LIM')
    expect(s.segments[1]!.to).toBe('MIA')
    for (const key of [
      'depart_iso',
      'arrive_iso',
      'duration_minutes',
      'total_layover_minutes',
      'price_usd',
      'cabin',
      'seats_left',
      'refundable',
      'tags',
    ] as const) {
      expect(s[key]).toBeDefined()
    }
  })

  it('joins multi-airline codes (FL-020: CM+CM+AA → CM+AA)', () => {
    const s = toSummary(flights.find((x) => x.id === 'FL-020')!)
    expect(s.airline_code).toBe('CM+AA')
  })
})
