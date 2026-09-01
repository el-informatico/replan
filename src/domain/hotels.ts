/**
 * Hotel domain — types, dataset validation, pure search.
 * Design record: docs/decisions/0005-synthetic-ancillary-datasets.md
 * (ADR-0005); schema doc: docs/domain/hotel-dataset.md.
 *
 * Entirely synthetic data (src/data/hotels.json). validateHotelsDataset
 * enforces every invariant the docs promise; the unit suite runs it inside
 * scripts/verify.sh, so arithmetic drift fails the build.
 */

import raw from '../data/hotels.json'
import { ISO_WITH_OFFSET } from './flights.ts'

export type HotelCity = 'Miami' | 'Fort Lauderdale'
export type HotelZone = 'downtown-miami' | 'miami-beach' | 'fort-lauderdale'
/** Same airport concept the flight tools use (scenario: MIA + FLL). */
export type NearAirport = 'MIA' | 'FLL'

export const HOTEL_CITIES: readonly HotelCity[] = ['Miami', 'Fort Lauderdale']
export const HOTEL_ZONES: readonly HotelZone[] = [
  'downtown-miami',
  'miami-beach',
  'fort-lauderdale',
]
export const NEAR_AIRPORTS: readonly NearAirport[] = ['MIA', 'FLL']

/** Zone ⇔ city is 1:1 and checked by the validator. */
const CITY_BY_ZONE: Record<HotelZone, HotelCity> = {
  'downtown-miami': 'Miami',
  'miami-beach': 'Miami',
  'fort-lauderdale': 'Fort Lauderdale',
}

export const HOTEL_TAGS = [
  'port-shuttle',
  'airport-shuttle',
  'beachfront',
  'budget',
  'premium',
  'family-friendly',
  'breakfast',
  'last-rooms',
  'walkable-port',
] as const
export type HotelTag = (typeof HOTEL_TAGS)[number]

export interface Hotel {
  id: string
  name: string
  city: HotelCity
  zone: HotelZone
  near_airport: NearAirport
  star_rating: number
  guest_rating: number
  price_per_night_usd: number
  currency: string
  rooms_left: number
  refundable: boolean
  breakfast_included: boolean
  distance_to_port_km: number
  sold_out: string[]
  tags: string[]
}

export interface OriginalHotelReservation {
  reservation_id: string
  hotel_id: string
  check_in: string
  check_out: string
  nights: number
  status: string
  note: string
}

export interface HotelScenario {
  name: string
  original_hotel_reservation: OriginalHotelReservation
}

export interface HotelDataset {
  generated_at: string
  scenario: HotelScenario
  hotels: Hotel[]
}

/** Sold-out dates are confined to the scenario month (validator-enforced). */
const SOLD_OUT_DATE = /^2026-09-\d{2}$/
/** Dates the seeded reservation could plausibly move to (D008: no dead ends). */
const SEED_SAFE_WINDOW: readonly string[] = [
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
]

