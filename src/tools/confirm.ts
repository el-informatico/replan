/**
 * Tool 4 — confirm_booking.
 * Contract: docs/plans/phase1-execution-plan.md §2 (T4).
 *
 * Requires an ACTIVE (non-expired) hold from hold_reservation. The
 * confirmation reference is DETERMINISTIC per flight (RPLN-<flight id
 * without dash>) — that determinism IS the idempotency mechanism: confirming
 * an already-booked flight returns the identical itinerary with
 * idempotent: true.
 */

import { loadDataset } from '../domain/flights.ts'
import { toSummary } from '../domain/search.ts'
import {
  addBooking,
  consumeHold,
  getActiveHold,
  getBooking,
  getExpiredHoldAt,
  nowIso,
} from '../state/store.ts'
import { getString, isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

function confirmationRef(flightId: string): string {
  return `RPLN-${flightId.replace('-', '')}`
}

export const confirmBookingTool: WebMcpTool = {
  name: 'confirm_booking',
  title: 'Confirm a held flight (books it)',
  description:
    'Book a flight that has an active hold from hold_reservation — this ' +
    'commits the rebooking and returns the final itinerary with a ' +
    'confirmation reference. Input: { flight_id }. No active hold → error ' +
    'with how to get one; expired hold → error saying when it lapsed. ' +
    'Calling again on an already-booked flight is safe: returns the same ' +
    'confirmation (idempotent). The page switches to the reservation-' +
    'confirmed view.',
  inputSchema: {
    type: 'object',
    properties: {
      flight_id: {
        type: 'string',
        description: 'Flight id with an active hold, e.g. "FL-003".',
      },
    },
    required: ['flight_id'],
    additionalProperties: false,
  },
  execute: async (input) => {
    const result = await executeConfirm(input)
    logToolCall({ tool: 'confirm_booking', at: nowIso(), input, result })
    return result
  },
}

async function executeConfirm(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['flight_id'])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: flight_id.`,
    }
  }

  const id = getString(input, 'flight_id')
  if (!id.ok) return { ok: false, code: 'INVALID_INPUT', error: id.error }

  const flight = loadDataset().flights.find((f) => f.id === id.value)
  if (!flight) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      error: `Unknown flight_id "${id.value}". Valid ids come from search_flights results.`,
    }
  }

  // Idempotency first: an existing booking always wins.
  const existing = getBooking(id.value)
  if (existing) {
    return { ...existing.itinerary, idempotent: true }
  }

  const hold = getActiveHold(id.value)
  if (!hold) {
    const expiredAt = getExpiredHoldAt(id.value)
    if (expiredAt !== null) {
      return {
        ok: false,
        code: 'HOLD_EXPIRED',
        error: `The hold on ${id.value} expired at ${new Date(expiredAt).toISOString()} (holds last 15 minutes). Place a new hold with hold_reservation, then confirm again.`,
      }
    }
    return {
      ok: false,
      code: 'NO_ACTIVE_HOLD',
      error: `No hold on ${id.value}. Booking requires an active hold: call hold_reservation with flight_id "${id.value}" first, then confirm_booking.`,
    }
  }

  consumeHold(id.value)
  const itinerary = {
    ok: true,
    status: 'confirmed',
    confirmation_ref: confirmationRef(flight.id),
    confirmed_at: nowIso(),
    flight: toSummary(flight),
    price_usd: flight.price_usd,
    cabin: flight.cabin,
  }
  addBooking({
    confirmationRef: confirmationRef(flight.id),
    flightId: flight.id,
    confirmedAt: nowIso(),
    itinerary,
  })
  return itinerary
}

export function registerConfirmBooking() {
  return registerTool(confirmBookingTool)
}
