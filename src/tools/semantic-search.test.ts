import { beforeEach, describe, expect, it, vi } from 'vitest'

// The codebase's first network seam — mocked here so the tool's logic is
// unit-testable without Convex or Gemini (live behavior is proven by the
// Phase-4 curl smoke, not by vitest).
vi.mock('../lib/semantic-client.ts', () => ({
  fetchSemanticHits: vi.fn(),
}))

import { fetchSemanticHits } from '../lib/semantic-client.ts'
import { resetForTests } from '../state/store.ts'
import { searchFlightsSemanticTool } from './semantic-search.ts'

const mockFetch = vi.mocked(fetchSemanticHits)

const SIGNAL = new AbortController().signal
const CALL = { signal: SIGNAL } as Parameters<
  typeof searchFlightsSemanticTool.execute
>[1]

beforeEach(() => {
  resetForTests()
  mockFetch.mockReset()
})

function hit(flight_id: string, similarity_score: number) {
  return { flight_id, text: `corpus text for ${flight_id}`, similarity_score }
}

describe('search_flights_semantic tool — happy path', () => {
  it('returns hydrated compact rows with similarity_score, sorted desc', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      hits: 3,
      embed_ms: 120,
      results: [hit('FL-015', 0.62), hit('FL-016', 0.81), hit('FL-021', 0.7)],
    })
    const r = await searchFlightsSemanticTool.execute(
      { query: 'something cheap that gets in early' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(3)
    const results = r['results'] as Array<Record<string, unknown>>
    expect(results.map((x) => x['id'])).toEqual(['FL-016', 'FL-021', 'FL-015'])
    for (const row of results) {
      // Same compact projection as search_flights…
      expect(typeof row['airline']).toBe('string')
      expect(typeof row['route']).toBe('string')
      expect(typeof row['departs']).toBe('string')
      expect(typeof row['arrives']).toBe('string')
      expect(typeof row['price_usd']).toBe('number')
      // …plus the similarity score, 3-decimal rounded.
      expect(row['similarity_score']).toBeLessThanOrEqual(1)
      expect(row['similarity_score']).toBeGreaterThanOrEqual(0)
    }
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(1500)
    expect(String(r['note'])).toContain('semantic similarity')
  })

  it('passes the trimmed query to the seam with the abort signal', async () => {
    mockFetch.mockResolvedValue({ ok: true, hits: 0, embed_ms: 1, results: [] })
    await searchFlightsSemanticTool.execute(
      { query: '  red-eye, cheap  ' },
      CALL,
    )
    expect(mockFetch).toHaveBeenCalledWith('red-eye, cheap', SIGNAL)
  })
})

describe('search_flights_semantic tool — empty is valid, never an error', () => {
  it('all scores below the relevance floor -> count 0 with rephrase note', async () => {
    // 0.58/0.55 = the measured off-topic band (live calibration: garbage
    // tops out ~0.567, on-topic starts ~0.616) — floor is 0.60.
    mockFetch.mockResolvedValue({
      ok: true,
      hits: 2,
      embed_ms: 90,
      results: [hit('FL-001', 0.58), hit('FL-002', 0.55)],
    })
    const r = await searchFlightsSemanticTool.execute(
      { query: 'submarine rental' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(0)
    expect(r['results']).toEqual([])
    expect(String(r['note'])).toContain('rephrase')
  })

  it('seam returning zero hits -> same valid-empty shape', async () => {
    mockFetch.mockResolvedValue({ ok: true, hits: 0, embed_ms: 5, results: [] })
    const r = await searchFlightsSemanticTool.execute(
      { query: 'anything' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(0)
  })
})

describe('search_flights_semantic tool — hydration guards', () => {
  it('skips unknown flight ids and discloses them; count stays pre-skip', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      hits: 2,
      embed_ms: 50,
      results: [hit('FL-999', 0.9), hit('FL-016', 0.7)],
    })
    const r = await searchFlightsSemanticTool.execute(
      { query: 'panama connection' },
      CALL,
    )
    expect(r['ok']).toBe(true)
    expect(r['count']).toBe(2)
    const results = r['results'] as Array<Record<string, unknown>>
    expect(results.map((x) => x['id'])).toEqual(['FL-016'])
    expect(String(r['note'])).toContain('FL-999')
    expect(String(r['note'])).toContain('skipped')
  })

  it('caps at 8 rows with a showing note', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      hit(`FL-${String(i + 1).padStart(3, '0')}`, 0.9 - i * 0.025),
    )
    mockFetch.mockResolvedValue({ ok: true, hits: 10, embed_ms: 60, results: many })
    const r = await searchFlightsSemanticTool.execute(
      { query: 'anything at all' },
      CALL,
    )
    const results = r['results'] as unknown[]
    expect(results).toHaveLength(8)
    expect(String(r['note'])).toContain('Showing 8 of 10')
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(1500)
  })
})

describe('search_flights_semantic tool — errors-as-data passthrough', () => {
  it('seam unavailable -> SEMANTIC_SEARCH_UNAVAILABLE, never throws', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      code: 'SEMANTIC_SEARCH_UNAVAILABLE',
      error: 'Semantic search unreachable: boom',
    })
    const r = await searchFlightsSemanticTool.execute(
      { query: 'cheap flight' },
      CALL,
    )
    expect(r).toEqual({
      ok: false,
      code: 'SEMANTIC_SEARCH_UNAVAILABLE',
      error: 'Semantic search unreachable: boom',
    })
  })

  it('provider failure -> EMBEDDING_FAILED passthrough', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      code: 'EMBEDDING_FAILED',
      error: 'Embedding provider returned HTTP 429.',
    })
    const r = await searchFlightsSemanticTool.execute(
      { query: 'cheap flight' },
      CALL,
    )
    expect(r['code']).toBe('EMBEDDING_FAILED')
    expect(r['ok']).toBe(false)
  })
})

describe('search_flights_semantic tool — malformed input, never throws', () => {
  const garbage: unknown[] = [
    null,
    42,
    'x',
    [],
    { query: '' },
    { query: '   ' },
    { query: 7 },
    { query: 'ok', extra: 1 },
    { query: 'x'.repeat(201) },
  ]
  it.each(garbage)('returns INVALID_INPUT for %j', async (input) => {
    const r = await searchFlightsSemanticTool.execute(
      input as Record<string, unknown>,
      CALL,
    )
    expect(r['ok']).toBe(false)
    expect(r['code']).toBe('INVALID_INPUT')
    expect(typeof r['error']).toBe('string')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
