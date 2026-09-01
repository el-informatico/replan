# Gate 1 preflight — Convex vector search proven end to end (outside this repo)

Phase 4 Gate 1 evidence, gathered 2026-08-31 in `~/scratch-tests/convex-vector-check`
(throwaway project, free plan — **zero changes to this repo during the preflight**;
this file is the single permitted addition). Companion input:
[convex-in-star-interview-coach.md](convex-in-star-interview-coach.md) (sibling-repo recon).

**Verdict up front: GO.** The full loop — schema with `vectorIndex`, seeded
vectors, scored queries — works today on a free-plan Convex project, with
browser-realistic end-to-end latency of **~195 ms** per query. One embedding
decision remains for the human (§6); nothing found threatens the Sep 3
deadline, but Gate 2 sizing is 1–1.5 days (§7).

## 1. What was stood up, and how

| Thing | Value |
|---|---|
| Scratch dir | `~/scratch-tests/convex-vector-check` (mirrors sibling convention) |
| Convex project | `replan-vector-preflight`, team `juan-zavala`, free plan |
| Dev deployment | `optimistic-alligator-511.convex.cloud` (US East / us-east-1) |
| Convex pkg | `convex@1.45.0`, `@huggingface/transformers@4.2.0` |
| Schema | `flights` table: `text`, `cluster`, `embedding: v.optional(v.array(v.float64()))` + `vectorIndex("by_embedding", {vectorField:"embedding", dimensions:384})` |

