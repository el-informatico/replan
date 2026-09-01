/**
 * Browser-side seam to the live Convex semantic-search endpoint
 * (Phase 4, ADR-0006): native fetch, zero new runtime deps. This is the
 * codebase's first and only network client — kept in one file so unit tests
 * can mock the seam (vi.mock) without a global fetch stub.
 *
 * Every failure comes back as data ({ok:false, code, error}) — the WebMCP
 * tool layer must never receive a rejected promise from this module.
 */

export interface SemanticHit {
  flight_id: string
  text: string
  similarity_score: number
}

export type SemanticErrorCode =
  | 'INVALID_INPUT'
  | 'EMBEDDING_FAILED'
  | 'SEMANTIC_SEARCH_UNAVAILABLE'

export type SemanticSearchOutcome =
  | { ok: true; results: SemanticHit[]; hits: number; embed_ms: number }
  | { ok: false; code: SemanticErrorCode; error: string }

const TIMEOUT_MS = 8000

export function semanticEndpoint(): string | null {
  const base = import.meta.env.VITE_CONVEX_SITE_URL
  return typeof base === 'string' && base.length > 0
    ? `${base.replace(/\/+$/, '')}/api/semantic-search`
    : null
}

export async function fetchSemanticHits(
  query: string,
  signal?: AbortSignal,
): Promise<SemanticSearchOutcome> {
  const url = semanticEndpoint()
  if (!url) {
    return {
      ok: false,
      code: 'SEMANTIC_SEARCH_UNAVAILABLE',
      error:
        'Semantic search is not configured on this deployment ' +
        '(VITE_CONVEX_SITE_URL is missing). Filtered search via ' +
        'search_flights still works.',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const forwardAbort = () => controller.abort()
  signal?.addEventListener('abort', forwardAbort)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    })
    const body: unknown = await res.json().catch(() => null)
    if (
      !res.ok ||
      typeof body !== 'object' ||
      body === null ||
      (body as { ok?: unknown }).ok !== true
    ) {
      const b = body as { code?: unknown; error?: unknown } | null
      const code =
        typeof b?.code === 'string' ? (b.code as SemanticErrorCode) : 'SEMANTIC_SEARCH_UNAVAILABLE'
      const error =
        typeof b?.error === 'string'
          ? b.error
          : `Semantic search endpoint returned HTTP ${res.status}.`
      return { ok: false, code, error }
    }
    const b = body as { results?: unknown; hits?: unknown; embed_ms?: unknown }
    const results = Array.isArray(b.results)
      ? b.results.filter(
          (r): r is SemanticHit =>
            typeof r === 'object' &&
            r !== null &&
            typeof (r as SemanticHit).flight_id === 'string' &&
            typeof (r as SemanticHit).similarity_score === 'number',
        )
      : []
    return {
      ok: true,
      results,
      hits: typeof b.hits === 'number' ? b.hits : results.length,
      embed_ms: typeof b.embed_ms === 'number' ? b.embed_ms : -1,
    }
  } catch (err) {
    const aborted = signal?.aborted === true
    return {
      ok: false,
      code: 'SEMANTIC_SEARCH_UNAVAILABLE',
      error: aborted
        ? 'Semantic search call was aborted.'
        : `Semantic search unreachable: ${String(err)}`,
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
