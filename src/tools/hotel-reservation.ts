/**
 * update_hotel_reservation — Contract T6
 * (docs/plans/phase2-execution-plan.md §3). Operates on the scenario-seeded
 * reservation (D008) with the flight tools' conventions: structured
 * NOT_FOUND, deterministic idempotency, cross-tool arrival validation.
 */

import { hotelById, loadHotelsDataset } from '../domain/hotels.ts'
import {
  getHotelReservation,
  getSnapshot,
  latestBooking,
  nowIso,
  setHotelReservation,
  type HotelReservation,
} from '../state/store.ts'
import { getIsoDatetime, getString, isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const updateHotelReservationTool: WebMcpTool = {
  name: 'update_hotel_reservation',
  title: 'Update hotel reservation dates',
  description:
    'Shift the check-in of the traveler’s existing hotel reservation. ' +
    'Input: { reservation_id, new_check_in }. Check-out moves to keep the ' +
    'same nights; price unchanged. Must not precede the confirmed flight’s ' +
    'arrival. Re-sending the current date is safe (idempotent).',
  inputSchema: {
    type: 'object',
    properties: {
      reservation_id: {
        type: 'string',
        description: 'Reservation id, e.g. "HTL-R001".',
      },
      new_check_in: {
        type: 'string',
        description:
          'New stay start. ISO 8601 with UTC offset (Miami -04:00). Must ' +
          'not precede the confirmed flight’s arrival date.',
      },
    },
    required: ['reservation_id', 'new_check_in'],
    additionalProperties: false,
  },
  execute: async (input) => {
    const result = await executeUpdate(input)
    logToolCall({ tool: 'update_hotel_reservation', at: nowIso(), input, result })
    return result
  },
}

/** Add whole days to an ISO-with-offset string, preserving its time+offset. */
export function shiftDays(iso: string, days: number): string {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${shifted.toISOString().slice(0, 10)}T${iso.slice(11)}`
}

function reservationResult(res: HotelReservation, idempotent: boolean) {
  const hotel = hotelById(loadHotelsDataset().hotels, res.hotelId)
  return {
    ok: true as const,
    status: 'updated' as const,
    reservation_id: res.reservationId,
    hotel_id: res.hotelId,
    hotel_name: hotel ? hotel.name : res.hotelId,
    check_in: res.checkInIso,
    check_out: res.checkOutIso,
    nights: res.nights,
    price_per_night_usd: res.pricePerNightUsd,
    total_usd: res.totalUsd,
    updated_at: res.updatedAtIso,
    ...(idempotent ? { idempotent: true as const } : {}),
    note: 'Simulated reservation (no backend): does not survive a page reload.',
  }
}

async function executeUpdate(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['reservation_id', 'new_check_in'])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: reservation_id, new_check_in.`,
    }
  }

  const id = getString(input, 'reservation_id')
  if (!id.ok) return { ok: false, code: 'INVALID_INPUT', error: id.error }
  const newCheckIn = getIsoDatetime(input, 'new_check_in', { required: true })
  // required:true guarantees the value exists; the undefined check narrows
  // the Validated<string | undefined> type for the rest of the function.
  if (!newCheckIn.ok || newCheckIn.value === undefined) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: newCheckIn.ok ? 'Field "new_check_in" is required.' : newCheckIn.error,
    }
  }

  const existing = getHotelReservation(id.value)
  if (!existing) {
    const active = getSnapshot().hotelReservations.map((r) => r.reservationId)
    return {
      ok: false,
      code: 'NOT_FOUND',
      error: `Unknown reservation_id "${id.value}". Active reservations: ${active.join(', ') || 'none'} (${active.length} total).`,
    }
  }

  // Cross-tool validation (T6 AC5) runs BEFORE the idempotency check
  // (reviewer finding 2): if a flight confirmed after the hotel was last
  // set now invalidates the STORED date, re-sending that date must error
  // and prompt a real update — not return idempotent:true over stale state.
  const booking = latestBooking()
  if (booking) {
    const flight = booking.itinerary['flight'] as { arrive_iso?: string } | undefined
    const arrival = flight?.arrive_iso
    if (arrival && newCheckIn.value.slice(0, 10) < arrival.slice(0, 10)) {
      return {
        ok: false,
        code: 'CHECK_IN_BEFORE_ARRIVAL',
        error: `New check-in ${newCheckIn.value} precedes the confirmed flight’s arrival (${arrival}). Check in on or after the arrival date.`,
      }
    }
  }

  // Deterministic idempotency: same instant (any offset spelling) → same
  // stored result, updated_at untouched (confirm_booking convention).
  if (Date.parse(newCheckIn.value) === Date.parse(existing.checkInIso)) {
    return reservationResult(existing, true)
  }

  const updated: HotelReservation = {
    ...existing,
    checkInIso: newCheckIn.value,
    checkOutIso: shiftDays(newCheckIn.value, existing.nights),
    updatedAtIso: nowIso(),
  }
  setHotelReservation(updated)
  return reservationResult(updated, false)
}

export function registerUpdateHotelReservation() {
  return registerTool(updateHotelReservationTool)
}
