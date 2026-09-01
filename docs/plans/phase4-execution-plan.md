# Phase 4 execution plan — search_flights_semantic (live Convex vector search)

Status: executing (Gate 1 passed 2026-08-31; human GO + provider pick
recorded in `docs/research/convex-vector-preflight.md` §6/§6a and ADR-0006).
Numbering continues Phase 2 (T5–T10) → **T11**. One tool, one phase.

## 1. Research base (done — Gate 1, outside this repo)

`docs/research/convex-vector-preflight.md` + the sibling-repo recon beside
it. Load-bearing facts, all validated live:

- `vectorIndex` on `v.array(v.float64())`, dims 2–4096 (the Gate-1 scratch
  validated the mechanics at 384; the shipped index is 768 — Gemini's
  `output_dimensionality` — exercised live at seed/deploy). Push works on
  a free plan.
- `ctx.vectorSearch` is **actions-only**; actions have **no `ctx.db`** —
  hydrate inside Convex via `internalQuery`; hits are `{_id, _score}`.
- Browser-realistic latency 194–199 ms per search; `server_ms` 3–23.
- Gemini `gemini-embedding-001`: key already present and verified (HTTP 200;
  10-call burst, zero 429s); raw REST
  `POST …/v1beta/models/gemini-embedding-001:embedContent`
  (+`batchEmbedContents` for the seed); `output_dimensionality: 768`,
  `taskType` RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY.

## 2. Architecture (what lives where)

| Piece | Location | Notes |
|---|---|---|
| Corpus-text builder | `src/domain/embedding-text.ts` | pure, tested; renders a `Flight` to natural language incl. its tags |
| Convex schema + actions | `convex/` (new top-level dir) | never imported by `src/` — HTTPS only |
| Public route | `convex/http.ts` → `POST /api/semantic-search` | unauthenticated JSON in/out; the only browser-facing surface |
| One-time seed | `scripts/seed-semantic.ts` (+ `npm run seed:semantic`) | embeds 26 flights → imports to Convex; re-runnable |
| Browser client seam | `src/lib/semantic-client.ts` | native `fetch`, `VITE_CONVEX_SITE_URL`, AbortSignal-aware |
| Tool | `src/tools/semantic-search.ts` | T11 below; hydrates rows locally via `toSummary` + compact projection |

## 3. Contract T11 — search_flights_semantic({query})

```
TASK: Implement search_flights_semantic({query})
ACCEPTANCE CRITERIA:
  1. Input is exactly one required field: query (string, 1..200 chars after
     trim). Non-object input, unknown keys, missing/empty/oversized query →
     {ok:false, code:"INVALID_INPUT", error} naming the constraint.
  2. Happy path: {ok:true, count, note, results} where each result row is
     the SAME compact flight row search_flights returns (id, airline,
     route, departs, arrives, price_usd) PLUS similarity_score (0..1,
     3 decimals), rows sorted by similarity_score desc, capped at 8 with a
     "Showing N of M" note when the cap truncates. count = Convex match
     count before local hydration skips.
  3. Relevance floor: if every returned score < MIN_SIMILARITY (named
     constant), return {ok:true, count:0, results:[], note:"No semantically
     close flights — rephrase or use search_flights with filters."} — an
     empty result is a VALID outcome, never an error. [Amended 2026-08-31
     after live calibration: floor = 0.60. Measured on the prod index:
     on-topic 0.616–0.694, off-topic garbage 0.561–0.567 — Gemini's cosine
     range is compressed and the drafted 0.15 default could never fire.]
  4. Hydration: rows map back to flights.json by flight_id via the existing
     toSummary/compact projection; a Convex id with no local row is skipped
     and disclosed in the note (dataset drift guard).
  5. Errors-as-data, never a thrown promise: INVALID_INPUT;
     SEMANTIC_SEARCH_UNAVAILABLE (missing env URL, network failure,
     non-200, abort); EMBEDDING_FAILED (provider error message passed
     through with a retry hint). Every path returns a JSON-safe object.
  6. Store: writes NOTHING (ping precedent); invocation still logged via
     logToolCall for the Tool-call log card; annotations
     readOnlyHint:true with a justification comment.
  7. Registration: 12th entry in App.tsx's Promise.all; page copy updated
     ("Twelve tools"); budgets.test.ts TOOLS array + output ≤ 1.5K
     assertion (the standing manual step).
  8. Description ≤ 300 chars (hard cap 500, test-enforced); name regex OK.
VERIFICATION: unit tests — happy path (mocked seam: sorted rows, correct
  envelope, similarity_score present, ≤ 1.5K JSON); relevance-floor empty
  case; malformed-input sweep ([null, 42, 'x', [], {query:''},
  {query: 7}, {query, extra}]) never throws; seam failure →
  SEMANTIC_SEARCH_UNAVAILABLE; provider error → EMBEDDING_FAILED; skip-and-
  disclose hydration guard; budgets row. Domain tests — corpus-text builder
  over all 26 flights (non-empty, contains id + price + every tag, no \n).
  Live smoke — 3 natural-language queries against the deployed Convex
  endpoint with scores + latency recorded. Deploy greps — 12 tool names ×
  exactly 1 in the served bundle; ZERO hits for the literal GEMINI_API_KEY
  value.
CONSTRAINTS: no Phase 0–3 tool implementation changes; flights.json
  untouched; the API key exists ONLY as a Convex env var (npx convex env
  set) — never in repo, .env* committed files, or the bundle; convex/ code
  is never imported by src/; zero new runtime npm deps.
DONE ONLY WHEN: all AC have passing cited evidence and verify.sh exit 0.
```

