import { beforeEach, describe, expect, it } from 'vitest'

import { loadDataset } from '../domain/flights.ts'
import { getSnapshot, resetForTests, subscribe } from '../state/store.ts'
import { searchFlightsTool } from './search.ts'

const hint = loadDataset().scenario.constraints_hint

beforeEach(() => {
  resetForTests()
})

describe('search_flights tool — happy path', () => {
  it('returns compact, capped, price-sorted results for MIA', async () => {
    const r = await searchFlightsTool.execute({ destination: 'MIA' }, {
      signal: new AbortController().signal,
    })
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(20)
    expect(r['showing']).toBe(8)
    expect(r['note'] as string).toContain('Showing 8 of 20')
    const results = r['results'] as { price_usd: number; departs: string; arrives: string }[]
    expect(results).toHaveLength(8)
    const prices = results.map((x) => x.price_usd)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
    for (const row of results) {
      expect(typeof row.departs).toBe('string')
      expect(typeof row.arrives).toBe('string')
    }
  })

  it('small result sets return everything with no truncation note', async () => {
    const r = await searchFlightsTool.execute({ destination: 'FLL' }, {
      signal: new AbortController().signal,
    })
    expect(r['count']).toBe(6)
    expect(r['showing']).toBe(6)
    expect(r['note']).toBeUndefined()
    expect(r['results']).toHaveLength(6)
  })

  it('applies all four filters together', async () => {
    const r = await searchFlightsTool.execute(
      {
        destination: 'MIA',
        arrive_before: hint.must_arrive_by_iso,
        max_price: hint.max_price_usd,
        max_layover_hours: hint.max_layover_hours,
      },
      { signal: new AbortController().signal },
    )
    expect(r['ok']).toBe(true)
    expect(r['count'] as number).toBeGreaterThan(0)
  })

  it('updates the store lastSearch with FULL results and notifies subscribers', async () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await searchFlightsTool.execute({ destination: 'FLL' }, {
      signal: new AbortController().signal,
    })
    unsub()
    const snap = getSnapshot()
    expect(snap.lastSearch?.via).toBe('search_flights')
    expect(snap.lastSearch?.results).toHaveLength(6)
    expect(snap.lastSearch?.results[0]).toHaveProperty('segments')
    expect(notified).toBeGreaterThan(0)
  })
})

describe('search_flights tool — empty results are valid', () => {
  it('returns ok:true with count 0 for an impossible price', async () => {
    const r = await searchFlightsTool.execute(
      { destination: 'MIA', max_price: 1 },
      { signal: new AbortController().signal },
    )
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(0)
    expect(r['results']).toEqual([])
  })
})

describe('search_flights tool — malformed input (errors as data)', () => {
  it('rejects an unknown destination code', async () => {
    const r = await searchFlightsTool.execute({ destination: 'BOG' }, {
      signal: new AbortController().signal,
    })
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('MIA')
    expect(r['error'] as string).toContain('FLL')
  })

  it('rejects a missing destination', async () => {
    const r = await searchFlightsTool.execute({}, {
      signal: new AbortController().signal,
    })
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('destination')
  })

  it('rejects arrive_before without a UTC offset', async () => {
    const r = await searchFlightsTool.execute(
      { destination: 'MIA', arrive_before: '2026-09-13 15:00' },
      { signal: new AbortController().signal },
    )
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('offset')
  })

  it('rejects impossible calendar datetimes instead of rolling them forward (reviewer finding 4)', async () => {
    // V8 rolls these forward silently (Feb 30 → Mar 2, Sep 31 → Oct 1,
    // 24:00 → next day) — they must hit the calendar check.
    for (const bad of [
      '2026-02-30T10:00:00Z',
      '2026-09-31T10:00:00-04:00',
      '2026-09-13T24:00:00-05:00',
    ]) {
      const r = await searchFlightsTool.execute(
        { destination: 'MIA', arrive_before: bad },
        { signal: new AbortController().signal },
      )
      expect(r['ok'], bad).toBe(false)
      expect(r['error'] as string).toContain('calendar')
    }
    // Month 13 is rejected earlier — Date.parse itself returns NaN.
    const month13 = await searchFlightsTool.execute(
      { destination: 'MIA', arrive_before: '2026-13-01T10:00:00Z' },
      { signal: new AbortController().signal },
    )
    expect(month13['ok']).toBe(false)
    // A real leap day is fine
    const leap = await searchFlightsTool.execute(
      { destination: 'MIA', arrive_before: '2028-02-29T10:00:00Z' },
      { signal: new AbortController().signal },
    )
    expect(leap['ok']).toBe(true)
  })

  it('rejects a negative max_price', async () => {
    const r = await searchFlightsTool.execute(
      { destination: 'MIA', max_price: -5 },
      { signal: new AbortController().signal },
    )
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('max_price')
  })

  it('rejects a string where a number is expected', async () => {
    const r = await searchFlightsTool.execute(
      { destination: 'MIA', max_price: '300' },
      { signal: new AbortController().signal },
    )
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('max_price')
  })

  it('rejects a negative max_layover_hours', async () => {
    const r = await searchFlightsTool.execute(
      { destination: 'MIA', max_layover_hours: -1 },
      { signal: new AbortController().signal },
    )
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('max_layover_hours')
  })

  it('rejects unknown fields, listing the accepted ones', async () => {
    const r = await searchFlightsTool.execute(
      { destination: 'MIA', cabin: 'business' },
      { signal: new AbortController().signal },
    )
    expect(r['ok']).toBe(false)
    expect(r['error'] as string).toContain('cabin')
    expect(r['error'] as string).toContain('max_layover_hours')
  })

  it('never throws — every path returns a JSON-safe object', async () => {
    for (const bad of [null, 42, 'x', [], { destination: 7 }]) {
      const r = await searchFlightsTool.execute(bad as Record<string, unknown>, {
        signal: new AbortController().signal,
      })
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})
