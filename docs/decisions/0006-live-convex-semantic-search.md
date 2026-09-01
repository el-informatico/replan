# ADR-0006: Live Convex vector search — the one deliberate backend exception

- **Status:** Accepted
- **Date:** 2026-08-31
- **Ledger:** D011 in `agent-memory/decisions.md`

## Context

Every one of the eleven Phase 0–2 tools is explicitly simulated — their own
`note` fields say so ("Simulated hold (no backend) … does not survive a page
reload", `src/tools/hold.ts:86`; same clause in `transport.ts:197`,
`hotel-reservation.ts:76`). ADR-0001 even pinned the dataset as "a plain
file for later embedding/indexing work — no DB, no API routes."
`agent-memory/current.md:96` flags that 11 tools is already at the edge of
practitioner-reported selection degradation, and D006 fixed the tool set at
11 "for judge-facing predictability."

The WebMCP Challenge phase-4 dispatch asks for **semantic flight search via
a real, live vector database (Convex)**, and the human — after a Gate-1
preflight outside this repo (`docs/research/convex-vector-preflight.md`) —
explicitly confirmed **GO (2026-08-31)** and picked the embedding provider:
**Gemini `gemini-embedding-001` with the existing verified API key**.
Convex was chosen deliberately over static precomputed embeddings to
demonstrate genuine WebMCP + live-vector-DB integration for the judges,
accepted despite the Sep-3 deadline risk. This ADR records that reasoning so
the twelfth tool does not read as an unexplained architectural inconsistency
next to eleven "simulated" ones.

## Decision

1. **Exactly one live external dependency, for exactly one tool.**
   `search_flights_semantic({query})` (contract T11,
   `docs/plans/phase4-execution-plan.md`) is served by a free-plan Convex
   project (`replan`, production deployment, us-east-1). All other tools
   stay simulated; nothing about them changes. The tool's own note states
   plainly that its *results source* is a live vector index while bookings
   and holds remain page-lifetime.

2. **The static dataset remains the source of truth — Convex is a derived
   index.** `src/data/flights.json` is untouched. Convex stores only
   `{flight_id, text, embedding}` per row, seeded by a one-time re-runnable
   script; result rows are hydrated **locally** by `flight_id` through the
   existing `toSummary`/compact-row projection. This resolves the
   ADR-0001 "no DB" clause: the app still has no database for *state* — it
   has a remote *search index* over an unchanged static file, and can
   degrade (errors-as-data) if Convex is unreachable.

3. **Embeddings: Gemini `gemini-embedding-001`, raw REST, 768 dims**
   (`output_dimensionality`, MRL), task types `RETRIEVAL_DOCUMENT` for the
   corpus (seed time) and `RETRIEVAL_QUERY` for live queries. The API key
   is set as a Convex deployment env var (`npx convex env set`) and used
   only inside the Convex action — it never enters the Vite bundle, the
   repo, or the browser (Phase-0 leak-absence discipline re-applied: the
   served bundle is grepped for the literal key value, expected 0 hits).
   Because embedding happens server-side, the sibling repo's
   ephemeral-token pattern is unnecessary here (it exists for browser-side
   keyed calls); the stronger property holds — the key never reaches the
   client at all.

4. **Transport: public `httpAction` route, native `fetch`, zero new runtime
   deps.** The browser tool calls
   `POST https://<deployment>.convex.site/api/semantic-search` with JSON.
   The `convex` npm client is NOT added to the SPA; runtime deps remain
   exactly `react` + `react-dom`. Trade-off accepted: the endpoint is
   unauthenticated and public (deployment URLs are public by design — same
   posture as the sibling project), bounded by free-tier limits and
   errors-as-data on any failure; the query-embedding action it fronts is
   the only key-using surface.

5. **Convex API shape** (validated live in the preflight):
   `vectorIndex` on `v.array(v.float64())` (768 dims, within the 2–4096
   range); `ctx.vectorSearch` is **actions-only**; actions have no `ctx.db`
   (hydration inside Convex goes through an `internalQuery`); hits are
   `{_id, _score}`.

6. **Tool count 11 → 12** is a deliberate revision of D006's fixed-at-11
   premise, on explicit human instruction, landing exactly on the
   practitioner-reported "falloff around a dozen" line; mitigation stays
   lean non-overlapping descriptions (this one ~≤300 chars).

## Consequences

- First deploy-time env var beyond Phases 0–3: `VITE_CONVEX_SITE_URL` in
  Vercel (build-time bake; exact steps in the phase-4 plan §5).
- First repo code that is backend rather than client: a top-level `convex/`
  directory, never imported by `src/` (they talk only via HTTPS).
- New pure domain code: the corpus-text builder (embeds the 16-tag
  vocabulary that `docs/domain/flight-dataset.md:70-77` anticipated), with
  colocated tests; the one-time seed script lives in `scripts/`.
- No bundle-size guard exists in this repo (disclosed in the phase-4 plan);
  the zero-new-deps transport choice keeps that risk at zero by design.
- Unit tests for the tool mock the network seam (first such seam in the
  codebase); live end-to-end behavior is proven by the curl smoke +
  bundle greps + Phase-5 human pass, not by vitest.
- The Gate-1 scratch project (`replan-vector-preflight`) stays until phase
  close, then is deletable from the Convex dashboard.

## Amendment (2026-09-01) — the preflight-provider gap

Gate 1 validated the vector-index MECHANISM with a local MiniLM model
(on-topic cosine 0.29–0.37) because the provider pick deliberately came
after the preflight. The initial T11 contract therefore carried a drafted
relevance floor of 0.15 — a constant sitting under MiniLM's measured band.
Production then shipped Gemini (`gemini-embedding-001`), whose cosine range
is far more compressed: on-topic 0.616–0.694, off-topic garbage
0.556–0.567. Under that distribution a 0.15 floor can never fire — garbage
queries would have been presented as matches. It was caught and fixed only
because the Gate-2 smoke deliberately included an off-topic calibration
query, forcing a live recalibration to 0.60 (p4c6).

Lesson recorded as L005 (agent-memory/lessons.md): a preflight that runs
before a provider decision proves the mechanism, not the quality or the
thresholds — score distributions do not transfer across embedding
providers. Any future phase that adds a preflight gate in front of a
live-provider integration must run its quality/threshold calibration
against the actual chosen provider (post-pick, pre-integration, or as a
mandatory post-seed calibration step), and must not ship a threshold
constant derived from a proxy's distribution.
