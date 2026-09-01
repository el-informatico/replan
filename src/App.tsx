import { useEffect, useState } from 'react'

import { buildCostBreakdown } from './domain/trip.ts'
import type { FlightSummary } from './domain/search.ts'
import { registerCalculateTotalCost } from './tools/cost.ts'
import { registerConfirmBooking } from './tools/confirm.ts'
import { registerUpdateConstraints } from './tools/constraints.ts'
import { registerUpdateHotelReservation } from './tools/hotel-reservation.ts'
import { registerSearchHotels } from './tools/hotels.ts'
import { registerHoldReservation } from './tools/hold.ts'
import { registerNotifyContact } from './tools/notify.ts'
import { registerPing } from './tools/ping.ts'
import { registerSearchFlights } from './tools/search.ts'
import { registerSearchFlightsSemantic } from './tools/semantic-search.ts'
import { registerGenerateItinerarySummary } from './tools/summary.ts'
import { registerBookGroundTransport } from './tools/transport.ts'
import {
  subscribeToolLog,
  type ToolLogEntry,
  type ToolRegistrationStatus,
} from './tools/webmcp.ts'
import {
  getSnapshot,
  now,
  subscribe,
  type StoreSnapshot,
} from './state/store.ts'

const MAX_LOG = 25

export default function App() {
  const [statuses, setStatuses] = useState<ToolRegistrationStatus[]>([])
  const [log, setLog] = useState<ToolLogEntry[]>([])
  const [snap, setSnap] = useState<StoreSnapshot>(() => getSnapshot())

  useEffect(() => {
    // Tools die with the document — register on every load.
    let cancelled = false
    Promise.all([
      registerPing(),
      registerSearchFlights(),
      registerHoldReservation(),
      registerUpdateConstraints(),
      registerConfirmBooking(),
      registerSearchHotels(),
      registerUpdateHotelReservation(),
      registerBookGroundTransport(),
      registerNotifyContact(),
      registerCalculateTotalCost(),
      registerGenerateItinerarySummary(),
      registerSearchFlightsSemantic(),
    ]).then((all) => {
      if (!cancelled) setStatuses(all)
    })
    const unsubscribeLog = subscribeToolLog((entry) => {
      setLog((prev) => [entry, ...prev].slice(0, MAX_LOG))
    })
    const unsubscribeStore = subscribe(() => setSnap(getSnapshot()))
    return () => {
      cancelled = true
      unsubscribeLog()
      unsubscribeStore()
    }
  }, [])

  // Cosmetic countdown only — expiry itself is enforced lazily by the store.
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (snap.holds.length === 0) return
    const t = window.setInterval(() => {
      forceTick((n) => n + 1)
      setSnap(getSnapshot())
    }, 1000)
    return () => window.clearInterval(t)
  }, [snap.holds.length])

  return (
    <main className="shell">
      <h1>Replan</h1>
      <p className="tagline">
        Agentic travel recovery — a site built to be operated by an AI agent
        through WebMCP tools.
      </p>

      {snap.bookings.length > 0 && (
        <ItineraryCard booking={snap.bookings[snap.bookings.length - 1]!} />
      )}

      <TripTotalCard snap={snap} />

      <section aria-label="Tool registration status" className="card">
        <h2>Agent tools</h2>
        <ul className="tool-list">
          {statuses.map((s) => (
            <li key={s.tool} className={`tool tool-${s.status}`}>
              <span className="tool-name">{s.tool}</span>{' '}
              <span className="tool-status">{s.status}</span>
              {s.status !== 'registered' && (
                <p className="tool-detail">{s.detail}</p>
              )}
            </li>
          ))}
        </ul>
        {statuses.some((s) => s.status === 'registered') && (
          <p className="muted">
            Ask your agent: “<em>What tools does this page provide? Call
            ping.</em>” or jump straight to “<em>help me rebook the cancelled
            flight</em>” — every call shows up below as it happens.
          </p>
        )}
      </section>

      <section aria-label="Active constraints" className="card">
        <h2>Active constraints</h2>
        <dl className="kv">
          <dt>destinations</dt>
          <dd>{snap.constraints.destinationAirports.join(' or ')}</dd>
          <dt>arrive before</dt>
          <dd>{snap.constraints.arriveBefore}</dd>
          <dt>max price</dt>
          <dd>${snap.constraints.maxPriceUsd}</dd>
          <dt>max layover</dt>
          <dd>{snap.constraints.maxLayoverHours} h</dd>
          <dt>preferred time</dt>
          <dd>{snap.constraints.preferredTime ?? '—'}</dd>
        </dl>
        <p className="muted">Updated live via the update_constraints tool.</p>
      </section>

      {snap.holds.length > 0 && (
        <section aria-label="Active holds" className="card">
          <h2>Held seats</h2>
          <ul className="hold-list">
            {snap.holds.map((h) => (
              <li key={h.flightId} className="hold">
                <span className="tool-name">{h.flightId}</span>
                <span className="countdown">{countdown(h.expiresAt)}</span>
                <span className="muted">
                  expires {new Date(h.expiresAt).toISOString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Search results" className="card">
        <h2>Results</h2>
        {snap.lastSearch === null ? (
          <p className="muted">
            No search yet. When the agent calls search_flights or
            update_constraints, results appear here live.
          </p>
        ) : (
          <>
            <p className="muted">
              {snap.lastSearch.results.length} flight
              {snap.lastSearch.results.length === 1 ? '' : 's'} ·{' '}
              {snap.lastSearch.via === 'update_constraints'
                ? 'after constraint update'
                : 'from search'}
            </p>
            <ul className="flight-list">
              {snap.lastSearch.results.map((f) => (
                <FlightRow
                  key={f.id}
                  f={f}
                  held={snap.holds.some((h) => h.flightId === f.id)}
                  booked={snap.bookings.some((b) => b.flightId === f.id)}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {snap.lastHotelSearch !== null && (
        <section aria-label="Hotel results" className="card">
          <h2>Hotel results</h2>
          <p className="muted">
            {snap.lastHotelSearch.results.length} hotel
            {snap.lastHotelSearch.results.length === 1 ? '' : 's'} · cheapest
            first · from search_hotels
          </p>
          <ul className="flight-list">
            {snap.lastHotelSearch.results.map((h) => (
              <li key={h.id} className="flight">
                <div className="flight-main">
                  <span className="tool-name">{h.id}</span>
                  <span className="flight-route">{h.name}</span>
                  <span className="badge">{h.near_airport}</span>
                </div>
                <div className="flight-detail">
                  {h.city} · {h.zone} · {h.star_rating}★ · {h.guest_rating} ·{' '}
                  {h.rooms_left} room{h.rooms_left === 1 ? '' : 's'} left
                  {h.total_stay_usd !== undefined
                    ? ` · $${h.total_stay_usd} for ${h.nights} night${h.nights === 1 ? '' : 's'}`
                    : ''}
                </div>
                <div className="flight-detail flight-price">
                  ${h.price_per_night_usd}/night
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snap.hotelReservations.length > 0 && (
        <section aria-label="Hotel reservation" className="card">
          <h2>Hotel reservation</h2>
          {snap.hotelReservations.map((r) => (
            <HotelReservationLine key={r.reservationId} reservation={r} />
          ))}
          <p className="muted">
            Seeded from the original trip; shifted live via
            update_hotel_reservation.
          </p>
        </section>
      )}

      {snap.transportBooking !== null && (
        <section aria-label="Ground transport" className="card">
          <h2>Ground transport</h2>
          <p>
            <span className="tool-name">{snap.transportBooking.bookingRef}</span>{' '}
            {snap.transportBooking.type} · {snap.transportBooking.fromAirport} →{' '}
            {snap.transportBooking.toZone} · ${snap.transportBooking.priceUsd}
          </p>
          <p className="muted">
            pickup {snap.transportBooking.pickupIso} · ~
            {snap.transportBooking.estTravelMinutes} min · drop-off{' '}
            {snap.transportBooking.estDropoffIso}
          </p>
        </section>
      )}

      {snap.notifications.length > 0 && (
        <section aria-label="Notifications sent" className="card">
          <h2>Notifications (simulated)</h2>
          <ul className="hold-list">
            {snap.notifications.map((n) => (
              <li key={n.notificationId} className="hold">
                <span className="tool-name">{n.notificationId}</span>
                <span>
                  {n.channel} → {n.recipientTarget}
                </span>
                <span className="muted">{n.sentAtIso}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Live tool-call log" className="card">
        <h2>Tool-call log</h2>
        {log.length === 0 ? (
          <p className="muted">No tool calls yet.</p>
        ) : (
          <ul className="log-list">
            {log.map((e, i) => (
              <li key={`${e.at}-${i}`} className="log-entry">
                <span className="log-tool">{e.tool}</span>{' '}
                <span className="log-time">{e.at}</span>
                <pre>{JSON.stringify(e.result)}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="phase-note">
        Phase 4: semantic flight search joins the flow — the same rebooking
        options, searchable in natural language via a live Convex vector
        index (Gemini embeddings). Twelve tools in total (+ the Phase 0 ping
        smoke test); everything else stays simulated.
      </p>
    </main>
  )
}

function FlightRow({
  f,
  held,
  booked,
}: {
  f: FlightSummary
  held: boolean
  booked: boolean
}) {
  return (
    <li className={`flight ${held ? 'is-held' : ''} ${booked ? 'is-booked' : ''}`}>
      <div className="flight-main">
        <span className="tool-name">{f.id}</span>
        <span className="flight-route">{f.route}</span>
        {held && <span className="badge badge-held">held</span>}
        {booked && <span className="badge badge-booked">booked</span>}
      </div>
      <div className="flight-detail">
        {f.airline_code} · {f.depart_iso} → {f.arrive_iso} ·{' '}
        {f.stops === 0 ? 'nonstop' : `${f.total_layover_minutes}m layover`} ·{' '}
        {f.cabin} · {f.seats_left} seat{f.seats_left === 1 ? '' : 's'} left
      </div>
      <div className="flight-detail flight-price">${f.price_usd}</div>
    </li>
  )
}

function ItineraryCard({
  booking,
}: {
  booking: StoreSnapshot['bookings'][number]
}) {
  const it = booking.itinerary as {
    status?: string
    confirmation_ref?: string
    confirmed_at?: string
    flight?: { id: string; route: string; depart_iso: string; arrive_iso: string; segments?: { flight_number: string; from: string; to: string; depart_iso: string; arrive_iso: string }[] }
    price_usd?: number
  }
  return (
    <section aria-label="Reservation confirmed" className="card card-confirmed">
      <h2>Reservation confirmed ✓</h2>
      <p className="it-ref">{it.confirmation_ref}</p>
      {it.flight && (
        <p>
          <span className="tool-name">{it.flight.id}</span> {it.flight.route} ·{' '}
          {it.flight.depart_iso} → {it.flight.arrive_iso} · ${it.price_usd}
        </p>
      )}
      {it.flight?.segments && it.flight.segments.length > 0 && (
        <ol className="segments">
          {it.flight.segments.map((s) => (
            <li key={s.flight_number}>
              {s.flight_number}: {s.from} {s.depart_iso} → {s.to} {s.arrive_iso}
            </li>
          ))}
        </ol>
      )}
      <p className="muted">Confirmed {it.confirmed_at}</p>
    </section>
  )
}

function countdown(expiresAt: number): string {
  const ms = expiresAt - now()
  if (ms <= 0) return 'expired'
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}:${String(s).padStart(2, '0')} left`
}

/** Running total — the grocery-demo pattern: recomputed live from the store
 *  via the same shared breakdown the tools use (D010). */
function TripTotalCard({ snap }: { snap: StoreSnapshot }) {
  const breakdown = buildCostBreakdown(snap)
  const over = !breakdown.budget.within_budget
  return (
    <section aria-label="Trip running total" className={`card ${over ? 'card-over-budget' : ''}`}>
      <h2>Trip total</h2>
      <ul className="total-list">
        {breakdown.items.map((i) => (
          <li key={`${i.kind}-${i.id}`} className="total-line">
            <span>
              <span className="tool-name">{i.kind}</span> {i.description}
            </span>
            <span className="flight-price">${i.cost_usd}</span>
          </li>
        ))}
        {breakdown.items.length === 0 && (
          <li className="total-line muted">Nothing booked yet.</li>
        )}
      </ul>
      <p className={`total-line total-sum ${over ? 'total-over' : 'total-under'}`}>
        <span>
          ${breakdown.total_usd} of ${breakdown.budget.max_price_usd} budget
        </span>
        <span className={`badge ${over ? 'badge-held' : 'badge-booked'}`}>
          {over
            ? `$${breakdown.budget.delta_usd} over`
            : `$${-breakdown.budget.delta_usd} left`}
        </span>
      </p>
      <p className="muted">
        Live via calculate_total_cost’s breakdown — budget is the stored
        max-price constraint (update_constraints).
      </p>
      {breakdown.multiple_bookings_detected && (
        <p className="muted">
          Multiple flight bookings detected — the total uses the latest;
          superseded: {breakdown.superseded_flight_ids!.join(', ')}.
        </p>
      )}
    </section>
  )
}

function HotelReservationLine({
  reservation,
}: {
  reservation: StoreSnapshot['hotelReservations'][number]
}) {
  return (
    <p>
      <span className="tool-name">{reservation.reservationId}</span>{' '}
      {reservation.hotelId} · check-in {reservation.checkInIso} · check-out{' '}
      {reservation.checkOutIso} · {reservation.nights} night
      {reservation.nights === 1 ? '' : 's'} · ${reservation.totalUsd}
      {reservation.updatedAtIso !== null && (
        <span className="muted"> · updated {reservation.updatedAtIso}</span>
      )}
    </p>
  )
}
