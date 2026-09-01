import { beforeEach, describe, expect, it } from 'vitest'

import { getSnapshot, resetForTests, subscribe } from '../state/store.ts'
import { searchHotelsTool } from './hotels.ts'

const CALL = { signal: new AbortController().signal }

beforeEach(() => {
  resetForTests()
})

describe('search_hotels — happy path', () => {
  it('returns Miami hotels price-ascending with the compact shape', async () => {
    const r = await searchHotelsTool.execute({ city: 'Miami' }, CALL)
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(11) // 12 Miami hotels minus HT-009 (no rooms)
    const rows = r['results'] as {
      id: string
      price_per_night_usd: number
      near_airport: string
    }[]
    const prices = rows.map((x) => x.price_per_night_usd)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
    expect(rows[0]!.id).toBe('HT-004') // $89 — cheapest in Miami
    expect(rows[0]!.near_airport).toBe('MIA')
  })

  it('caps at 8 rows with the showing-note when more match', async () => {
    const r = await searchHotelsTool.execute({ city: 'Miami' }, CALL)
    expect(r['showing']).toBe(8)
    expect(r['note']).toBe('Showing 8 of 11 — tighten filters to narrow.')
    expect((r['results'] as unknown[]).length).toBe(8)
    const small = await searchHotelsTool.execute({ city: 'Fort Lauderdale' }, CALL)
    expect(small['note']).toBeUndefined() // 6 rows — no truncation
  })

  it('prices the stay and skips sold-out hotels when a window is given', async () => {
    const r = await searchHotelsTool.execute(
      {
        city: 'Miami',
        check_in: '2026-09-12T15:00:00-04:00',
        check_out: '2026-09-14T15:00:00-04:00',
      },
      CALL,
    )
    expect(r['ok']).toBe(true)
    const rows = r['results'] as { id: string; nights: number; total_stay_usd: number }[]
    expect(rows.some((x) => x.id === 'HT-003')).toBe(false) // sold out 09-12
    for (const row of rows) {
      expect(row.nights).toBe(2)
    }
    const bayside = rows.find((x) => x.id === 'HT-002')
    expect(bayside!.total_stay_usd).toBe(296) // 2 × $148
  })

  it('filters on near_airport independently of city', async () => {
    const r = await searchHotelsTool.execute({ city: 'Miami', near_airport: 'FLL' }, CALL)
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(3)
    const ids = (r['results'] as { id: string }[]).map((x) => x.id).sort()
    expect(ids).toEqual(['HT-010', 'HT-011', 'HT-012'])
  })
})

describe('search_hotels — state-dependent edges', () => {
  it('empty result set is valid output (all matches sold out)', async () => {
    // Every Miami-near-FLL hotel is sold out on 2026-09-13.
    const r = await searchHotelsTool.execute(
      {
        city: 'Miami',
        near_airport: 'FLL',
        check_in: '2026-09-13T15:00:00-04:00',
        check_out: '2026-09-14T15:00:00-04:00',
      },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(0)
    expect(r['results']).toEqual([])
  })

  it('writes the full result set to the store and notifies subscribers', async () => {
    let notified = 0
    const unsub = subscribe(() => {
      notified += 1
    })
    await searchHotelsTool.execute({ city: 'Fort Lauderdale' }, CALL)
    unsub()
    expect(notified).toBeGreaterThan(0)
    const snap = getSnapshot()
    expect(snap.lastHotelSearch).not.toBeNull()
    expect(snap.lastHotelSearch!.results.length).toBe(6)
    expect(snap.lastHotelSearch!.filters.city).toBe('Fort Lauderdale')
  })

  it('a later search replaces the stored one', async () => {
    await searchHotelsTool.execute({ city: 'Miami' }, CALL)
    await searchHotelsTool.execute({ city: 'Fort Lauderdale' }, CALL)
    expect(getSnapshot().lastHotelSearch!.results.length).toBe(6)
  })
})

describe('search_hotels — malformed input (errors as data)', () => {
  it('rejects unknown city with the two valid values', async () => {
    const r = await searchHotelsTool.execute({ city: 'Orlando' }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('UNKNOWN_CITY')
    expect(r['error'] as string).toContain('Miami')
    expect(r['error'] as string).toContain('Fort Lauderdale')
  })

  it('rejects unknown near_airport with the valid codes', async () => {
    const r = await searchHotelsTool.execute({ city: 'Miami', near_airport: 'JFK' }, CALL)
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('UNKNOWN_AIRPORT')
    expect(r['error'] as string).toContain('MIA')
    expect(r['error'] as string).toContain('FLL')
  })

  it('rejects one-sided check_in / check_out pairs', async () => {
    const onlyIn = await searchHotelsTool.execute({ city: 'Miami', check_in: '2026-09-12T15:00:00-04:00' }, CALL)
    expect(onlyIn['ok']).toBe(false)
    expect(onlyIn['code']).toBe('INVALID_INPUT')
    expect(onlyIn['error'] as string).toContain('together')
    const onlyOut = await searchHotelsTool.execute({ city: 'Miami', check_out: '2026-09-14T15:00:00-04:00' }, CALL)
    expect(onlyOut['ok']).toBe(false)
    expect(onlyOut['error'] as string).toContain('check_out')
  })

  it('rejects reversed, zero-night, and non-whole-night windows', async () => {
    const reversed = await searchHotelsTool.execute(
      { city: 'Miami', check_in: '2026-09-14T15:00:00-04:00', check_out: '2026-09-12T15:00:00-04:00' },
      CALL,
    )
    expect(reversed['ok']).toBe(false)
    expect(reversed['code']).toBe('INVALID_INPUT')

    const zero = await searchHotelsTool.execute(
      { city: 'Miami', check_in: '2026-09-12T15:00:00-04:00', check_out: '2026-09-12T15:00:00-04:00' },
      CALL,
    )
    expect(zero['ok']).toBe(false)

    const partial = await searchHotelsTool.execute(
      { city: 'Miami', check_in: '2026-09-12T15:00:00-04:00', check_out: '2026-09-13T16:00:00-04:00' }, // 25 h
      CALL,
    )
    expect(partial['ok']).toBe(false)
    expect(partial['error'] as string).toContain('whole number')
  })

  it('rejects bad ISO and impossible calendar datetimes', async () => {
    const noOffset = await searchHotelsTool.execute(
      { city: 'Miami', check_in: '2026-09-12T15:00:00', check_out: '2026-09-13T15:00:00-04:00' },
      CALL,
    )
    expect(noOffset['ok']).toBe(false)
    expect(noOffset['code']).toBe('INVALID_INPUT')

    const feb30 = await searchHotelsTool.execute(
      { city: 'Miami', check_in: '2026-02-30T15:00:00-04:00', check_out: '2026-03-02T15:00:00-04:00' },
      CALL,
    )
    expect(feb30['ok']).toBe(false) // calendar rejection (message asserted in validate tests)
  })

  it('rejects missing city, bad types, and unknown fields', async () => {
    for (const bad of [{}, { city: 7 }, { city: '' }, { city: 'Miami', extra: 1 }]) {
      const r = await searchHotelsTool.execute(bad as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })

  it('never throws — non-object input returns an error object', async () => {
    for (const bad of [null, 42, 'Miami', []]) {
      const r = await searchHotelsTool.execute(bad as unknown as Record<string, unknown>, CALL)
      expect(r['ok']).toBe(false)
      expect(typeof r['error']).toBe('string')
    }
  })
})
