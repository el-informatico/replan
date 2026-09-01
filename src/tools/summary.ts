/**
 * generate_itinerary_summary — Contract T10
 * (docs/plans/phase2-execution-plan.md §3). The final-receipt moment:
 * flight + hotels + transport + notifications + the T9 cost breakdown in
 * one object. Read-only; never errors on partial state (errors-as-data
 * convention — a partial trip is data, not a failure).
 */

import { composeItinerary } from '../domain/trip.ts'
import { getSnapshot, nowIso } from '../state/store.ts'
import { isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const generateItinerarySummaryTool: WebMcpTool = {
  name: 'generate_itinerary_summary',
  title: 'Final itinerary receipt',
  description:
    'One consolidated receipt of the recovery: flight, hotel, transport, ' +
    'notifications, and the total vs budget — plus what is still missing ' +
    'and which tool books it. Stale legs are flagged. Safe any time: ' +
    'partial trips return status "partial", never an error. No parameters.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  // Pure read of the store (ping precedent).
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const result = await executeSummary(input)
    logToolCall({ tool: 'generate_itinerary_summary', at: nowIso(), input, result })
    return result
  },
}

async function executeSummary(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, [])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `This tool takes no parameters — remove: ${extras.join(', ')}.`,
    }
  }

  const summary = composeItinerary(getSnapshot())
  return {
    ok: true,
    ...summary,
    note: 'Final receipt of everything booked in this session (simulated state — it does not survive a page reload).',
  }
}

export function registerGenerateItinerarySummary() {
  return registerTool(generateItinerarySummaryTool)
}
