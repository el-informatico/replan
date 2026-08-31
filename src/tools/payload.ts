/**
 * Tool-output compaction.
 *
 * The research brief (docs/research/webmcp-tool-authoring-brief.md, from
 * Chrome secure-tools + evals guidance) budgets ~1.5K chars of tool output:
 * "only the minimum essential information the LLM needs for the next
 * action." Full flight summaries stay in the store (the UI renders those);
 * tool payloads carry the compact projection below, capped with a
 * showing-x-of-y note guiding the agent to narrow rather than page.
 */

import type { FlightSummary } from '../domain/search.ts'

export const MAX_TOOL_RESULTS = 10

export interface CompactFlight {
  id: string
  airline: string
  route: string
  departs: string
  arrives: string
  stops: number
  price_usd: number
}

export interface CompactedResults {
  total: number
  showing: number
  note?: string
  results: CompactFlight[]
}

export function compactResults(
  results: FlightSummary[],
  cap: number = MAX_TOOL_RESULTS,
): CompactedResults {
  const rows: CompactFlight[] = results.slice(0, cap).map((r) => ({
    id: r.id,
    airline: r.airline_code,
    route: r.route,
    departs: r.depart_iso,
    arrives: r.arrive_iso,
    stops: r.stops,
    price_usd: r.price_usd,
  }))
  const total = results.length
  return {
    total,
    showing: rows.length,
    ...(total > rows.length
      ? {
          note: `Showing ${rows.length} of ${total} matching flights, cheapest first — tighten max_price, max_layover_hours or arrive_before to narrow.`,
        }
      : {}),
    results: rows,
  }
}
