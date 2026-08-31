/**
 * Tool 3 — update_constraints.
 * Contract: docs/plans/phase1-execution-plan.md §2 (T3).
 *
 * The human-in-the-loop replanning tool: merges the provided constraint
 * updates into the active set, RE-RUNS the search (same pure logic as
 * search_flights) across the allowed destination airports, stores both the
 * constraints and the new results, and returns them. Unmentioned constraints
 * persist from the prior state.
 */

import { loadDataset } from '../domain/flights.ts'
import { searchFlights, type SearchFilters } from '../domain/search.ts'
import { getSnapshot, nowIso, setConstraints, setLastSearch } from '../state/store.ts'
import {
  getIsoDatetime,
  getNumber,
  isRecord,
  unknownKeys,
} from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const updateConstraintsTool: WebMcpTool = {
  name: 'update_constraints',
  title: 'Update traveler constraints and re-search',
  description:
    'Change the traveler’s rebooking constraints and immediately re-search ' +
    'with the merged rule set — this returns NEW results, not just an ' +
    'acknowledgment. Provide any subset: max_price (USD, > 0), ' +
    'max_layover_hours (>= 0), preferred_time (ISO 8601 with UTC offset — ' +
    'when set, results order by departure closest to that time instead of ' +
    'lowest price). Unmentioned constraints persist from the previous state ' +
    '(calling with {} re-runs the search with the current constraints). ' +
    'Returns { ok, constraints (the complete effective set), count, results }. ' +
    'The page’s constraints panel and results update live.',
  inputSchema: {
    type: 'object',
    properties: {
      max_price: {
        type: 'number',
        description: 'New maximum total price in USD (> 0). Optional.',
      },
      max_layover_hours: {
        type: 'number',
        description: 'New maximum total layover in hours (>= 0). Optional.',
      },
      preferred_time: {
        type: 'string',
        description:
          'Preferred departure instant, ISO 8601 with explicit UTC offset ' +
          '(e.g. 2026-09-12T22:00:00-05:00 for a red-eye). Reorders results ' +
          'by closeness of departure. Optional.',
      },
    },
    additionalProperties: false,
  },
  execute: async (input) => {
    const result = await executeUpdate(input)
    logToolCall({ tool: 'update_constraints', at: nowIso(), input, result })
    return result
  },
}

async function executeUpdate(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, [
    'max_price',
    'max_layover_hours',
    'preferred_time',
  ])
  if (extras.length > 0) {
    return {
      ok: false,
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: max_price, max_layover_hours, preferred_time.`,
    }
  }

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

  const preferredTime = getIsoDatetime(input, 'preferred_time', {
    required: false,
  })
  if (!preferredTime.ok) return { ok: false, error: preferredTime.error }

  // Partial merge: only provided keys change; the rest persist.
  const current = getSnapshot().constraints
  const merged = {
    ...current,
    ...(maxPrice.value !== undefined ? { maxPriceUsd: maxPrice.value } : {}),
    ...(maxLayover.value !== undefined
      ? { maxLayoverHours: maxLayover.value }
      : {}),
    ...(preferredTime.value !== undefined
      ? { preferredTime: preferredTime.value }
      : {}),
  }
  setConstraints(merged)

  // The contract requires re-invoking the search logic, not acknowledging.
  const filters: SearchFilters = {
    destination: merged.destinationAirports,
    arriveBefore: merged.arriveBefore,
    maxPriceUsd: merged.maxPriceUsd,
    maxLayoverHours: merged.maxLayoverHours,
    preferredTime: merged.preferredTime,
  }
  const results = searchFlights(loadDataset().flights, filters)
  setLastSearch({ via: 'update_constraints', filters, results })

  return {
    ok: true,
    constraints: {
      destination_airports: merged.destinationAirports,
      arrive_before: merged.arriveBefore,
      max_price_usd: merged.maxPriceUsd,
      max_layover_hours: merged.maxLayoverHours,
      preferred_time: merged.preferredTime,
    },
    count: results.length,
    results,
  }
}

export function registerUpdateConstraints() {
  return registerTool(updateConstraintsTool)
}
