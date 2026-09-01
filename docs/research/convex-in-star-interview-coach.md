# Recon: how Convex was used in star-interview-coach

Read-only reconnaissance of `~/projects/star-interview-coach` (sibling
repo, github.com/el-informatico/star-interview-coach), gathered
2026-08-31 to inform a Phase 4 design decision in the directing
session. Nothing in that repo was modified. This file is UNCOMMITTED
recon input — the directing session decides whether/where it lands.

## Headline answers

### 1. Vector/semantic search? — NO.

Convex was used purely as a **general backend** (its role there was a
hackathon mandate, not a search choice — README.md:24 "Convex —
requisito obligatorio del evento. Es todo el backend"). Evidence:

- `grep -rn 'vectorSearch\|vectorIndex' convex/ src/` → 0 hits
- `grep -rn 'searchIndex' convex/` → 0 hits (not even text search)
- `grep -rniE 'embedding|cosine|similarity' convex/ src/` → 0 hits
- `convex/schema.ts` (140 lines): 6 relational tables + `authTables`
  (`sessions`, `questions`, `session_questions`, `cv`, `turns`,
  `final_report`), plain `.index(...)` only — no index of any search
  kind.

The AI features (question personalization, STAR evaluation, English
coach, final report) are single-shot LLM calls over user-pasted text
tracked in `RELEVAMIENTO-SAAS.md:14-17` — not retrieval over a corpus.

### 2. Vector schema pattern — NOT PRESENT.

The repo offers **no in-repo example** of the Convex vector-index
pattern (table shape, vector field, dimension, `vectorIndex`
definition, or the `vectorSearch` query call). Convex `^1.45.0`
(package.json:16) supports the platform feature; it was simply never
exercised. If Phase 4 wants Convex vector search, this sibling repo
does not de-risk it — the pattern would have to come from Convex's own
docs and be preflighted fresh.

### 3. Embedding provider — NONE (no vectors exist).

Providers actually used (all via **raw fetch, no SDKs** —
`convex/proveedores.ts:1-9`):

| Role | Provider / model | Key (env name) |
|---|---|---|
| LLM primary | Groq, `openai/gpt-oss-120b` (OpenAI-compatible endpoint) | `GROQ_API_KEY` |
| LLM fallback | Google Gemini, `gemini-3.1-flash-lite` | `GEMINI_API_KEY` |
| Streaming STT | AssemblyAI Universal-Streaming (SDK JS v4, browser) | `ASSEMBLYAI_API_KEY` |
| (unused) | — | `CEREBRAS_API_KEY` sits in `.env`, zero code references |

Keys live in that repo's gitignored `.env` and are pushed into the
Convex deployment env via `npx convex env set` (README.md:142-145).
They are **provider-account keys, not project-bound** — the names are
provider-standard and any project on the same Groq/Gemini/AssemblyAI
accounts could reuse them (key values were deliberately not read or
compared here).

### 4. Deployment pattern — two independent services, URL baked at build.

- Frontend: plain Vite SPA. `new ConvexReactClient(import.meta.env
  .VITE_CONVEX_URL, ...)` at `src/main.tsx:8`, wrapped in
  `ConvexAuthProvider` (`@convex-dev/auth/react`).
- Backend: separate Convex cloud deployment(s). The built bundle
  contains TWO deployment URLs (`dutiful-panther-53.convex.cloud` dev +
  `happy-otter-123.convex.cloud` prod — public by design, they ship in
  the client JS). Deployed with `npx convex dev` / `npx convex deploy
  --prod`; OAuth callbacks are served by Convex http actions at
  `<deployment>.convex.site/api/auth/callback/...` (`convex/http.ts`,
  RUNBOOK §1.3).
- Env wiring split: `.env.local` holds `CONVEX_DEPLOYMENT` (CLI
  deployment selector) + `VITE_CONVEX_URL` (baked into the client at
  build) + `VITE_CONVEX_SITE_URL`; `.env` holds the provider keys.
- **No Vercel involvement in that repo** (no `.vercel/`, no Vercel
  config, remote is GitHub only); the frontend hosting location is not
  recorded in-repo. So it is NOT a "Vercel frontend calling Convex"
  example — it's just "static SPA + Convex cloud".

### 5. Lessons / gotchas recorded in that repo

From `RUNBOOK.md`, README, `RELEVAMIENTO-SAAS.md`, and code comments:

- **Schema push blocks on stale rows.** Adding a required field
  (`sessionId`) failed the push while old documents lacked it; demo
  data had to be cleaned (mutation `admin:resetDemo` + manual dashboard
  deletes) BEFORE deploying the new schema (RUNBOOK §2). Schema
  iteration under deadline needs this dance planned.
- **Convex actions cannot reach localhost.** Their local-LLM fallback
  (Nanbeige `[::1]:8080`) had to be invoked from the FRONTEND because
  Convex runs in the cloud ("Convex corre en la nube y no alcanza
  localhost" — `convex/proveedores.ts:3`). Any "backend calls a local
  service" idea is dead on arrival.
- **Convex Auth setup friction is real** (their own words: "marcado
  beta por Convex", RUNBOOK §4). Auth needs 5 env vars including
  `JWT_PRIVATE_KEY`/`JWKS` generated via a `jose` script, plus a Google
  OAuth client with `.convex.site` redirect URIs (RUNBOOK §1). replan
  currently needs no auth — this is pure added friction if it did.
- **Ephemeral-token pattern for keyed APIs**: the AssemblyAI key never
  reaches the browser; a Convex action mints a short-lived token
  (480 s, `convex/assemblyai.ts:17`). Clean pattern for any
  client-side use of a keyed third-party API.
- **Preflight-scaffold discipline**: the Vite/Convex/tsconfig boilerplate
  was validated OUTSIDE the repo first (`~/scratch-tests/convex-check`,
  README:46-47) — same methodology as replan's; worked well for them.
- **Privacy logging rule**: logs never expose private material; calls
  correlated via input length + FNV-1a hash (`convex/ia.ts:6-16`).
- **Latency/cost care**: `reasoning_effort: low` for single-pass
  evaluation ("latencia" — `proveedores.ts:27`); per-session external
  call counts tabulated with file:line citations (`RELEVAMIENTO-SAAS.md`
  tabla); Convex's own cost was explicitly NOT quantified ("No
  cuantificado: costo de Convex... ~15-25 mutations/queries y unos
  pocos KB", RELEVAMIENTO:80) — no free-tier surprise is recorded
  either way, because they never measured it.
- **Cron is trivial**: a 24 h retention job in 10 lines
  (`convex/cron.ts`).
- **Static content seeding** via `npx convex import --table questions
  seed/questions.json` (one-time, not a runtime mutation) — RUNBOOK §3.

## Facts to weigh for the Phase 4 decision (no proposal attached)

- The sibling repo proves Convex works fine as a small reactive backend
  + server-side secret holder under a hackathon deadline, with modest
  setup friction concentrated in Auth (which replan does not need).
- It provides ZERO evidence about Convex vector search — no schema, no
  query pattern, no provider integration, no cost/latency data for it.
- replan today is 100% client-side by design (D001); any Convex
  introduction is a new architecture decision, and WebMCP tool
  registration would remain client-side regardless.