Literal setup sequence (all succeeded; auth was already cached at
`~/.convex/config.json` from the sibling project's Aug-29 device-code login):

```bash
mkdir -p ~/scratch-tests/convex-vector-check && cd ~/scratch-tests/convex-vector-check
npm init -y && npm i convex                                  # exit 0
npx convex project create replan-vector-preflight            # ✔ created (team juan-zavala)
npx convex deployment create juan-zavala:replan-vector-preflight:vector-check --type dev --region us
#  ✔ Created new dev deployment: optimistic-alligator-511.convex.cloud
echo 'CONVEX_DEPLOYMENT=dev:optimistic-alligator-511' > .env.local
npx convex dev --once
#  ✔ Added table indexes:
#    [+] flights.by_embedding (vector)   embedding (384 dimensions)
```

Fresh login, if ever needed on a new machine, is device-code based:
`npx convex login --device-name <name> --no-open --login-flow poll` →
browser URL + code, **code expires in 299 s** (sibling's first attempt
expired; second succeeded — see their `convex-login.log`).

## 2. Friction / gotcha log (new findings beyond the sibling repo's)

1. **`CONVEX_DEPLOYMENT` format** (hit, cost ~2 min): `.env.local` wants
   `dev:<deployment-name>` (e.g. `dev:optimistic-alligator-511`), NOT the
   `team:project:name` form that `deployment create` prints. Wrong form →
   `400 InvalidDeploymentName: Couldn't parse deployment name …`.
2. **`ctx.vectorSearch` is ACTIONS-ONLY** (docs + confirmed live): a `query`
   using it is the wrong shape; the search function must be an `action`.
3. **Actions have no `ctx.db`** (hit, cost ~5 min): the action that runs
   `vectorSearch` cannot read documents directly; hydrate results through an
   `internalQuery` via `ctx.runQuery`. Canonical shape:
   `action → ctx.vectorSearch → ctx.runQuery(internal.getX, {id, score})`.
4. **Vector-search hits are `{_id, _score}`** (hit, cost ~5 min): `hit.score`
   is `undefined`; using it fails with a confusing
   `ArgumentValidationError: Object is missing the required field 'score'`.
5. **`ctx.db.insert(value)` arity trap** (self-inflicted, cost ~15 min —
   logged for honesty): insert takes `(tableName, value)`; passing only the
   value fails with an unrelated-looking `TypeError: t.startsWith is not a
   function` (Convex calls `.startsWith` on the table-name slot). The scratch
   had no `typescript` installed, so `dev --once`'s "try" typecheck silently
   skipped it — **Gate 2's real repo has tsc in every verify run, and the
   scratch should have installed it**.
6. Sibling-repo gotchas re-verified as still relevant: **schema push blocks
   on stale rows** (not hit here — fresh empty table; but changing the index
   `dimensions` after seeding WILL require clearing/reimporting rows — plan
   the seed as a re-runnable script); **actions cannot reach localhost**
   (irrelevant to us — no local services in this design).
7. Convex AI-files nudge: `dev` prints a "Convex AI files are not installed"
   hint every push; harmless, ignorable (`npx convex ai-files disable` to hide).

## 3. Mechanical proof — deterministic synthetic vectors

12 rows seeded (3 clusters × 4: cheap-morning / short-layover / red-eye),
vectors = 0.9 × unit cluster-center + deterministic LCG noise, normalized
(dimension 384). Query = cluster center ⇒ in-cluster cosine ≈ 0.89,
cross-cluster ≈ 0.02, ordering deterministic.

```bash
$ npx convex run flights:seed
{ "dimensions": 384, "inserted": 12 }          # real 1.576s (CLI)
$ npx convex run flights:searchCluster '{"cluster":"A","limit":5}'
```

Query A (top-5 of 12, abbreviated — full JSON captured in scratch):

| rank | cluster | score | row |
|---|---|---|---|
| 1 | A | **0.8959** | FL-110 CloudJet morning $205 |
| 2 | A | 0.8956 | FL-101 SkyBudget dawn $189 |
| 3 | A | 0.8904 | FL-107 SkyBudget dawn $179 |
| 4 | A | 0.8875 | FL-104 AirAndes early $198 |
| 5 | C | 0.0165 | (first cross-cluster row) |

Query B: top-4 all cluster B, 0.8887–0.8934; 5th = A at 0.0298.
Query C: top-4 all cluster C, 0.8873–0.8981; 5th = B at 0.0151.
`server_ms` (measured inside the action): 6 / 8 / 12 ms.

## 4. Real semantic proof — local offline model, no key

`@huggingface/transformers` v4.2.0, `Xenova/all-MiniLM-L6-v2` (q8 ONNX,
384 dims — matches the index). `node embed.mjs` timings:
model load **2.8 s** (includes one-time ~22 MB download), 12 corpus texts
**132 ms**, each query ~**2 ms** warm. Seeded via
`npx convex import --table flights flights-real.jsonl` →
`✔ Added 12 documents`.

Three queries phrased nothing like the stored text (no airline codes, times,
prices) — top hit + score (full top-5s in the transcript):

| Query (natural language) | Top hit | Score |
|---|---|---|
| "cheapest option that leaves at dawn" | FL-307 red-eye $171 "dawn arrival, cheapest overnight" | 0.370 |
| "fast connection even if I have to change planes once" | FL-203 one-stop 70-min Bogotá connection | 0.291 |
| "sleep on the plane and wake up when we land at sunrise" | FL-304 red-eye "sleep through the flight" | 0.325 |

Quality note (honest): separation is real but **soft** — scores span
0.22–0.37 across the top-5, and a non-topical row occasionally leaks in at
0.27+. MiniLM is a 22 MB model; frontier API embedders would very likely
separate more sharply. Good enough to demo; not good enough to brag about.

## 5. Latency summary (all measured 2026-08-31, US-East deployment)

| Path | Latency |
|---|---|
| `ctx.vectorSearch` + hydration, server-side | 3–23 ms |
| Browser-style client (`ConvexHttpClient.action`), warm, 5 runs | **194–199 ms end-to-end** |
| `npx convex run` CLI (incl. CLI startup) | ~1.5 s (ignore; CLI-inflated) |
| Local MiniLM query embed (warm, in Node) | ~2 ms |
| Gemini `embedContent` REST from THIS WSL client | 1.16 s round-trip (research: p50 ≈ 50–100 ms from US infra; WSL adds overhead) |

## 6. Embedding provider decision (HUMAN DECIDES — not picked here)

Scale: ~26 docs embedded ONCE + live query embeds during demos (~dozens).
Convex accepts 2–4096 dims — every option below fits. Key availability in
THIS environment (checked without reading values): shell has no embedding
keys; `~/scratch-tests/.env` and the sibling repo's `.env` both contain
`GEMINI_API_KEY` — **verified working 2026-08-31** with one free
`gemini-embedding-001` call (HTTP 200, 768 dims).

| Option | Dims | Free headroom | Key friction | Embed where | Live-query latency | Main risk |
|---|---|---|---|---|---|---|
| **(a) Gemini `gemini-embedding-001`** | 3072 default, 128–3072 MRL | Free tier, no charge | **None — key exists + verified** (or mint fresh in AI Studio, no card, instant) | Convex action (`fetch`, raw REST) | ~50–300 ms + action overhead ⇒ ~0.3–0.6 s total | Free-tier RPM/RPD unpublished (community: ~1k/day) — irrelevant at our volume |
| (b) OpenAI `text-embedding-3-small` | 1536 | n/a (pay ~$0.0001 total) | **Card required**, no trial credits since ~mid-2025 | Convex action | p50 ~300 ms, p99 seconds | Payment step; slowest p50 of the APIs |
| (b') Cohere `embed-v4.0` | 256–1536 | 1,000 calls/month trial | Low — trial key auto-created, no card | Convex action | p50 ~100 ms | 1k/month cap; trial-expiry terms fuzzy |
| (b'') Voyage `voyage-4-lite` | 256–2048 | 200M tokens free | Low — signup, card policy undocumented | Convex action | not benchmarked | Least latency data |
| **(c) Local MiniLM in the browser** (transformers.js) | 384 fixed | Unlimited | **None — no key at all** | Client WASM (model cached in browser after ~22 MB first load) | ~10–50 ms warm; multi-second first load | 22 MB download inside ChatGPT's in-app browser during a judged demo = unknown; soft separation (§4) |
| (c') Local in Convex action | — | — | — | **Not feasible**: onnxruntime-node native binaries vs 32 MiB bundle cap | — | Ruled out by research |

Not usable: Convex AI Gateway (embeddings "coming soon", paid beta).

Architecture note for (a)/(b): the raw key would live ONLY in Convex env
vars (`npx convex env set`) and be used inside the action — it never
reaches the browser bundle, so the sibling's **ephemeral-token pattern is
not needed** for a server-side embedder (that pattern exists for
browser-side keyed calls; option (c) needs no key at all). Gate 2 still
greps the served bundle for key absence, per Phase 0 discipline.

Sources (checked 2026-08-31): docs.convex.dev/search/vector-search,
convex.dev/plans, docs.convex.dev/functions/{actions,bundling},
docs.convex.dev/production/environment-variables, github.com/get-convex/embedding-soup,
ai.google.dev/gemini-api/docs/{embeddings,pricing,rate-limits},
developers.openai.com/api/docs/pricing, docs.cohere.com/docs/rate-limits,
docs.voyageai.com/docs/{embeddings,pricing}, huggingface.co/docs/transformers.js,
nixiesearch.substack.com/p/benchmarking-api-latency-of-embedding.

### 6a. Addendum — human's follow-up questions, validated live (2026-08-31)

The human GO'd the phase overall but asked to (1) validate **Groq** (their
sibling-project key) for the embedding role and (2) survey alternatives with
rate limits in mind. Results:

1. **Groq: NOT usable for embeddings.** The existing `GROQ_API_KEY` is
   VALID (`GET /openai/v1/models` → HTTP 200, 14 models) but the account
   serves **zero embedding models** — all chat/whisper/tts/prompt-guard
   (sample: `openai/gpt-oss-120b`, `whisper-large-v3`,
   `canopylabs/orpheus-v1-english`). Official model docs concur (no
   embeddings documented). A direct `POST /openai/v1/embeddings` probe 404s
   on model resolution. Using Groq's LLMs to rank the 26 rows instead of
   vectors would abandon the phase's whole point (live vector DB), so no.
2. **Gemini free-tier RPM — measured, not assumed:** a deliberate 10-call
   zero-delay burst through the existing key → **10/10 HTTP 200, zero
   429s**, 0.44–1.34 s per call from this WSL client. Worst realistic demo
   load is ~hundreds of queries across the whole event; even community's
   pessimistic ~1k/day leaves 20×+ headroom. The practical risk is a cold
   429 only if many judges hammer simultaneously — and provider failures
   surface as errors-as-data by design in Gate 2.
3. **Alternatives not previously surveyed — Mistral** (`mistral-embed`,
   1024d): free tier, no card, ~1 req/s global limit and ~1B tokens/month
   per community/docs ([usage-limits](https://docs.mistral.ai/admin/billing-usage/usage-limits));
   exact free numbers no longer published. Viable but requires minting a
   fresh key today and is unverified in this environment. Cohere/Voyage/
   OpenAI stand as in §6.

Net: nothing displaces the §6 friction ordering — a working key for
Gemini already exists here and survived a burst test; every other keyed
option means minting a new key before integration can start.



**Recommendation: GO** — the loop is proven, latency is demo-grade, free-tier
headroom is ~4 orders of magnitude beyond need, and no blocker surfaced.
Sizing for Gate 2 (provider picked ⇒ implement): ADR-0006 + Layer-1 contract
T11, corpus-text builder for the real 26 flights, one-time seed script,
`search_flights_semantic` tool + tests + budgets row, Vercel env wiring +
deploy + bundle grep, independent review — realistically **1–1.5 focused
days**, leaving ≥1 day for Phase 5 (12-tool demo script) before Sep 3.
Tight but real; descope lever if needed: ship the tool without expanding the
demo script (judges can still call it free-form).

Open items for the human (blocking Gate 2):
1. Pick the embedding option (§6 + §6a) — GO was confirmed 2026-08-31 for
   the phase overall; the provider pick is the last open sub-decision.
   Groq ruled out (§6a.1); Gemini's RPM concern was burst-tested clean
   (§6a.2).
2. If Gemini: reuse the existing `GEMINI_API_KEY` from `~/scratch-tests/.env`,
   or mint a fresh AI Studio key for replan? (Either stays server-side only.)
3. ~~Confirm go/no-go overall.~~ **CONFIRMED GO — 2026-08-31.**

## 8. Scratch artifacts & cleanup

`replan-vector-preflight` project + `optimistic-alligator-511` deployment
remain on the Convex account (free) — **keep until Gate 2 closes** (the real
26-flight corpus can be pushed to a `--prod` deployment in the same project).
Delete afterwards via dashboard.convex.dev if desired. Scratch files:
`convex/{schema,flights}.ts`, `embed.mjs`, `latency.mjs`, `flights-real.jsonl`,
`query-{0,1,2}.json`. Nothing from this preflight touched the replan repo
except this document (and the committed recon doc beside it).
