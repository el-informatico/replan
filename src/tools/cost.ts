/**
 * calculate_total_cost — Contract T9 (docs/plans/phase2-execution-plan.md
 * §3). Read-only view over the store via the shared pure breakdown (D010);
 * the budget comes from the stored constraint, never the caller.
 */

import { bookedKinds, buildCostBreakdown, COST_KINDS, type CostKind } from '../domain/trip.ts'
import { getSnapshot, nowIso } from '../state/store.ts'
import { isRecord, unknownKeys } from './validate.ts'
import { logToolCall, registerTool, type WebMcpTool } from './webmcp.ts'

export const calculateTotalCostTool: WebMcpTool = {
  name: 'calculate_total_cost',
  title: 'Trip running total',
  description:
    'Running total across everything booked so far — flight, hotel, ground ' +
    'transport — checked against the budget update_constraints last set. ' +
    'Input: { items? } to total a subset (["flight","hotel","transport"]); ' +
    'omit it for everything booked. Returns a per-item breakdown, the ' +
    'total, and whether it fits the budget.',
  inputSchema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { type: 'string', enum: [...COST_KINDS] },
        description: 'Subset to total: "flight", "hotel", "transport". Omit for all booked items.',
      },
    },
    additionalProperties: false,
  },
  // Pure read of the store — the ping-precedent honest read-only annotation.
  annotations: { readOnlyHint: true },
  execute: async (input) => {
    const result = await executeCost(input)
    logToolCall({ tool: 'calculate_total_cost', at: nowIso(), input, result })
    return result
  },
}

async function executeCost(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isRecord(input)) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Input must be an object.' }
  }
  const extras = unknownKeys(input, ['items'])
  if (extras.length > 0) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Unknown field(s): ${extras.join(', ')}. Accepted: items.`,
    }
  }

  let kinds: readonly CostKind[] = COST_KINDS
  let explicit = false
  if (input['items'] !== undefined && input['items'] !== null) {
    explicit = true
    const raw = input['items']
    if (!Array.isArray(raw)) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        error: `Field "items" must be an array of: ${COST_KINDS.join(', ')} (got ${typeof raw}).`,
      }
    }
    const seen = new Set<string>()
    for (const member of raw) {
      if (typeof member !== 'string' || !(COST_KINDS as readonly string[]).includes(member)) {
        return {
          ok: false,
          code: 'INVALID_INPUT',
          error: `Unknown item "${String(member)}". Valid kinds: ${COST_KINDS.join(', ')}.`,
        }
      }
      if (seen.has(member)) {
        return { ok: false, code: 'INVALID_INPUT', error: `Duplicate item "${member}".` }
      }
      seen.add(member)
    }
    kinds = [...seen] as CostKind[]
  }

  const snapshot = getSnapshot()
  // NOT_BOOKED applies only to EXPLICITLY requested kinds — the default
  // call means "everything booked", which is never an error (T9 AC2).
  const available = new Set(bookedKinds(snapshot))
  const missing = explicit ? kinds.filter((k) => !available.has(k)) : []
  if (missing.length > 0) {
    const pointers: Record<CostKind, string> = {
      flight: 'hold_reservation + confirm_booking',
      hotel: 'update_hotel_reservation (or search_hotels to compare)',
      transport: 'book_ground_transport',
    }
    return {
      ok: false,
      code: 'NOT_BOOKED',
      error: `Nothing booked yet for: ${missing.join(', ')}. Book it first via ${missing
        .map((k) => pointers[k])
        .join(' / ')}.`,
    }
  }

  const breakdown = buildCostBreakdown(snapshot, kinds)
  return {
    ok: true,
    items: breakdown.items,
    total_usd: breakdown.total_usd,
    budget: breakdown.budget,
    note: 'Budget is the stored max-price constraint — update_constraints last set it (scenario default $650).',
  }
}

export function registerCalculateTotalCost() {
  return registerTool(calculateTotalCostTool)
}
