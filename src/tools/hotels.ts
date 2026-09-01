/**
 * search_hotels — Contract T5 (docs/plans/phase2-execution-plan.md §3).
 * Thin validated wrapper over the pure searchHotels (src/domain/hotels.ts);
 * full results go to the store (lastHotelSearch) for the UI, the compact
 * projection goes back to the agent (≤8 rows, ≤1.5K output).
 */

import {
  HOTEL_CITIES,
  NEAR_AIRPORTS,
  loadHotelsDataset,
  nightsBetween,
  searchHotels,
} from '../domain/hotels.ts'
import { nowIso, setLastHotelSearch } from '../state/store.ts'
import { compactMeta } from './payload.ts'
import { getIsoDatetime, getOptionalString, getString, isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const searchHotelsTool: WebMcpTool = {
  name: 'search_hotels',
  title: 'Search hotels',
  description:
    'Search hotels for the recovery stay. Required: city ("Miami" or ' +
    '"Fort Lauderdale"). Optional: near_airport ("MIA"/"FLL") and check_in ' +
    '+ check_out (ISO 8601 with offset, whole nights) to price the stay ' +
    'and skip sold-out hotels. Cheapest first; empty results are valid.',
  inputSchema: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        enum: [...HOTEL_CITIES],
        description: 'City: "Miami" or "Fort Lauderdale".',
      },
      check_in: {
        type: 'string',
        description:
          'Stay start. ISO 8601 with UTC offset (Miami -04:00). Provide ' +
          'together with check_out; stays are whole 24 h nights.',
      },
      check_out: {
        type: 'string',
        description:
          'Stay end, after check_in by whole 24 h nights. ISO 8601 with ' +
          'UTC offset.',
      },
      near_airport: {
        type: 'string',
        enum: [...NEAR_AIRPORTS],
        description:
          'Nearest airport: "MIA" or "FLL" — the same airports the flight ' +
          'tools serve; independent of city.',
      },
    },
    required: ['city'],
    additionalProperties: false,
  },
  // Writes lastHotelSearch to page state (the hotel results panel) — same
  // honest-annotation stance as search_flights (plan §1, D010 research note).
  annotations: { readOnlyHint: false },
  execute: async (input) => {
    const result = await executeSearchHotels(input)
    logToolCall({ tool: 'search_hotels', at: nowIso(), input, result })
    return result
  },
}

async function executeSearchHotels(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['city', 'check_in', 'check_out', 'near_airport'])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: city, check_in, check_out, near_airport.`,
    }
  }

  const city = getString(input, 'city')
  if (!city.ok) return { ok: false, code: 'INVALID_INPUT', error: city.error }
  if (!HOTEL_CITIES.includes(city.value as (typeof HOTEL_CITIES)[number])) {
    return {
      ok: false,
      code: 'UNKNOWN_CITY',
      error: `Unknown city "${city.value}". This scenario serves: ${HOTEL_CITIES.join(' or ')}.`,
    }
  }

  const nearAirport = getOptionalString(input, 'near_airport')
  if (!nearAirport.ok) return { ok: false, code: 'INVALID_INPUT', error: nearAirport.error }
  if (nearAirport.value !== undefined && !NEAR_AIRPORTS.includes(nearAirport.value as NearAirportRaw)) {
    return {
      ok: false,
      code: 'UNKNOWN_AIRPORT',
      error: `Unknown near_airport "${nearAirport.value}". Use: ${NEAR_AIRPORTS.join(' or ')} — the same airports the flight tools serve.`,
    }
  }

  const checkIn = getIsoDatetime(input, 'check_in', { required: false })
  if (!checkIn.ok) return { ok: false, code: 'INVALID_INPUT', error: checkIn.error }
  const checkOut = getIsoDatetime(input, 'check_out', { required: false })
  if (!checkOut.ok) return { ok: false, code: 'INVALID_INPUT', error: checkOut.error }

  const gaveIn = checkIn.value !== undefined
  const gaveOut = checkOut.value !== undefined
  if (gaveIn !== gaveOut) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `check_in and check_out must be provided together — got only ${gaveIn ? 'check_in' : 'check_out'}.`,
    }
  }
  if (gaveIn && gaveOut) {
    const nights = nightsBetween(checkIn.value!, checkOut.value!)
    if (nights === null) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        error: `check_out must be after check_in by a whole number of 24 h nights (got check_in ${checkIn.value}, check_out ${checkOut.value}).`,
      }
    }
  }

  const filters = {
    city: city.value,
    ...(nearAirport.value !== undefined ? { nearAirport: nearAirport.value } : {}),
    ...(gaveIn ? { checkIn: checkIn.value, checkOut: checkOut.value } : {}),
  }
  const results = searchHotels(loadHotelsDataset().hotels, filters)
  setLastHotelSearch({ filters, results })

  // Compact projection (reviewer finding 1): city/star/rooms_left stay in
  // the STORE results (UI renders them) but not the agent payload — the
  // agent already supplied city, and the post-crunch windowed case must
  // fit the 1.5K budget.
  const rows = results.slice(0, 8).map((r) => ({
    id: r.id,
    name: r.name,
    near_airport: r.near_airport,
    guest_rating: r.guest_rating,
    price_per_night_usd: r.price_per_night_usd,
    ...(r.total_stay_usd !== undefined
      ? { nights: r.nights, total_stay_usd: r.total_stay_usd }
      : {}),
  }))
  return {
    ok: true,
    ...compactMeta(results.length, rows.length),
    results: rows,
  }
}

type NearAirportRaw = (typeof NEAR_AIRPORTS)[number]

export function registerSearchHotels() {
  return registerTool(searchHotelsTool)
}
