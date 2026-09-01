import { describe, expect, it } from 'vitest'

import {
  estimateTravelMinutes,
  fareFor,
  findFare,
  findRoute,
  loadGroundTransportDataset,
  round2,
  validateGroundTransportDataset,
} from './transport.ts'

const data = loadGroundTransportDataset()

describe('ground-transport dataset invariants', () => {
  it('validateGroundTransportDataset returns no errors', () => {
    expect(validateGroundTransportDataset(data)).toEqual([])
  })

  it('covers every airport × zone combination', () => {
    expect(data.routes).toHaveLength(6)
    for (const a of ['MIA', 'FLL']) {
      for (const z of ['downtown-miami', 'miami-beach', 'fort-lauderdale']) {
        expect(findRoute(data, a, z), `${a}→${z}`).not.toBeNull()
      }
    }
    expect(findRoute(data, 'MIA', 'bogus')).toBeNull()
  })

  it('keeps the fare ordering shuttle < rideshare < taxi on the long FLL route', () => {
    const fll = findRoute(data, 'FLL', 'downtown-miami')!
    const shuttle = fareFor(findFare(data, 'shuttle')!, fll)
    const rideshare = fareFor(findFare(data, 'rideshare')!, fll)
    const taxi = fareFor(findFare(data, 'taxi')!, fll)
    expect(shuttle).toBeLessThan(rideshare)
    expect(rideshare).toBeLessThan(taxi)
    expect([shuttle, rideshare, taxi]).toEqual([25.64, 65.9, 95.9])
  })
})

describe('pure pricing', () => {
  it('derives exact fares from base + per-km × distance, cents-rounded once', () => {
    const mia = findRoute(data, 'MIA', 'downtown-miami')!
    expect(fareFor(findFare(data, 'taxi')!, mia)).toBe(27.7) // 3.5 + 2.2×11
    expect(fareFor(findFare(data, 'shuttle')!, mia)).toBe(12.62) // 8 + 0.42×11
    expect(fareFor(findFare(data, 'rideshare')!, mia)).toBe(20.95) // 5 + 1.45×11
  })

  it('round2 cleans float drift', () => {
    expect(round2(8 + 0.42 * 42)).toBe(25.64)
    expect(round2(3.5 + 2.2 * 11)).toBe(27.7)
  })

  it('door-to-door time = wait + typical drive', () => {
    const fll = findRoute(data, 'FLL', 'downtown-miami')!
    expect(estimateTravelMinutes(findFare(data, 'shuttle')!, fll)).toBe(80) // 25 + 55
    expect(estimateTravelMinutes(findFare(data, 'taxi')!, fll)).toBe(60) // 5 + 55
  })
})
