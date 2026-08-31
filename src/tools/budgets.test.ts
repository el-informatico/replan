import { describe, expect, it } from 'vitest'

import { confirmBookingTool } from './confirm.ts'
import { updateConstraintsTool } from './constraints.ts'
import { holdReservationTool } from './hold.ts'
import { pingTool } from './ping.ts'
import { searchFlightsTool } from './search.ts'

/**
 * Computational enforcement of the authoring budgets from the research brief
 * (docs/research/webmcp-tool-authoring-brief.md): ≤500 chars per tool
 * description, ≤150 per parameter description, names within the spec charset
 * and the secure-tools advisory length. A regression here fails verify.sh.
 */

const TOOLS = [
  pingTool,
  searchFlightsTool,
  holdReservationTool,
  updateConstraintsTool,
  confirmBookingTool,
]

describe('tool authoring budgets', () => {
  it('every tool description is non-empty and ≤500 chars', () => {
    for (const t of TOOLS) {
      expect(t.description.length, t.name).toBeGreaterThan(0)
      expect(t.description.length, `${t.name}: ${t.description.length} chars`).toBeLessThanOrEqual(500)
    }
  })

  it('every parameter description is non-empty and ≤150 chars', () => {
    for (const t of TOOLS) {
      const props = (t.inputSchema['properties'] ?? {}) as Record<
        string,
        { description?: string }
      >
      for (const [key, p] of Object.entries(props)) {
        expect(p.description, `${t.name}.${key}`).toBeDefined()
        expect(
          p.description!.length,
          `${t.name}.${key}: ${p.description!.length} chars`,
        ).toBeLessThanOrEqual(150)
      }
    }
  })

  it('tool names fit the spec charset and advisory length', () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^[A-Za-z0-9_.-]{1,30}$/)
    }
  })

  it('tool names are unique across the page', () => {
    const names = TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
