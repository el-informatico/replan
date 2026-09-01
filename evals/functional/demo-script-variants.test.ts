/**
 * Cross-document consistency for the twelve-tool demo SCRIPT VARIANTS.
 *
 * demo-script.test.ts pins the LONG script's values against the real
 * tool modules. The medium and short variants (recording/delivery
 * variants: condensed narration, pasted prompts, jump-cut gates) are
 * NOT executed there — this file is what keeps them from silently
 * drifting: it asserts that all three documents agree on everything
 * the dispatch declared invariant — the tool-call turn vector, every
 * tool name and argument string, every pinned JSON fragment (all
 * backticked values, in order), every human turn's text, the 5 gate
 * positions, and the semantic-search pacing buffer — and that agent
 * narration only ever CONDENSES (words per turn: long ≥ medium ≥
 * short). Transitively, whatever demo-script.test.ts verifies against
 * the modules stays true for every variant.
 *
 * Guarded explicitly (mutation-tested): tool-call turns, names and
 * arguments (backticked spans), pinned JSON fragments, UNQUOTED turn
 * prose such as output summaries and the turn-16 evidence note
 * (skeleton equality), human text, gate positions, the semantic buffer,
 * narration monotonicity, and money/score/flight-id tokens spoken in a
 * variant's narration (must already appear in the long turn).
 * Deliberately NOT guarded: narration wording itself — that is the
 * variants' whole point.
 *
 * Re-run alone (add --reporter=verbose to also print the agreement
 * table — plain runs suppress console output in vitest 4):
 *   npx vitest run evals/functional/demo-script-variants.test.ts --reporter=verbose
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const VARIANTS = {
  long: 'twelve-tool-demo-script.md',
  medium: 'twelve-tool-demo-script-medium.md',
  short: 'twelve-tool-demo-script-short.md',
} as const

const EXPECTED_CALL_TURNS = [2, 4, 6, 10, 12, 16, 20, 22, 26, 30, 34, 36]
const EXPECTED_GATE_TURNS = [6, 12, 22, 26, 30]
const SEMANTIC_TURN = 16

interface ParsedDoc {
  /** full scripted body after the first `---`, before any `## ` tail */
  body: string
  /** index === turn number; block 0 is the preamble before TURN 1 */
  turnBlocks: string[]
  /** turn numbers whose block carries the `**Tool call:**` marker */
  callTurns: number[]
  /** turn numbers whose block carries the gate marker */
  gateTurns: number[]
  /** ordered backticked spans per turn (the pinned call + JSON values) */
  spansByTurn: Map<number, string[]>
  /** normalized text of each human turn */
  humanByTurn: Map<number, string>
}