export function validateHotelsDataset(data: HotelDataset): string[] {
  const errors: string[] = []
  const hotels = data.hotels

  if (hotels.length < 15 || hotels.length > 25) {
    errors.push(`Expected 15-25 hotels, got ${hotels.length}.`)
  }

  const ids = new Set<string>()
  const names = new Set<string>()
  for (const h of hotels) {
    if (!/^HT-\d{3}$/.test(h.id)) errors.push(`${h.id}: id must match HT-###.`)
    if (ids.has(h.id)) errors.push(`${h.id}: duplicate id.`)
    ids.add(h.id)

    if (typeof h.name !== 'string' || h.name.length === 0) {
      errors.push(`${h.id}: name must be a non-empty string.`)
    } else if (names.has(h.name)) {
      errors.push(`${h.id}: duplicate name "${h.name}".`)
    }
    names.add(h.name)

    if (!HOTEL_CITIES.includes(h.city)) {
      errors.push(`${h.id}: city must be one of ${HOTEL_CITIES.join(', ')}.`)
    }
    if (!HOTEL_ZONES.includes(h.zone)) {
      errors.push(`${h.id}: zone must be one of ${HOTEL_ZONES.join(', ')}.`)
    } else if (h.city !== CITY_BY_ZONE[h.zone]) {
      errors.push(`${h.id}: zone "${h.zone}" does not lie in city "${h.city}".`)
    }
    if (!NEAR_AIRPORTS.includes(h.near_airport)) {
      errors.push(`${h.id}: near_airport must be MIA or FLL.`)
    }

    if (!Number.isInteger(h.star_rating) || h.star_rating < 2 || h.star_rating > 5) {
      errors.push(`${h.id}: star_rating must be an integer 2-5.`)
    }
    if (
      !Number.isFinite(h.guest_rating) ||
      h.guest_rating < 1 ||
      h.guest_rating > 5 ||
      Math.round(h.guest_rating * 10) !== h.guest_rating * 10
    ) {
      errors.push(`${h.id}: guest_rating must be 1.0-5.0 with one decimal.`)
    }
    if (!(h.price_per_night_usd > 0)) {
      errors.push(`${h.id}: price_per_night_usd must be > 0.`)
    }
    if (h.currency !== 'USD') errors.push(`${h.id}: currency must be USD.`)
    if (!Number.isInteger(h.rooms_left) || h.rooms_left < 0 || h.rooms_left > 9) {
      errors.push(`${h.id}: rooms_left must be an integer 0-9.`)
    }
    if (typeof h.refundable !== 'boolean') {
      errors.push(`${h.id}: refundable must be boolean.`)
    }
    if (typeof h.breakfast_included !== 'boolean') {
      errors.push(`${h.id}: breakfast_included must be boolean.`)
    }
    if (!(h.distance_to_port_km > 0)) {
      errors.push(`${h.id}: distance_to_port_km must be > 0.`)
    } else if (h.near_airport === 'MIA' && h.distance_to_port_km > 20) {
      errors.push(`${h.id}: near MIA must be <= 20 km from the port, got ${h.distance_to_port_km}.`)
    } else if (h.near_airport === 'FLL' && h.distance_to_port_km < 20) {
      errors.push(`${h.id}: near FLL must be >= 20 km from the port, got ${h.distance_to_port_km}.`)
    }

    const soldOut = new Set<string>()
    for (const d of h.sold_out) {
      if (!SOLD_OUT_DATE.test(d) || Number(d.slice(8)) < 1 || Number(d.slice(8)) > 30) {
        errors.push(`${h.id}: sold_out date "${d}" is not a valid 2026-09 calendar date.`)
      }
      if (soldOut.has(d)) errors.push(`${h.id}: duplicate sold_out date ${d}.`)
      soldOut.add(d)
    }

    if (h.tags.length < 1) errors.push(`${h.id}: at least one tag required.`)
    const seen = new Set<string>()
    for (const t of h.tags) {
      if (!(HOTEL_TAGS as readonly string[]).includes(t)) {
        errors.push(`${h.id}: unknown tag "${t}".`)
      }
      if (seen.has(t)) errors.push(`${h.id}: duplicate tag "${t}".`)
      seen.add(t)
    }

    // Tag cross-invariants — the docs promise these equivalences.
    if (h.breakfast_included !== h.tags.includes('breakfast')) {
      errors.push(`${h.id}: breakfast_included must match the "breakfast" tag.`)
    }
    if (h.tags.includes('premium') !== h.star_rating >= 4) {
      errors.push(`${h.id}: "premium" tag must match star_rating >= 4.`)
    }
    if (h.tags.includes('budget') !== h.price_per_night_usd < 120) {
      errors.push(`${h.id}: "budget" tag must match price < $120.`)
    }
    if (h.tags.includes('walkable-port') !== h.distance_to_port_km <= 3) {
      errors.push(`${h.id}: "walkable-port" tag must match distance <= 3 km.`)
    }
    if (h.tags.includes('last-rooms') !== (h.rooms_left >= 1 && h.rooms_left <= 2)) {
      errors.push(`${h.id}: "last-rooms" tag must match 1-2 rooms left (0 = sold out entirely).`)
    }
    if (h.tags.includes('beachfront') && h.zone === 'downtown-miami') {
      errors.push(`${h.id}: "beachfront" requires a beach zone.`)
    }
  }

  const r = data.scenario.original_hotel_reservation
  const seeded = hotels.find((h) => h.id === r.hotel_id)
  if (!seeded) {
    errors.push(`scenario.original_hotel_reservation: hotel_id ${r.hotel_id} not found.`)
  }
  if (!ISO_WITH_OFFSET.test(r.check_in) || Number.isNaN(Date.parse(r.check_in))) {
    errors.push('scenario.original_hotel_reservation: check_in must be ISO 8601 with offset.')
  }
  if (!ISO_WITH_OFFSET.test(r.check_out) || Number.isNaN(Date.parse(r.check_out))) {
    errors.push('scenario.original_hotel_reservation: check_out must be ISO 8601 with offset.')
  }
  const nights = nightsBetween(r.check_in, r.check_out)
  if (nights === null || nights !== r.nights || r.nights < 1) {
    errors.push(
      `scenario.original_hotel_reservation: check_out - check_in must equal nights (${r.nights}) in whole 24 h steps.`,
    )
  }
  if (r.status !== 'booked') {
    errors.push('scenario.original_hotel_reservation: status must be "booked".')
  }
  if (seeded && seeded.sold_out.some((d) => SEED_SAFE_WINDOW.includes(d))) {
    errors.push(
      `${seeded.id}: the seeded-reservation hotel must not be sold out inside ${SEED_SAFE_WINDOW[0]}..${SEED_SAFE_WINDOW[SEED_SAFE_WINDOW.length - 1]} (D008 — no dead ends).`,
    )
  }

  return errors
}

