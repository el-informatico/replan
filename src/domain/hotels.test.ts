import { describe, expect, it } from 'vitest'

import {
  HOTEL_CITIES,
  NEAR_AIRPORTS,
  type Hotel,
  loadHotelsDataset,
  nightsBetween,
  nightDates,
  searchHotels,
  validateHotelsDataset,
} from './hotels.ts'

const data = loadHotelsDataset()

describe('hotel dataset invariants', () => {
  it('validateHotelsDataset returns no errors', () => {
    expect(validateHotelsDataset(data)).toEqual([])
  })

  it('carries 18 unique hotels in the documented id format', () => {
    expect(data.hotels).toHaveLength(18)
    const ids = data.hotels.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^HT-\d{3}$/)
  })

  it('scenario.original_hotel_reservation points at a real, seed-safe hotel', () => {
    const r = data.scenario.original_hotel_reservation
    const seeded = data.hotels.find((h) => h.id === r.hotel_id)
    expect(seeded).toBeDefined()
    expect(nightsBetween(r.check_in, r.check_out)).toBe(r.nights)
    // D008: the seeded hotel must be bookable on every date the reservation
    // could plausibly move to.
    for (const d of ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16']) {
      expect(seeded!.sold_out, d).not.toContain(d)
    }
  })
})

describe('hotel dataset discriminating power', () => {
  it('has hotels in both cities, both airports, and all three zones', () => {
    for (const city of HOTEL_CITIES) {
      expect(data.hotels.some((h) => h.city === city), city).toBe(true)
    }
    for (const airport of NEAR_AIRPORTS) {
      expect(data.hotels.some((h) => h.near_airport === airport), airport).toBe(true)
    }
    expect(data.hotels.filter((h) => h.zone === 'downtown-miami').length).toBeGreaterThan(0)
    expect(data.hotels.filter((h) => h.zone === 'miami-beach').length).toBeGreaterThan(0)
    expect(data.hotels.filter((h) => h.zone === 'fort-lauderdale').length).toBeGreaterThan(0)
  })

  it('has Miami hotels whose nearest airport is FLL — city and near_airport cut independently', () => {
    const cross = data.hotels.filter((h) => h.city === 'Miami' && h.near_airport === 'FLL')
    expect(cross.length).toBeGreaterThanOrEqual(3)
  })

  it('has hotels on both sides of $150/night', () => {
    expect(data.hotels.some((h) => h.price_per_night_usd < 150)).toBe(true)
    expect(data.hotels.some((h) => h.price_per_night_usd > 150)).toBe(true)
  })

  it('has an available stay for the scenario window (2026-09-12 → 09-14) in each city', () => {
    for (const city of HOTEL_CITIES) {
      const results = searchHotels(data.hotels, {
        city,
        checkIn: '2026-09-12T15:00:00-04:00',
        checkOut: '2026-09-14T15:00:00-04:00',
      })
      expect(results.length, city).toBeGreaterThan(0)
    }
  })

  it('has hotels with and without a port shuttle, and with and without rooms', () => {
    expect(data.hotels.some((h) => h.tags.includes('port-shuttle'))).toBe(true)
    expect(data.hotels.some((h) => !h.tags.includes('port-shuttle'))).toBe(true)
    expect(data.hotels.some((h) => h.rooms_left === 0)).toBe(true)
    expect(data.hotels.some((h) => h.rooms_left > 0)).toBe(true)
  })
})

