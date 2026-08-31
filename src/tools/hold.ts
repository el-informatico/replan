/**
 * Tool 2 — hold_reservation.
 * Contract: docs/plans/phase1-execution-plan.md §2 (T2).
 * State: in-memory store (ADR-0004) — 15 wall-clock-minute TTL, lazy expiry.
 */

import { loadDataset } from '../domain/flights.ts'
import { HOLD_TTL_MS, createHold, nowIso } from '../state/store.ts'
import { getString, isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const holdReservationTool: WebMcpTool = {
  name: 'hold_reservation',
  title: 'Hold a flight',
  description:
    'Place a 15-minute hold on a flight found via search_flights, keeping ' +
    'the seat while the traveler decides. Input: { flight_id } (e.g. ' +
    '"FL-001"). Returns the hold’s expiry time. One active hold per flight: ' +
    'holding the same flight twice while the first hold is alive fails — ' +
    'either wait for it to expire or book with confirm_booking. Holds are ' +
    'simulated (no backend): they expire after 15 minutes wall-clock and do ' +
    'not survive a page reload.',
  inputSchema: {
    type: 'object',
    properties: {
      flight_id: {
        type: 'string',
        description: 'Flight id from search_flights results, e.g. "FL-011".',
      },
    },
    required: ['flight_id'],
    additionalProperties: false,
  },
  execute: async (input) => {
    const result = await executeHold(input)
    logToolCall({ tool: 'hold_reservation', at: nowIso(), input, result })
    return result
  },
}

async function executeHold(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['flight_id'])
  if (extras.length > 0) {
    return {
      ok: false,
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: flight_id.`,
    }
  }

  const id = getString(input, 'flight_id')
  if (!id.ok) return { ok: false, error: id.error }

  const flight = loadDataset().flights.find((f) => f.id === id.value)
  if (!flight) {
    const sample = loadDataset()
      .flights.slice(0, 3)
      .map((f) => f.id)
      .join(', ')
    return {
      ok: false,
      error: `Unknown flight_id "${id.value}". Get ids from search_flights results (e.g. ${sample}; ${loadDataset().flights.length} flights total).`,
    }
  }

  const outcome = createHold(id.value)
  if ('conflict' in outcome) {
    return {
      ok: false,
      error: `Flight ${id.value} is already held. The active hold expires at ${new Date(outcome.conflict.expiresAt).toISOString()} (holds last 15 minutes). Wait for expiry, or confirm_booking if the traveler wants this flight.`,
    }
  }

  return {
    ok: true,
    flight_id: outcome.flightId,
    hold_expires_at: new Date(outcome.expiresAt).toISOString(),
    ttl_minutes: HOLD_TTL_MS / 60_000,
    note: 'Simulated hold (no backend): expires after 15 minutes wall-clock and does not survive a page reload. Confirm with confirm_booking before it lapses.',
  }
}

export function registerHoldReservation() {
  return registerTool(holdReservationTool)
}