function parseDoc(file: string): ParsedDoc {
  const full = readFileSync(fileURLToPath(new URL(`../../docs/demo/${file}`, import.meta.url)), 'utf8')
  const doc = full.slice(full.indexOf('\n---\n') + 1)
  const body = doc.split(/\n## /)[0]
  const blocks = body.split(/\*\*TURN \d+ —/)
  const callTurns: number[] = []
  const gateTurns: number[] = []
  const spansByTurn = new Map<number, string[]>()
  const humanByTurn = new Map<number, string>()
  for (let i = 1; i < blocks.length; i++) {
    const turn = i
    const block = blocks[i]!
    if (block.startsWith(' HUMAN')) {
      humanByTurn.set(turn, block.replace(/^\s*HUMAN:\*\*\s*/, '').replace(/\s+/g, ' ').trim())
      continue
    }
    if (block.includes('**Tool call:**')) callTurns.push(turn)
    if (block.includes('[confirmation gate: human says yes]')) gateTurns.push(turn)
    spansByTurn.set(turn, [...block.matchAll(/`([^`]+)`/g)].map((m) => m[1]!))
  }
  return { body: doc, turnBlocks: blocks, callTurns, gateTurns, spansByTurn, humanByTurn }
}

const parsed = { long: parseDoc(VARIANTS.long), medium: parseDoc(VARIANTS.medium), short: parseDoc(VARIANTS.short) }

/** Narration words in an agent turn: quote contents after backtick-stripping —
 * the corrected Phase 5 counting method, applied per turn. */
function narrationWords(p: ParsedDoc, turn: number): number {
  const block = p.turnBlocks[turn]!
  const withoutBackticks = block.replace(/`[^`]*`/g, ' ')
  const quotes = withoutBackticks.match(/"([^"]*)"/g) ?? []
  return quotes.reduce((n, q) => n + q.replace(/"/g, '').trim().split(/\s+/).filter(Boolean).length, 0)
}

/** Human-turn words: full block text after header stripping (same method). */
function humanWords(p: ParsedDoc, turn: number): number {
  return (p.humanByTurn.get(turn) ?? '').split(/\s+/).filter(Boolean).length
}

/**
 * The variant-invariant "skeleton" of an agent turn: annotation lines
 * stripped (delivery notes differ per variant by design), backticked
 * spans and quoted narration removed — whatever remains is unquoted
 * turn prose (output summaries, the turn-16 evidence note, markers)
 * and must be IDENTICAL across all three documents. Without this, a
 * drift in e.g. the un-backticked "($198/$221/$267/$289)" summary or
 * the evidence note's scores would pass the span checks unnoticed.
 */
function skeleton(block: string): string {
  return block
    .replace(/\n?\[gate response:[^\]]*\]/g, ' ')
    .replace(/\n?\[JUMP-CUT[^\]]*\]/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Money / similarity-score / flight-id tokens — the pinned values that
 * can legitimately appear inside spoken narration. A variant may DROP
 * them; it may never introduce one the long turn does not contain. */
const VALUE_TOKEN = /\$[\d,.]+|\b0\.\d{2,3}\b|\bFL-\d{3}\b/g
function valueTokens(text: string): Set<string> {
  return new Set(text.match(VALUE_TOKEN) ?? [])
}
function narrationText(p: ParsedDoc, turn: number): string {
  const withoutBackticks = p.turnBlocks[turn]!.replace(/`[^`]*`/g, ' ')
  return (withoutBackticks.match(/"[^"]*"/g) ?? []).join(' ')
}

describe('demo script variants — per-document structure (all three docs)', () => {
  for (const [key, p] of Object.entries(parsed)) {
    it(`${VARIANTS[key as keyof typeof VARIANTS]}: 36 turns (18 human / 18 agent), 12 calls, 5 gates`, () => {
      const humans = p.body.match(/\*\*TURN \d+ — HUMAN/g) ?? []
      const agents = p.body.match(/\*\*TURN \d+ — AGENT/g) ?? []
      expect(humans.length).toBe(18)
      expect(agents.length).toBe(18)
      const numbers = [...p.body.matchAll(/\*\*TURN (\d+) —/g)].map((m) => Number(m[1]))
      expect(numbers).toEqual(Array.from({ length: 36 }, (_, i) => i + 1))
      expect(p.body.match(/\*\*Tool call:\*\*/g)?.length).toBe(12)
      expect(p.body.match(/\[confirmation gate: human says yes\]/g)?.length).toBe(5)
      expect(p.callTurns).toEqual(EXPECTED_CALL_TURNS)
      expect(p.gateTurns).toEqual(EXPECTED_GATE_TURNS)
    })

    it(`${VARIANTS[key as keyof typeof VARIANTS]}: semantic call at turn ${SEMANTIC_TURN} keeps its buffer`, () => {
      for (const other of p.callTurns) {
        if (other === SEMANTIC_TURN) continue
        expect(Math.abs(other - SEMANTIC_TURN), `turn ${other} too close`).toBeGreaterThanOrEqual(2)
      }
      expect(p.turnBlocks[SEMANTIC_TURN - 1]!).not.toContain('**Tool call:**')
      expect(p.turnBlocks[SEMANTIC_TURN + 1]!).not.toContain('**Tool call:**')
      const call = p.spansByTurn.get(SEMANTIC_TURN)![0]!
      expect(call).toBe('search_flights_semantic({query:"business class with a bed"})')
    })
  }
})

describe('demo script variants — cross-document agreement (the drift guard)', () => {
  it('human turn text is byte-identical across long / medium / short', () => {
    for (let t = 1; t <= 36; t += 2) {
      const l = parsed.long.humanByTurn.get(t)!
      expect(parsed.medium.humanByTurn.get(t), `turn ${t} medium`).toBe(l)
      expect(parsed.short.humanByTurn.get(t), `turn ${t} short`).toBe(l)
    }
  })

  it('every tool call, argument string, and pinned JSON fragment (all backticked spans) is identical across the three docs', () => {
    for (let t = 2; t <= 36; t += 2) {
      const l = parsed.long.spansByTurn.get(t)!
      const m = parsed.medium.spansByTurn.get(t)!
      const s = parsed.short.spansByTurn.get(t)!
      expect(m, `turn ${t} medium spans`).toEqual(l)
      expect(s, `turn ${t} short spans`).toEqual(l)
    }
  })

  it('agent narration only condenses: words per turn long ≥ medium ≥ short', () => {
    for (let t = 2; t <= 36; t += 2) {
      const l = narrationWords(parsed.long, t)
      const m = narrationWords(parsed.medium, t)
      const s = narrationWords(parsed.short, t)
      expect(m, `turn ${t}: medium must not exceed long`).toBeLessThanOrEqual(l)
      expect(s, `turn ${t}: short must not exceed medium`).toBeLessThanOrEqual(m)
    }
  })

  it('unquoted turn prose (output summaries, evidence notes, markers) is identical across the three docs', () => {
    // The skeleton keeps only what is NOT annotation, NOT backticked
    // span, and NOT quoted narration — the un-backticked residue such
    // as turn 10's "($198/$221/$267/$289)" summary and turn 16's
    // evidence note. Mutation-tested: without this check, drift there
    // passes the span comparisons unnoticed.
    for (let t = 2; t <= 36; t += 2) {
      const l = skeleton(parsed.long.turnBlocks[t]!)
      expect(skeleton(parsed.medium.turnBlocks[t]!), `turn ${t} medium skeleton`).toBe(l)
      expect(skeleton(parsed.short.turnBlocks[t]!), `turn ${t} short skeleton`).toBe(l)
    }
  })

  it('spoken pinned values never mutate: money/score/flight-id tokens in variant narration exist in the long turn', () => {
    for (let t = 2; t <= 36; t += 2) {
      const longTokens = valueTokens(parsed.long.turnBlocks[t]!)
      for (const key of ['medium', 'short'] as const) {
        for (const token of valueTokens(narrationText(parsed[key], t))) {
          expect(longTokens.has(token), `${key} turn ${t} speaks ${token}, absent from the long turn`).toBe(true)
        }
      }
    }
  })

  it('prints the literal agreement table (evidence)', () => {
    const lines: string[] = []
    lines.push('variant-consistency: turn | tool | spans | next-human | L/M/S narration words')
    for (let t = 2; t <= 36; t += 2) {
      const spans = parsed.long.spansByTurn.get(t)!
      const call = spans[0] ?? ''
      const tool = call.includes('(') ? call.slice(0, call.indexOf('(')) : '(result turn)'
      const spansL = spans.length
      const spansM = parsed.medium.spansByTurn.get(t)!.length
      const spansS = parsed.short.spansByTurn.get(t)!.length
      const humanAgrees =
        t < 36
          ? parsed.long.humanByTurn.get(t + 1) === parsed.medium.humanByTurn.get(t + 1) &&
            parsed.long.humanByTurn.get(t + 1) === parsed.short.humanByTurn.get(t + 1)
          : true
      lines.push(
        `  T${String(t).padStart(2)} | ${tool.padEnd(26)} | spans L/M/S ${spansL}/${spansM}/${spansS} | next-human ${t < 36 ? (humanAgrees ? 'same' : 'DIFFERS') : 'n/a   '} | ${narrationWords(parsed.long, t)}/${narrationWords(parsed.medium, t)}/${narrationWords(parsed.short, t)}`,
      )
    }
    lines.push(
      `  call turns: L [${parsed.long.callTurns}] M [${parsed.medium.callTurns}] S [${parsed.short.callTurns}]`,
    )
    lines.push(
      `  gate turns: L [${parsed.long.gateTurns}] M [${parsed.medium.gateTurns}] S [${parsed.short.gateTurns}]`,
    )
    const totals = (p: ParsedDoc) => {
      let h = 0
      let a = 0
      for (let t = 1; t <= 36; t++) {
        if (p.humanByTurn.has(t)) h += humanWords(p, t)
        else a += narrationWords(p, t)
      }
      return `${h + a} (${h}H+${a}A)`
    }
    lines.push(
      `  totals (parser method): long ${totals(parsed.long)}, medium ${totals(parsed.medium)}, short ${totals(parsed.short)}`,
    )
    console.log(lines.join('\n'))
    expect(parsed.medium.callTurns).toEqual(parsed.long.callTurns)
    expect(parsed.short.callTurns).toEqual(parsed.long.callTurns)
  })
})
