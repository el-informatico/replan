import { useEffect, useState } from 'react'

import type { FlightSummary } from './domain/search.ts'
import { registerConfirmBooking } from './tools/confirm.ts'
import { registerUpdateConstraints } from './tools/constraints.ts'
import { registerHoldReservation } from './tools/hold.ts'
import { registerPing } from './tools/ping.ts'
import { registerSearchFlights } from './tools/search.ts'
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
        Phase 1: flight tools live — search_flights, hold_reservation,
        update_constraints, confirm_booking (+ the Phase 0 ping smoke test).
        Hotels, ground transport, notifications and cost summary arrive in
        later phases.
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
