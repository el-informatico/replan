/**
 * Tool 1 — search_flights.
 * Contract: docs/plans/phase1-execution-plan.md §2 (T1).
 */

import { loadDataset } from '../domain/flights.ts'
import { searchFlights, type SearchFilters } from '../domain/search.ts'
import { nowIso, setLastSearch } from '../state/store.ts'
import {
  getIsoDatetime,
  getNumber,
  getString,
  isRecord,
  unknownKeys,
} from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

const DESTINATIONS: readonly string[] =
  loadDataset().scenario.constraints_hint.destination_airports

export const searchFlightsTool: WebMcpTool = {
  name: 'search_flights',
  title: 'Search rebooking flights',
  description:
    'Search rebooking flights from Lima (LIM) after the cancellation. ' +
    'Required: destination airport — "MIA" (Miami) or "FLL" (Fort Lauderdale, ' +
    'reachable by ground transport). Optional filters (omit = unconstrained): ' +
    'arrive_before (ISO 8601 WITH UTC offset, e.g. 2026-09-13T15:00:00-04:00), ' +
    'max_price (USD), max_layover_hours. Returns { ok, count, results } sorted ' +
    'by price ascending; each result has id, times, stops, layover total, ' +
    'price, cabin, seats_left, tags. Empty results are VALID — loosen a ' +
    'filter or try the other airport. Next steps: hold_reservation(id) to ' +
    'hold, update_constraints to change the traveler’s constraints and ' +
    're-search, confirm_booking(id) to book a held flight.',
  inputSchema: {
    type: 'object',
    properties: {
      destination: {
        type: 'string',
        enum: [...DESTINATIONS],
        description: 'Destination airport code: MIA or FLL.',
      },
      arrive_before: {
        type: 'string',
        description:
          'Only flights arriving at or before this instant. ISO 8601 with ' +
          'explicit UTC offset (Lima is -05:00, Miami -04:00).',
      },
      max_price: {
        type: 'number',
        description: 'Maximum total price in USD (must be > 0).',
      },
      max_layover_hours: {
        type: 'number',
        description: 'Maximum total layover in hours (>= 0).',
      },
    },
    required: ['destination'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const result = await executeSearch(input)
    logToolCall({ tool: 'search_flights', at: nowIso(), input, result })
    return result
  },
}

async function executeSearch(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, [
    'destination',
    'arrive_before',
    'max_price',
    'max_layover_hours',
  ])
  if (extras.length > 0) {
    return {
      ok: false,
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: destination, arrive_before, max_price, max_layover_hours.`,
    }
  }

  const destination = getString(input, 'destination')
  if (!destination.ok) return { ok: false, error: destination.error }
  if (!DESTINATIONS.includes(destination.value)) {
    return {
      ok: false,
      error: `Unknown destination "${destination.value}". This scenario serves: ${DESTINATIONS.join(', ')}.`,
    }
  }

  const arriveBefore = getIsoDatetime(input, 'arrive_before', { required: false })
  if (!arriveBefore.ok) return { ok: false, error: arriveBefore.error }

  const maxPrice = getNumber(input, 'max_price', {
    required: false,
    exclusiveMin: 0,
  })
  if (!maxPrice.ok) return { ok: false, error: maxPrice.error }

  const maxLayover = getNumber(input, 'max_layover_hours', {
    required: false,
    min: 0,
  })
  if (!maxLayover.ok) return { ok: false, error: maxLayover.error }

  const filters: SearchFilters = {
    destination: destination.value,
    arriveBefore: arriveBefore.value,
    maxPriceUsd: maxPrice.value,
    maxLayoverHours: maxLayover.value,
  }

  const results = searchFlights(loadDataset().flights, filters)
  setLastSearch({ via: 'search_flights', filters, results })

  return { ok: true, count: results.length, results }
}

export function registerSearchFlights() {
  return registerTool(searchFlightsTool)
}
