import { useEffect, useState } from 'react'

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

const MAX_LOG = 25

export default function App() {
  const [statuses, setStatuses] = useState<ToolRegistrationStatus[]>([])
  const [log, setLog] = useState<ToolLogEntry[]>([])

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
    const unsubscribe = subscribeToolLog((entry) => {
      setLog((prev) => [entry, ...prev].slice(0, MAX_LOG))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return (
    <main className="shell">
      <h1>Replan</h1>
      <p className="tagline">
        Agentic travel recovery — a site built to be operated by an AI agent
        through WebMCP tools.
      </p>

      <section aria-label="Tool registration status" className="card">
        <h2>Agent tools</h2>
        {statuses.length === 0 && <p className="muted">Registering…</p>}
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
            ping.</em>” — activity shows up below as it happens.
          </p>
        )}
      </section>

      <section aria-label="Live tool-call log" className="card">
        <h2>Tool-call log</h2>
        {log.length === 0 ? (
          <p className="muted">
            No tool calls yet. When the agent calls a tool on this page, its
            input and result appear here live.
          </p>
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
        Phase 0: foundation — the <code>ping</code> smoke tool proves WebMCP
        discovery. Flight search/hold/confirm and the recovery scenario arrive
        in later phases.
      </p>
    </main>
  )
}
