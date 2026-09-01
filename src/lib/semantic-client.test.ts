import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSemanticHits, setEndpointOverrideForTests } from './semantic-client.ts'

/**
 * Direct tests for the codebase's only network client (reviewer finding 5 —
 * every other test file mocks this module, so nothing executed its branches).
 * fetch is stubbed globally and the endpoint is driven via the test-only
 * override (vi.stubEnv cannot reach import.meta.env in Vite-transformed
 * sources — discovered when a stubbed-env test hit the LIVE endpoint via
 * .env.local leakage). No real network is touched.
 */

const ENDPOINT = 'https://stub.example/api/semantic-search'

function okBody(results: unknown[] = [], extra: Record<string, unknown> = {}) {
  return { ok: true, results, hits: results.length, embed_ms: 42, ...extra }
}

afterEach(() => {
  setEndpointOverrideForTests(undefined)
  vi.unstubAllGlobals()
})

describe('semantic-client — configuration', () => {
  it('missing VITE_CONVEX_SITE_URL -> SEMANTIC_SEARCH_UNAVAILABLE, never throws', async () => {
    setEndpointOverrideForTests('')
    const r = await fetchSemanticHits('cheap flight')
    expect(r).toEqual({
      ok: false,
      code: 'SEMANTIC_SEARCH_UNAVAILABLE',
      error: expect.stringContaining('VITE_CONVEX_SITE_URL'),
    })
  })
})

describe('semantic-client — response handling', () => {
  it('maps a good response to typed hits and filters malformed rows', async () => {
    setEndpointOverrideForTests('https://stub.example')
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(okBody([
        { flight_id: 'FL-001', text: 't', similarity_score: 0.7 },
        { flight_id: 7, text: 't', similarity_score: 0.7 }, // no string id
        { flight_id: 'FL-002', text: 't' }, // no score
      ])), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const r = await fetchSemanticHits('q')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.results.map((x) => x.flight_id)).toEqual(['FL-001'])
      expect(r.hits).toBe(3)
    }
    expect(fetchMock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('non-JSON body -> SEMANTIC_SEARCH_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })))
    const r = await fetchSemanticHits('q')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('SEMANTIC_SEARCH_UNAVAILABLE')
      expect(r.error).toContain('502')
    }
  })

  it('errors-as-data body with ok:false -> code and error preserved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: false, code: 'EMBEDDING_FAILED', error: 'HTTP 429' }),
          { status: 200 },
        ),
      ),
    )
    const r = await fetchSemanticHits('q')
    expect(r).toEqual({ ok: false, code: 'EMBEDDING_FAILED', error: 'HTTP 429' })
  })

  it('network rejection -> SEMANTIC_SEARCH_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    const r = await fetchSemanticHits('q')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('SEMANTIC_SEARCH_UNAVAILABLE')
      expect(r.error).toContain('ECONNRESET')
    }
  })
})

describe('semantic-client — abort and timeout', () => {
  it('caller abort surfaces as data with the aborted message', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: { signal: AbortSignal }) => {
        controller.abort()
        init.signal.throwIfAborted()
        throw new Error('unreachable')
      }),
    )
    const r = await fetchSemanticHits('q', controller.signal)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('aborted')
  })

  it('internal 8s timeout reports "timed out", not "unreachable" (reviewer finding 10)', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          (_url: unknown, init: { signal: AbortSignal }) =>
            new Promise((_resolve, reject) => {
              init.signal.addEventListener('abort', () =>
                reject(new DOMException('aborted', 'AbortError')),
              )
            }),
        ),
      )
      const pending = fetchSemanticHits('q')
      const assertion = expect(pending).resolves.toMatchObject({
        ok: false,
        error: expect.stringContaining('timed out after 8000 ms'),
      })
      await vi.advanceTimersByTimeAsync(8001)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
