/**
 * Tool 12 — search_flights_semantic.
 * Contract: docs/plans/phase4-execution-plan.md §3 (T11).
 *
 * The one live-backend tool (ADR-0006): embeds the query server-side
 * (Convex action -> Gemini), runs a real vector search, and hydrates rows
 * LOCALLY from flights.json by flight_id — the dataset stays the source of
 * truth. Every failure is errors-as-data; the agent always gets JSON.
 */

import { loadDataset } from '../domain/flights.ts'
import { toSummary } from '../domain/search.ts'
import { nowIso } from '../state/store.ts'
import { fetchSemanticHits } from '../lib/semantic-client.ts'
import { MAX_TOOL_RESULTS } from './payload.ts'
import { getString, isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

/**
 * Relevance floor, calibrated against the LIVE index (2026-08-31, prod
 * deployment, evidence in agent-memory/progress.md): on-topic natural
 * queries score 0.616–0.694 top-to-8th; off-topic garbage tops out at
 * 0.561–0.567. Gemini's cosine range is compressed — a naive 0.x floor
 * never fires. 0.60 separates the two measured bands; below it, "no good
 * match" is a valid empty result, not an error.
 */
const MIN_SIMILARITY = 0.6
const MAX_QUERY_CHARS = 200

export const searchFlightsSemanticTool: WebMcpTool = {
  name: 'search_flights_semantic',
  title: 'Semantic flight search',
  description:
    'Natural-language flight search over the same rebooking options as ' +
    'search_flights: describe what you want ("cheapest that lands early", ' +
    '"shortest layover", "red-eye is fine") and get matches ranked by ' +
    'semantic similarity via a live vector index. Falls back to ' +
    'errors-as-data if the index is unreachable.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Free text (max 200 chars) describing the flight you want — ' +
          'price, timing, layovers, vibe. Not a structured filter.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  // Reads a remote index and writes nothing to the page state (the ping
  // precedent); the invocation still lands in the Tool-call log card.
  annotations: { readOnlyHint: true },
  execute: async (input, options) => {
    const result = await executeSemanticSearch(input, options.signal)
    logToolCall({
      tool: 'search_flights_semantic',
      at: nowIso(),
      input,
      result,
    })
    return result
  },
}

async function executeSemanticSearch(
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['query'])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: query.`,
    }
  }
  const query = getString(input, 'query')
  if (!query.ok) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `${query.error} For structured filters use search_flights.`,
    }
  }
  const trimmed = query.value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_QUERY_CHARS) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error:
        `Field "query" must be 1-${MAX_QUERY_CHARS} characters after trimming ` +
        `(got ${trimmed.length}).`,
    }
  }

  const outcome = await fetchSemanticHits(trimmed, signal)
  if (!outcome.ok) {
    return { ok: false, code: outcome.code, error: outcome.error }
  }

  const relevant = outcome.results.filter(
    (r) => r.similarity_score >= MIN_SIMILARITY,
  )
  if (relevant.length === 0) {
    return {
      ok: true,
      count: 0,
      note: 'No semantically close flights for that phrasing — rephrase, or ' +
        'use search_flights with explicit filters (destination, price, times).',
      results: [],
    }
  }

  // Hydrate locally: the Convex row is {flight_id, text, score}; the flight
  // facts come from the static dataset (the source of truth per ADR-0006).
  const byId = new Map(loadDataset().flights.map((f) => [f.id, f]))
  const skipped: string[] = []
  const ranked = [...relevant].sort(
    (a, b) => b.similarity_score - a.similarity_score,
  )
  const hydrated = ranked.flatMap((hit) => {
    const flight = byId.get(hit.flight_id)
    if (!flight) {
      skipped.push(hit.flight_id)
      return []
    }
    const s = toSummary(flight)
    return [
      {
        id: s.id,
        airline: s.airline_code,
        // route encodes the stop count ("LIM→MIA (1-stop)") — same compact
        // projection as search_flights (payload.ts convention).
        route: s.route,
        departs: s.depart_iso,
        arrives: s.arrive_iso,
        price_usd: s.price_usd,
        similarity_score: Math.round(hit.similarity_score * 1000) / 1000,
      },
    ]
  })

  // Notes stay within the 1.5K output budget: the ranked/live marker and
  // the truncation notice swap (never stack) — with the shipped action
  // limit of 8, a truncation note plus a skip note cannot co-occur.
  const noteParts: string[] = []
  if (skipped.length > 0) {
    noteParts.push(
      `${skipped.length} result(s) referenced flight(s) missing from the ` +
        `local dataset and were skipped (${skipped.join(', ')}).`,
    )
  }
  const showing = hydrated.slice(0, MAX_TOOL_RESULTS)
  if (hydrated.length > showing.length) {
    noteParts.push(
      `Showing ${showing.length} of ${hydrated.length} — tighten the query to narrow.`,
    )
  } else {
    noteParts.push('Ranked by semantic similarity (live index).')
  }

  return {
    ok: true,
    count: relevant.length,
    results: showing,
    note: noteParts.join(' '),
  }
}

export function registerSearchFlightsSemantic() {
  return registerTool(searchFlightsSemanticTool)
}
