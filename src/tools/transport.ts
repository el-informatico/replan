/**
 * book_ground_transport — Contract T7
 * (docs/plans/phase2-execution-plan.md §3). Cross-tool by design: the
 * pickup LOCATION and validation window derive from the confirmed flight
 * (latestBooking); the destination zone derives from the hotel reservation.
 * Pricing is pure (src/domain/transport.ts). Rebooking replaces the
 * singleton (D009) — no cancel tool exists, an error would dead-end.
 */

import {
  estimateTravelMinutes,
  fareFor,
  findFare,
  findRoute,
  loadGroundTransportDataset,
  TRANSPORT_TYPES,
  type TransportType,
} from '../domain/transport.ts'
import { hotelById, loadHotelsDataset } from '../domain/hotels.ts'
import {
  getSnapshot,
  getTransportBooking,
  latestBooking,
  nowIso,
  setTransportBooking,
  type TransportBooking,
} from '../state/store.ts'
import { getIsoDatetime, getString, isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

/** Pickup window relative to the confirmed flight's arrival. */
const MIN_AFTER_ARRIVAL_MS = 15 * 60_000
const MAX_AFTER_ARRIVAL_MS = 8 * 3_600_000

export const bookGroundTransportTool: WebMcpTool = {
  name: 'book_ground_transport',
  title: 'Book ground transport',
  description:
    'Book the airport-to-hotel ground leg once a flight is confirmed. ' +
    'Input: { type, pickup_time }. type: "taxi", "shuttle" (shared, ' +
    'cheapest), or "rideshare". Pickup must be 15 min to 8 h after the ' +
    'flight lands; route and price derive from the arrival airport and ' +
    'hotel zone. Re-booking replaces. Simulated.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: [...TRANSPORT_TYPES],
        description: 'Vehicle: "taxi", "shuttle" (shared, cheapest), or "rideshare".',
      },
      pickup_time: {
        type: 'string',
        description:
          'Pickup at the arrival airport. ISO 8601 with UTC offset. Must ' +
          'be 15 min to 8 h after the confirmed flight lands.',
      },
    },
    required: ['type', 'pickup_time'],
    additionalProperties: false,
  },
  execute: async (input) => {
    const result = await executeBook(input)
    logToolCall({ tool: 'book_ground_transport', at: nowIso(), input, result })
    return result
  },
}

async function executeBook(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['type', 'pickup_time'])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: type, pickup_time.`,
    }
  }

  const type = getString(input, 'type')
  if (!type.ok) return { ok: false, code: 'INVALID_INPUT', error: type.error }
  if (!TRANSPORT_TYPES.includes(type.value as TransportType)) {
    return {
      ok: false,
      code: 'UNKNOWN_TYPE',
      error: `Unknown type "${type.value}". This scenario offers: ${TRANSPORT_TYPES.join(', ')}.`,
    }
  }

  const pickup = getIsoDatetime(input, 'pickup_time', { required: true })
  if (!pickup.ok || pickup.value === undefined) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: pickup.ok ? 'Field "pickup_time" is required.' : pickup.error,
    }
  }

  // Cross-tool state: the arrival airport and validation window come from
  // the confirmed flight (D009 store — no parallel transport-side store).
  const booking = latestBooking()
  if (!booking) {
    return {
      ok: false,
      code: 'NO_CONFIRMED_FLIGHT',
      error:
        'No confirmed flight to anchor ground transport — the pickup point is the arrival airport. Hold and confirm a flight first (hold_reservation, then confirm_booking).',
    }
  }
  const flight = booking.itinerary['flight'] as
    | { arrive_iso?: string; segments?: { to: string }[] }
    | undefined
  const arrival = flight?.arrive_iso
  if (!arrival) {
    return { ok: false, code: 'NO_CONFIRMED_FLIGHT', error: 'Confirmed booking lacks an arrival time.' }
  }

  const pickupMs = Date.parse(pickup.value)
  if (pickupMs < Date.parse(arrival) + MIN_AFTER_ARRIVAL_MS) {
    return {
      ok: false,
      code: 'PICKUP_TOO_EARLY',
      error: `Pickup ${pickup.value} is too early — the flight lands at ${arrival}. Book at least 15 minutes after landing.`,
    }
  }
  if (pickupMs > Date.parse(arrival) + MAX_AFTER_ARRIVAL_MS) {
    return {
      ok: false,
      code: 'PICKUP_TOO_LATE',
      error: `Pickup ${pickup.value} is too late — the flight lands at ${arrival}. Book within 8 hours of landing.`,
    }
  }

  // Destination zone from the hotel reservation (the trip's known hotel).
  const snapshot = getSnapshot()
  const hotelRes = snapshot.hotelReservations[0]
  if (!hotelRes) {
    return {
      ok: false,
      code: 'NO_HOTEL_RESERVATION',
      error: 'No hotel reservation in state — the ground leg runs airport → hotel zone.',
    }
  }
  const hotel = hotelById(loadHotelsDataset().hotels, hotelRes.hotelId)
  const toZone = hotel ? hotel.zone : null
  if (!toZone) {
    return { ok: false, code: 'NO_HOTEL_RESERVATION', error: `Hotel ${hotelRes.hotelId} not found in the dataset.` }
  }

  const segments = flight?.segments ?? []
  const fromAirport = segments.length > 0 ? segments[segments.length - 1]!.to : null
  if (!fromAirport) {
    return { ok: false, code: 'NO_CONFIRMED_FLIGHT', error: 'Confirmed booking lacks arrival segments.' }
  }

  const gt = loadGroundTransportDataset()
  const route = findRoute(gt, fromAirport, toZone)
  const fare = findFare(gt, type.value)
  if (!route || !fare) {
    return {
      ok: false,
      code: 'NO_ROUTE',
      error: `No ${type.value} route ${fromAirport}→${toZone} in the dataset.`,
    }
  }

  const travel = estimateTravelMinutes(fare, route)
  const next: TransportBooking = {
    bookingRef: `RPLN-GT-${type.value.toUpperCase()}-${fromAirport}`,
    type: type.value as TransportType,
    fromAirport,
    toZone,
    pickupIso: pickup.value,
    estTravelMinutes: travel,
    estDropoffIso: new Date(pickupMs + travel * 60_000).toISOString(),
    priceUsd: fareFor(fare, route),
    bookedAtIso: nowIso(),
  }

  const previous = getTransportBooking()
  setTransportBooking(next)

  return {
    ok: true,
    status: 'booked',
    booking_ref: next.bookingRef,
    type: next.type,
    from_airport: next.fromAirport,
    to_zone: next.toZone,
    pickup_time: next.pickupIso,
    est_travel_minutes: next.estTravelMinutes,
    est_dropoff_iso: next.estDropoffIso,
    price_usd: next.priceUsd,
    ...(previous ? { replaced_previous: previous.bookingRef } : {}),
    note: 'Simulated booking (no backend): does not survive a page reload.',
  }
}

export function registerBookGroundTransport() {
  return registerTool(bookGroundTransportTool)
}