describe('searchHotels (pure)', () => {
  const WINDOW = { checkIn: '2026-09-12T15:00:00-04:00', checkOut: '2026-09-14T15:00:00-04:00' }

  it('sorts by price ascending, then guest rating descending, then id', () => {
    const results = searchHotels(data.hotels, { city: 'Miami' })
    const prices = results.map((r) => r.price_per_night_usd)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
    const [a, b] = results // $89 and $96 are the two cheapest Miami hotels
    expect(a!.id).toBe('HT-004')
    expect(b!.id).toBe('HT-012')
  })

  it('excludes sold-out hotels only on nights the stay actually occupies', () => {
    // HT-003 is sold out on 2026-09-12: excluded for the scenario window...
    const withCrunchNight = searchHotels(data.hotels, { city: 'Miami', ...WINDOW })
    expect(withCrunchNight.some((r) => r.id === 'HT-003')).toBe(false)
    // ...but available for a stay that starts after the crunch.
    const after = searchHotels(data.hotels, {
      city: 'Miami',
      checkIn: '2026-09-14T15:00:00-04:00',
      checkOut: '2026-09-15T15:00:00-04:00',
    })
    expect(after.some((r) => r.id === 'HT-003')).toBe(true)
  })

  it('excludes hotels with no rooms left', () => {
    const results = searchHotels(data.hotels, { city: 'Miami' })
    expect(results.some((r) => r.id === 'HT-009')).toBe(false) // rooms_left: 0
  })

  it('prices the whole stay when a window is given (nights × nightly)', () => {
    const results = searchHotels(data.hotels, { city: 'Miami', ...WINDOW })
    for (const r of results) {
      expect(r.nights).toBe(2)
      expect(r.total_stay_usd).toBe(2 * r.price_per_night_usd)
    }
    const noWindow = searchHotels(data.hotels, { city: 'Miami' })
    for (const r of noWindow) {
      expect(r.nights).toBeUndefined()
      expect(r.total_stay_usd).toBeUndefined()
    }
  })

  it('filters on near_airport independently of city', () => {
    const miamiNearFll = searchHotels(data.hotels, { city: 'Miami', nearAirport: 'FLL' })
    expect(miamiNearFll.map((r) => r.id).sort()).toEqual(['HT-010', 'HT-011', 'HT-012'])
  })

  it('can return an empty result set (valid) for a fully sold-out cut', () => {
    // All three Miami-near-FLL hotels are sold out on 2026-09-13.
    const results = searchHotels(data.hotels, {
      city: 'Miami',
      nearAirport: 'FLL',
      checkIn: '2026-09-13T15:00:00-04:00',
      checkOut: '2026-09-14T15:00:00-04:00',
    })
    expect(results).toEqual([])
  })

  it('nightDates counts the check-in date but not the check-out date', () => {
    expect(nightDates('2026-09-12T15:00:00-04:00', 2)).toEqual(['2026-09-12', '2026-09-13'])
  })

  it('nightsBetween rejects non-whole, zero, and negative stays', () => {
    expect(nightsBetween('2026-09-12T15:00:00-04:00', '2026-09-14T15:00:00-04:00')).toBe(2)
    expect(nightsBetween('2026-09-12T15:00:00-04:00', '2026-09-13T16:00:00-04:00')).toBeNull() // 25 h
    expect(nightsBetween('2026-09-12T15:00:00-04:00', '2026-09-12T15:00:00-04:00')).toBeNull()
    expect(nightsBetween('2026-09-14T15:00:00-04:00', '2026-09-12T15:00:00-04:00')).toBeNull()
  })

  it('works on synthetic hotels outside the shipped dataset (pure function)', () => {
    const fake: Hotel = {
      id: 'HT-901',
      name: 'Test Hotel',
      city: 'Miami',
      zone: 'downtown-miami',
      near_airport: 'MIA',
      star_rating: 3,
      guest_rating: 4.0,
      price_per_night_usd: 100,
      currency: 'USD',
      rooms_left: 1,
      refundable: true,
      breakfast_included: false,
      distance_to_port_km: 2.0,
      sold_out: [],
      tags: ['budget'],
    }
    expect(searchHotels([fake], { city: 'Miami' })).toHaveLength(1)
    expect(searchHotels([fake], { city: 'Fort Lauderdale' })).toEqual([])
  })
})