## 4. Commit ladder (one verified increment = one commit)

1. ADR-0006 + D011 + this plan.
2. Corpus-text builder (`src/domain/embedding-text.ts` + tests).
3. Convex backend (`convex/` schema, action, http route) + seed script +
   `.env.example` + `semantic-client.ts` seam.
4. Tool + unit tests + budgets row + App.tsx registration + copy.
5. Real deployment + `convex env set` + seed + curl smoke (live evidence).
6. Vercel env wiring + deploy + `verify.sh --url` + bundle greps.
7. Independent review + fixes (fresh-eyes subagent, findings disclosed).
8. agent-memory updates (current/progress) + Phase-5 assumptions.

## 5. Deploy-time env wiring (first in repo history — exact steps)

1. Local `.env.local` (gitignored, `*.local` already in .gitignore):
   `CONVEX_DEPLOYMENT`, `VITE_CONVEX_SITE_URL=https://<dep>.convex.site`.
2. Convex secret: `npx convex env set GEMINI_API_KEY <value>` (value read
   from `~/scratch-tests/.env`, never echoed/committed).
3. Vercel: `npx vercel env add VITE_CONVEX_SITE_URL production` (token via
   `~/.vercel-token`), then `npx vercel deploy --prod` (env vars bake at
   build — the add MUST precede the deploy).
4. Smoke: `scripts/verify.sh --url https://replan-phi.vercel.app` + the two
   bundle greps (tool names; key absence).

## 6. Phase 5 assumptions (recorded for the next session)

- The demo script + worksheet grow to a 12-tool version; the semantic
  section should use the tool's REAL example queries and expected top
  results as verified in the live seed smoke (§4 step 5 evidence).
- ChatGPT read-only expectation: no confirmation gate expected (readOnly
  tool precedent), single data point caveat stands.
- The convex.site endpoint is public: fine for the demo; abuse bounded by
  free tier + errors-as-data + the tool's 60s query memoization.
- **Pre-demo floor re-check (reviewer finding 14)**: the 0.60 floor sits
  0.016 under the lowest measured on-topic score (0.616) — re-run the two
  canned demo queries against the live endpoint before recording the demo;
  if scores drifted low, recalibrate MIN_SIMILARITY and note it here.
- Demo phrasings must be POSITIVE: embedding retrieval does not invert on
  negation ("I hate flying all night" returns red-eyes — live-observed).

## 7. Review disclosure (independent review, 2026-09-01)

No MAJOR findings; 9 MINOR + 7 NIT, all disclosed in the p4c8 commit and
agent-memory/progress.md. Notable process gaps accepted for the deadline:
verify.sh does NOT typecheck `convex/` or `scripts/` (the backend gate is
`npx convex deploy`'s own typecheck — run it after any backend edit;
reviewer finding 4). Reviewer finding 3 ("convex in dependencies") was
disputed with evidence: convex is in devDependencies, runtime deps remain
exactly react + react-dom.
