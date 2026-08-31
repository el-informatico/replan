/**
 * Tool 1 — search_flights.
 * Contract: docs/plans/phase1-execution-plan.md §2 (T1).
 */

import { loadDataset } from '../domain/flights.ts'
import { searchFlights, type SearchFilters } from '../domain/search.ts'
import { nowIso, setLastSearch } from '../state/store.ts'
import { compactResults } from './payload.ts'
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
    'Required: destination — "MIA" (Miami) or "FLL" (Fort Lauderdale, ' +
    'ground-reachable). Optional filters, omit any to leave it unconstrained: ' +
    'arrive_before (ISO 8601 with UTC offset), max_price (USD), ' +
    'max_layover_hours. Returns cheapest flights first; empty results are ' +
    'valid — loosen a filter or try the other airport. Follow with ' +
    'hold_reservation(flight_id) to hold a result.',
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
          'Arrive at or before this instant. ISO 8601 with UTC offset ' +
          '(Lima -05:00, Miami -04:00).',
      },
      max_price: {
        type: 'number',
        description: 'Maximum total price in USD (> 0).',
      },
      max_layover_hours: {
        type: 'number',
        description: 'Maximum total layover in hours (>= 0).',
      },
    },
    required: ['destination'],
    additionalProperties: false,
  },
  // Writes lastSearch to the page state (the results panel) — so this is a
  // state-mutating tool despite feeling read-only (GoogleLabs precedent:
  // their searchFlights is also readOnlyHint:false).
  annotations: { readOnlyHint: false },
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
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
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
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: destination, arrive_before, max_price, max_layover_hours.`,
    }
  }

  const destination = getString(input, 'destination')
  if (!destination.ok) {
    return { ok: false, code: 'INVALID_INPUT', error: destination.error }
  }
  if (!DESTINATIONS.includes(destination.value)) {
    return {
      ok: false,
      code: 'UNKNOWN_DESTINATION',
      error: `Unknown destination "${destination.value}". This scenario serves: ${DESTINATIONS.join(', ')}.`,
    }
  }

  const arriveBefore = getIsoDatetime(input, 'arrive_before', { required: false })
  if (!arriveBefore.ok) {
    return { ok: false, code: 'INVALID_INPUT', error: arriveBefore.error }
  }

  const maxPrice = getNumber(input, 'max_price', {
    required: false,
    exclusiveMin: 0,
  })
  if (!maxPrice.ok) return { ok: false, code: 'INVALID_INPUT', error: maxPrice.error }

  const maxLayover = getNumber(input, 'max_layover_hours', {
    required: false,
    min: 0,
  })
  if (!maxLayover.ok) return { ok: false, code: 'INVALID_INPUT', error: maxLayover.error }

  const filters: SearchFilters = {
    destination: destination.value,
    arriveBefore: arriveBefore.value,
    maxPriceUsd: maxPrice.value,
    maxLayoverHours: maxLayover.value,
  }

  const results = searchFlights(loadDataset().flights, filters)
  setLastSearch({ via: 'search_flights', filters, results })

  // Compact payload per the authoring brief (~1.5K output budget); full
  // summaries live on in store.lastSearch for the UI.
  const compact = compactResults(results)
  return {
    ok: true,
    count: compact.total,
    showing: compact.showing,
    ...(compact.note ? { note: compact.note } : {}),
    results: compact.results,
  }
}

export function registerSearchFlights() {
  return registerTool(searchFlightsTool)
}