export function loadHotelsDataset(): HotelDataset {
  return raw as unknown as HotelDataset
}

// ---------------------------------------------------------------------------
// Pure search (no store, no DOM, no side effects — same split as search.ts).
// ---------------------------------------------------------------------------

export interface HotelSearchFilters {
  city?: string
  nearAirport?: string
  /** Both-or-neither and whole-night semantics are enforced at the tool layer. */
  checkIn?: string
  checkOut?: string
}

export interface HotelSummary {
  id: string
  name: string
  city: HotelCity
  zone: HotelZone
  near_airport: NearAirport
  star_rating: number
  guest_rating: number
  price_per_night_usd: number
  rooms_left: number
  refundable: boolean
  breakfast_included: boolean
  distance_to_port_km: number
  tags: string[]
  /** Present only when the search carried a stay window. */
  nights?: number
  total_stay_usd?: number
}

/** Whole 24 h nights between two ISO instants, or null if not whole/positive. */
export function nightsBetween(checkIn: string, checkOut: string): number | null {
  const ms = Date.parse(checkOut) - Date.parse(checkIn)
  if (!Number.isFinite(ms) || ms <= 0 || ms % 86_400_000 !== 0) return null
  return ms / 86_400_000
}

/** Calendar dates (YYYY-MM-DD) the stay occupies — check-in date counts, check-out does not. */
export function nightDates(checkIn: string, nights: number): string[] {
  const y = Number(checkIn.slice(0, 4))
  const m = Number(checkIn.slice(5, 7))
  const d = Number(checkIn.slice(8, 10))
  const start = Date.UTC(y, m - 1, d)
  return Array.from({ length: nights }, (_, k) => {
    const dt = new Date(start + k * 86_400_000)
    return dt.toISOString().slice(0, 10)
  })
}

export function searchHotels(hotels: Hotel[], filters: HotelSearchFilters): HotelSummary[] {
  const windowGiven = filters.checkIn !== undefined && filters.checkOut !== undefined
  let nights: number | undefined
  if (windowGiven) {
    const n = nightsBetween(filters.checkIn!, filters.checkOut!)
    if (n === null) return [] // invalid window matches nothing (tool layer pre-validates)
    nights = n
  }
  const stayDates = nights !== undefined ? nightDates(filters.checkIn!, nights) : null

  const out = hotels.filter((h) => {
    if (filters.city !== undefined && h.city !== filters.city) return false
    if (filters.nearAirport !== undefined && h.near_airport !== filters.nearAirport) return false
    if (h.rooms_left <= 0) return false
    if (stayDates && stayDates.some((d) => h.sold_out.includes(d))) return false
    return true
  })

  const summaries: HotelSummary[] = out.map((h) => ({
    id: h.id,
    name: h.name,
    city: h.city,
    zone: h.zone,
    near_airport: h.near_airport,
    star_rating: h.star_rating,
    guest_rating: h.guest_rating,
    price_per_night_usd: h.price_per_night_usd,
    rooms_left: h.rooms_left,
    refundable: h.refundable,
    breakfast_included: h.breakfast_included,
    distance_to_port_km: h.distance_to_port_km,
    tags: [...h.tags],
    ...(nights !== undefined ? { nights, total_stay_usd: nights * h.price_per_night_usd } : {}),
  }))

  summaries.sort((a, b) => {
    if (a.price_per_night_usd !== b.price_per_night_usd) {
      return a.price_per_night_usd - b.price_per_night_usd
    }
    if (a.guest_rating !== b.guest_rating) return b.guest_rating - a.guest_rating
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return summaries
}

export function hotelById(hotels: Hotel[], id: string): Hotel | null {
  return hotels.find((h) => h.id === id) ?? null
}
