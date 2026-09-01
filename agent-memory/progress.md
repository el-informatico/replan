# Progress

One block per verified phase, newest at the bottom. Evidence = the literal
command and its exit status/result, plus commit hashes. Per-increment detail
lives in `git log`; this file records phase-level closure.

---

## Phase 0: Foundation — VERIFIED
Date: 2026-08-31
Commits: `e1ce1a8` skeleton+verify.sh → `ad0a9a9` dataset+tests → `5229807`
ping tool+UI → `8cdccd0` verify smoke fix → (this) memory finalization.
(History rewritten once, 2026-08-31, to strip AI co-author trailers per user
rule — hashes above are post-rewrite.)

Criterion evidence:

1. **Repo layout** — `find . -not -path './node_modules/*' -not -path './.git/*' -type f`
   shows CLAUDE.md, docs/{architecture,decisions,domain,plans}, agent-memory
   (5 files), evals/{functional,regression,e2e,held_out}, scripts/verify.sh.
   Omissions vs the methodology's §1 tree justified in
   `docs/decisions/0002-repo-layout-scoping.md`.
2. **Dataset** — 26 flights in `src/data/flights.json`; vitest leg:
   `Test Files 1 passed (1), Tests 8 passed (8)` — zero
   `validateDataset()` violations + discriminator tests (both sides of every
   scenario constraint; ≥1 flight satisfying all at once). Schema:
   `docs/domain/flight-dataset.md`.
3. **Web skeleton + ping tool** — `scripts/verify.sh` → `verify.sh: PASS
   (exit 0)` (typecheck/lint/build/unit). Served production bundle contains
   the tool descriptor: `curl -s https://replan-phi.vercel.app/assets/index-*.js
   | grep -oc 'name:``ping``'` → `1`. Stack choice + scoping: ADR-0001/0002.
4. **Deploy + verify** — `vercel deploy --prod --yes --token …` → deployment
   Ready (target: production), public alias
   https://replan-phi.vercel.app; `scripts/verify.sh --url
   https://replan-phi.vercel.app` → `PASS: deploy smoke (HTTP 200, app shell
   present)` + `verify.sh: PASS (exit 0)`.
5. **Memory** — `agent-memory/current.md` (rewritten at phase close),
   `progress.md` (this entry), `decisions.md` (D001–D003),
   `failures.md` (F001–F003), `lessons.md` (L001–L002).
6. **License** — MIT `LICENSE` at repo root (`git show --stat` includes it;
   detectable format). GitHub About-sidebar rendering: **pending push** — no
   remote yet; tracked as open item in current.md.

Notes:
- Verification gap (explicit): live agent discovery of `ping` (ChatGPT
  in-app browser or Chrome flag) is NOT yet verified — headless session;
  both paths are user-manual, instructions in current.md.
- Deploy URLs other than replan-phi.vercel.app SSO-redirect (deployment
  protection); judges must be given the public alias.
- Node 22.22.2 / npm 12.0.2 / Vercel CLI 59.10.0; token auth via
  `~/.vercel-token` (0600) — never committed, never printed.

---

## Phase 1: Core flight tools — VERIFIED
Date: 2026-08-31
Commits: 9f0f125 (plan+contracts+ADR-0004) → 1c015e7 (T1) → aa2dfa8 (T2)
→ 666e6cc (T3) → d1fbe3b (T4) → 4fd5c7e (authoring pass) → 0c75c33 (UI)
→ d0d9ab2 (review fixes + functional eval). Independent review: 8 confirmed
findings (1 major), all fixed with regression tests in d0d9ab2.

Per-tool evidence:

- **T1 search_flights** (1c015e7, amended 4fd5c7e/d0d9ab2): verify.sh exit 0;
  unit green. Filters validated (destination enum+execute, ISO-with-offset
  incl. real-calendar rejection, >0 / ≥0 bounds); price-asc ordering;
  empty result valid ({ok:true,count:0}); compact payload ≤1.5K
  (test-enforced); readOnlyHint false (writes lastSearch — plan §6
  amendment); registered + logged; store lastSearch + subscriber notify.
- **T2 hold_reservation** (aa2dfa8): verify.sh exit 0; exact +15min expiry at
  injected clock (12:00→12:15Z); unknown-id error with examples+count;
  double-hold error carrying active expiry; hold-after-expiry via clock+16;
  concurrent distinct holds OK; TTL/note state the simulation explicitly.
  State: in-memory store (ADR-0004) — in-memory vs localStorage vs React
  state decided and justified there.
- **T3 update_constraints** (666e6cc, fixes d0d9ab2): verify.sh exit 0;
  seeded-from-scenario equality; one-key merge leaves others intact; {}
  re-runs unchanged; merged re-search spans MIA+FLL (max_price=300 test
  asserts both airports present, all rows ≤300); preferred_time reorders by
  monotone departure-closeness; null clears (restores price order);
  lastSearch via=update_constraints; subscriber notified.
- **T4 confirm_booking** (d1fbe3b, fix d0d9ab2): verify.sh exit 0; no-hold
  → NO_ACTIVE_HOLD pointing at hold_reservation; expired → HOLD_EXPIRED with
  lapse instant; deterministic ref RPLN-FL009-style; itinerary with segments;
  idempotent re-confirm returns byte-identical ref/confirmed_at +
  idempotent:true, booking count 1 — INCLUDING the confirm→re-hold→confirm
  cycle (stray hold now consumed); second distinct flight bookable.

Cross-cutting:
- Authoring brief applied + mechanically enforced (budgets.test.ts): ≤500
  description, ≤150 param, ≤1.5K output, unique spec-charset names.
- UI live-reactive via store subscription: itinerary card, constraints
  panel, holds w/ countdown, results w/ held/booked badges, tool log.
- Live smoke (headless-session variant): verify.sh --url
  https://replan-phi.vercel.app → exit 0 (HTTP 200, app shell); served
  bundle assets/index-QbwDFBTM.js contains name:`ping` ×1,
  `search_flights` ×1, `hold_reservation` ×1, `update_constraints` ×1,
  `confirm_booking` ×1; T1+T3 narrative executed against the real tool
  modules in evals/functional/rebooking-narrative.test.ts (3 tests green).
  In-app-browser confirmation remains the human item (current.md).
- No AI-attribution trailers in pushed history (re-verified post-push).

Addendum (2026-08-31, later): the Phase 1 verification gap above is CLOSED —
human-run in-app-browser smoke test (Path A, ChatGPT Desktop) PASSED with
every turn matching the machine-pinned expectations exactly (17/FL-015 $299;
FL-016 hold 15-min TTL; 17→14 with FLL promotion and live UI re-render;
RPLN-FL016). One documented observation, not a defect: ChatGPT inserts a
"proceed? / Yes" confirmation turn before both write-action tools
(hold_reservation, confirm_booking) but not before ping / search_flights /
update_constraints — demo-video planning must budget two extra Yes-turns.
Full record: agent-memory/current.md ("Observed" + closed outcome block).

---

## Phase 2: Multi-domain expansion — VERIFIED
Date: 2026-08-31
Commits: 66c2d4d (plan+contracts T5-T10+ADR-0005+ADR-0004 addendum) →
0513f97 (T5) → cd6b364 (T6) → 26bc978 (T7) → e849f81 (T8) → 5716271 (T9)
→ 7871c04 (T10) → d187136 (UI) → 73fa2d7 (functional eval) → da0d390
(independent-review fixes). Independent review: 2 majors + 9 minors, ALL
fixed with regression tests in da0d390.

Per-tool evidence:

- **T5 search_hotels** (0513f97, amended da0d390): verify.sh exit 0; 18
  synthetic hotels (12 Miami 9-MIA/3-FLL + 6 FLL; zones 6/6/6; $79–$349;
  3+3 sold-out crunch days; port-distance invariant) with
  validateHotelsDataset [] + distribution pins + discriminating-power
  tests; city required (UNKNOWN_CITY), near_airport independent of city
  (UNKNOWN_AIRPORT), check_in/check_out both-or-neither + whole-24h
  nights, sold-out/rooms filtering, price-asc sort, valid empty result
  (Miami+near FLL on 09-13), store lastHotelSearch + notify. Review fix:
  compact row trimmed (city/star/rooms_left out of the agent payload) —
  the post-crunch windowed case measured 1555 chars vs the 1.5K budget;
  budgets test repointed at the true widest case (count 11, showing 8).
- **T6 update_hotel_reservation** (cd6b364, amended da0d390): verify.sh
  exit 0; scenario-seeded HTL-R001 (D008 — no hotel hold/TTL pair, 11-tool
  ceiling); NOT_FOUND lists ids+count; deterministic idempotency by
  instant incl. offset respelling (stored spelling returned, updated_at
  untouched, no notify on no-op); check_out shifts preserving nights
  across month boundaries; cross-tool CHECK_IN_BEFORE_ARRIVAL vs
  latestBooking arrival date (same-day allowed); no-flight accepts any
  valid date. Review fix: arrival check now runs BEFORE idempotency —
  re-sending a date a later flight invalidated errors instead of
  returning idempotent:true over stale state (regression pinned).
- **T7 book_ground_transport** (26bc978): verify.sh exit 0; fare-model
  dataset (taxi/shuttle/rideshare × 6 routes, full MIA/FLL × zone
  coverage, validator-enforced; FLL→downtown ordering shuttle 25.64 <
  rideshare 65.90 < taxi 95.90); NO_CONFIRMED_FLIGHT points at
  hold→confirm; pickup window [arrival+15m, arrival+8h] exact at both
  boundaries; route derived from state (flight last-segment airport +
  hotel zone); deterministic ref RPLN-GT-<TYPE>-<AIRPORT>; replace
  semantics with replaced_previous (no cancel tool → no dead ends).
- **T8 notify_contact** (e849f81, amended da0d390): verify.sh exit 0;
  simulated only (stated in description AND return note); contact
  validated at both levels (unknown keys, ≥1 of phone/email, empty
  strings rejected, null≡absent pinned); NTF-### sequential
  deterministic; channel sms-if-phone else email; nothing transmitted.
  Review fix: contact fields capped at 100 chars (echoed strings can no
  longer blow output budgets); T8 AC5 no-cross-validation pinned by test.
- **T9 calculate_total_cost** (5716271): verify.sh exit 0; shared pure
  buildCostBreakdown (D010 — one definition used by tool + T10 + UI
  card); items enum validated (non-array/unknown/duplicate →
  INVALID_INPUT); absent/null items = everything booked, NEVER errors
  (review-fixed: NOT_BOOKED gate applies only to explicit items);
  NOT_BOOKED names the booking tool; budget = stored maxPriceUsd with
  within + signed delta, exact boundary tests (equality fits, 1¢ over
  doesn't); read-only (no notify, snapshot unchanged, asserted);
  latest-of-two-bookings.
- **T10 generate_itinerary_summary** (7871c04, amended da0d390):
  verify.sh exit 0; zero-param; never errors on partial state (fresh →
  partial + missing w/ book-via pointers; flight-only → missing
  transport; tool-impossible transport-without-flight tolerated);
  complete-chain receipt exact + ≤1.5K. Review fixes: read-time honesty —
  per-entry stale_reason vs the CURRENT booking (hotel before arrival
  date; transport wrong-airport/out-of-window), status 'needs_attention'
  (stale dominates missing); missing entries carry {kind, book_via}.

Cross-cutting:
- UI (d187136): 11 registrations in App's effect; Trip-total running card
  (over-budget = red border) via the shared breakdown; hotel results,
  reservation, transport, notifications cards — all live off the single
  store subscription.
- Functional eval (73fa2d7): full chain incl. flight precondition,
  too-early hotel correction, taxi→shuttle replace, notify, over-budget →
  update_constraints(700) → within (−35.38), complete receipt, store
  end-state; + UNKNOWN_CITY and NO_CONFIRMED_FLIGHT recovery loops.
- Independent review (da0d390): reviewer ran tsc + vitest itself (green)
  and verified repros by executing the real modules; majors = the 1.5K
  breach + stale cross-tool state (both fixed as above); minors 3–11 all
  fixed (missing pointers, empty-snapshot test, ADR timestamp correction,
  distribution pins, widest-output assertions, notify caps, budgets
  beforeEach reset, ≤300-char descriptions, AC5 + multi-notification
  pins).
- Deploy: vercel deploy --prod → replan-msyxdi6hx aliased to
  https://replan-phi.vercel.app; verify.sh --url PASS exit 0 (HTTP 200,
  app shell); served bundle assets/index-CbfTzfiT.js contains ALL ELEVEN
  tool names (grep counts ≥1 each).
- No AI-attribution trailers in pushed history (re-verified post-push).

---

## Phase 2 closure audit — CLOSED (one code fix)
Date: 2026-08-31 · Commit: d0bac3c (p2c12) · Docs: docs/reviews/
{phase2-closure-audit.md, phase2-independent-review.md}

- A1: per-commit Evidence lines quoted + per-tree worktree re-runs of
  scripts/verify.sh at all 11 p2c commits — every one exit 0 / 4 PASS
  legs. Capture gap disclosed honestly (piped filters at commit time;
  commit-message Evidence lines are the contemporaneous record).
- A2: reviewer's raw report committed verbatim (first time in repo
  history a review artifact is preserved in-tree) with exact given/
  not-given context; JSONL-transcript ephemerality disclosed.
- A3: literal curl|grep outputs pasted — audit's double-quote command
  returns 0 for all six (minifier emits backtick template literals);
  corrected pattern returns exactly 1 each; full enumeration shows all
  11 tool names × exactly 1.
- A4: Phase 1 open items 3 (README AI-use disclosure — still absent,
  untouched) and 5 (demo-script turn count vs gates — deliberately
  untouched, awaiting user; Phase 2 adds three more expected gate
  tools) re-recorded in current.md WITH their Phase-1 numbering.
- B1: written separation — D008 (hotel seed+shift) was forced by the
  dispatch's 11-tool DONE criterion; the tool-count research finding
  shaped description length only. No causal claim (a)→(b) made or
  implied going forward.
- B2 (code, d0bac3c): buildCostBreakdown now surfaces
  multiple_bookings_detected + superseded_flight_ids when >1 distinct
  flight is booked (state fact, kinds-independent); total unchanged;
  cost tool + summary + UI card inherit it; plan §7 amendment 6.
  Evidence: scripts/verify.sh -> PASS (exit 0); 19 files / 188 tests
  (+2); pushed, trailer grep clean. Gate caught the tool not spreading
  the new fields + my test asserting absence on two-booking state.
- B3: the MIA-taxi→FLL-flight stale cycle is covered by ONE end-to-end
  test (src/tools/summary.test.ts:100), re-run in isolation: 1 passed.
  No gap; no new test needed.

Evidence: scripts/verify.sh -> PASS (exit 0) at d0bac3c (19 files /
188 tests); deploy re-verified after the audit fix (see current.md).

---

## Phase 1 open items 3 + 5 — CLOSED (README disclosure + 11-tool script)
Date: 2026-08-31 · Commits: a9400b3 (p2c14, README) · p2c15 (script+test)

- **Item 3 (a9400b3):** approved "## AI Assistance" section in README.md
  verbatim (between Deployed and License; diffed against the approved
  block — match). Claims pre-verified: zero attribution trailers in full
  history (anchored grep; the only naive-grep hits are the filename
  CLAUDE.md and p2c14's own message quoting the pattern), docs/ +
  agent-memory/ carry the process, increments test-gated.
- **Item 5 (p2c15):** docs/demo/eleven-tool-demo-script.md — the full
  eleven-tool narrative, 32 conversational turns (16 HUMAN + 16 AGENT),
  11 tool calls, 5 confirmation gates marked explicitly (turns 6–7,
  12–13, 18–19, 22–23, 26–27). demo-script.test.ts extended (+4 tests):
  document-structure assertions (32 turns numbered 1..32; each tool
  called exactly once; gated/ungated sets verified within each tool's own
  turn block) + the scripted sequence executed against the real modules
  (ping → search 17 → hold 14:15Z → constraints 14/FLL-lead → RPLN-FL016
  → hotels 6/HT-004 $89 → hotel shift 20:00/total 296 → shuttle
  RPLN-GT-SHUTTLE-MIA 12.62/dropoff 19:15Z → NTF-001 sms 14:03Z → cost
  664.62 over 14.62 → summary complete/missing []). No existing
  assertion changed — Phase 1's three describes still pin their turns;
  all changes are additions. Duration measured from the doc: ~240 spoken
  words ≈ 1:36 @150wpm; with tool-execution and gate beats ≈ 2:00–2:45
  wall-clock — inside the 3:00 Devpost limit.
- No src/ changes (git diff --stat -- src/ empty) — no redeploy needed.

Evidence: scripts/verify.sh -> PASS (exit 0) at p2c15; 19 files / 192
tests (+4). Both commits pushed; anchored trailer grep clean.

---

## Phase 4 — Gate 2 live wiring + deploy evidence
Date: 2026-08-31 · Commits: p4c3..p4c6 (ADR-0006/D011+plan → backend/builder/
seed → tool+tests → calibration) · Convex project `replan` (free plan),
prod deployment **resolute-malamute-859** (us-east-1); spare deployment
calm-mosquito-532 left for dashboard cleanup (no CLI delete).

- **Backend live**: `npx convex deploy` → typecheck PASS, indexes added
  (`flights.by_embedding (vector) embedding (768 dimensions)`,
  `flights.by_flight_id`). GEMINI_API_KEY set via `npx convex env set`
  (value never echoed/committed). Seed: `GEMINI_API_KEY=… npm run
  seed:semantic` → 26 rows / 768 dims / 2.0s → `npx convex import --table
  flights` → "Added 26 documents".
- **Live smoke (prod https://resolute-malamute-859.convex.site/api/
  semantic-search)**, literal: "cheapest option that leaves at dawn" →
  0.694 FL-021 | 0.690 FL-026 | 0.689 FL-005 | 0.689 FL-004 | 0.686
  FL-022 | 0.685 FL-003 | 0.683 FL-001 | 0.682 FL-023 [200, 0.576s];
  "business class with a bed" → 0.652 FL-008 … 0.616 FL-004 [200,
  0.464s]; garbage "submarine rental…" → 0.567…0.556 [200, 0.444s] —
  all below the 0.60 floor → the tool returns the valid-empty result.
  Calibration basis: on-topic 0.616–0.694 vs garbage 0.556–0.567 (floor
  sits in the gap). CORS OPTIONS preflight: HTTP 204 + full
  access-control headers; invalid body → {ok:false, INVALID_INPUT}.
- **Smoke findings fixed in p4c6**: (1) free-tier embed RPM is REAL —
  429 global_embed_content_requests_per_minute under burst (the human's
  Gate-1 concern, confirmed; absorbed by one 1.5s-backoff retry; 4/4
  clean post-fix). (2) Error codes were lost across the runAction
  boundary (custom Error fields don't serialize) — action now RETURNS
  errors-as-data. Known limitation recorded: negation doesn't invert
  ("I hate flying all night" returns red-eyes) — demo phrasings stay
  positive.
- **Vercel wiring (first deploy-time env var in repo history)**:
  `echo 'https://resolute-malamute-859.convex.site' | npx vercel env add
  VITE_CONVEX_SITE_URL production --token ~/.vercel-token` → then
  `npx vercel deploy --prod` (env bakes at build — order matters).
  `scripts/verify.sh --url https://replan-phi.vercel.app` → PASS
  (exit 0).
- **Bundle greps (served assets/index-Bx0q1nTk.js, 265,516 bytes)**:
  registration sites `name:\`<tool>\`` → all TWELVE names exactly 1 each
  (13th match is an empty `name:\`\`` minifier artifact, not a tool);
  `resolute-malamute-859.convex.site` baked exactly 1; **literal
  GEMINI_API_KEY value: 0 hits** (grep -F, exit 1) — Phase-0
  leak-absence discipline re-applied.

Evidence: scripts/verify.sh --url → PASS (exit 0) post-deploy; live
curl outputs above; 21 files / 217 tests green at e620511.

---

## Phase 4 — independent review + closure
Date: 2026-09-01 · Commits: ece718b (p4c8, review fixes) · review-fix redeploy

- **Independent review** (fresh-eyes subagent on 63f91cf..a4744db, raw
  findings disclosed in plan §7 + p4c8 message): NO majors; 9 MINOR + 7
  NIT. 12 addressed with regression coverage (uniqueIndex attempt → tool
  dedupe; --prod docs; client tests NEW 7; boundary/rounding/dedupe/cache
  tool tests; drift-proof budgets fixture; 60s query memoization; timeout
  wording; env guard; note-over-empty fix; _generated gitignore; pre-demo
  floor re-check; endpoint trim; plan provenance). Finding 3 DISPUTED
  with evidence (convex IS a devDependency). One reviewer suggestion
  unavailable in convex@1.45: `.uniqueIndex` after `.vectorIndex` →
  deploy TypeError (live); defense = CLI import-refusal (live-proven
  "Table flights already exists" without --append/--replace) + tool-side
  dedupe.
- **Discovered while testing the fixes**: vi.stubEnv cannot reach
  import.meta.env inside Vite-transformed sources AND vitest loads
  .env.local — one stubbed-env test silently hit the LIVE endpoint
  (embed_ms 190). Fixed with a test-only endpoint override
  (setEndpointOverrideForTests); client tests now hermetic.
- **Redeploy + re-verify (post-fix)**: convex deploy exit 0; live 429
  now surfaces with the CORRECT code EMBEDDING_FAILED (runAction fix
  verified live); padded query "  red-eye cheapest  " → ok:true, FL-021
  0.717 top (trim fix live); blank → INVALID_INPUT "1-200 chars after
  trimming". Vercel redeploy (replan-bg9571k8g), verify.sh --url exit 0;
  fresh bundle assets/index-D6Pri8NM.js: search_flights_semantic
  registration exactly 1, total 12 tool registrations, GEMINI key value
  0 hits.

Evidence: scripts/verify.sh -> PASS (exit 0); 22 files / 229 tests (+1
file, +12 tests over the phase); verify.sh --url -> PASS (exit 0) on the
final deploy; live curl outputs above. Phase 4 CLOSED.

## Phase 5 — twelve-tool demo script + worksheet (docs/tests complete; human run open)
Date: 2026-09-01. Commits: p5c1 `35abc5e` (docs pair), p5c2 (test
extension + memory + F006).

- docs/demo/twelve-tool-demo-script.md — ADDITIVE successor (eleven-tool
  script + Phase 3 worksheet untouched). Turns 15–18 new: mood-based
  gut-check ask → search_flights_semantic (T16) → decline → keep-it ack;
  old 15–32 renumber 19–36; turn 2 says "twelve"; two narrations
  tightened (T20, T36; disclosed). 36 turns (18H+18A), 12 calls, 5 gates
  (6–7, 12–13, 22–23, 26–27, 30–31).
- Query choice: "business class with a bed" — the only Phase 4 example
  recorded concordantly twice (p4c6 entry + e620511: FL-008 0.652 top /
  FL-004 0.616 tail) AND positively phrased. The dispatch's suggested
  "arrived earlier without a brutal layover" was NOT used: never
  live-tested + negation does not invert. Record slip fixed in
  current.md: 0.717 belongs to "  red-eye cheapest  ", dawn is 0.694.
- Live re-verification BEFORE pinning (2026-09-01, prod
  resolute-malamute-859, POST /api/semantic-search, one paced call —
  raw response recorded here per the evidence rule; this is the sole
  source of the full-precision values pinned in demo-script.test.ts's
  LIVE_BED_HITS):
  {"query":"business class with a bed"} → ok:true, hits:8, embed_ms:199,
  results in order: FL-008 0.6518698930740356 | FL-006 0.635246992111206
  | FL-023 0.6276611685752869 | FL-003 0.6235493421554565 | FL-021
  0.6214156746864319 | FL-022 0.6182296276092529 | FL-007
  0.6174138188362122 | FL-004 0.6161682605743408 — reproduces p4c6's
  rounded endpoints (0.652/0.616) and fills the middle order; all 8 ≥
  0.60 floor → tool output count:8, note "Ranked by semantic similarity
  (live index)." (3-decimal rounding verified: 0.6235493…→0.624).
- Pacing (Phase 4's 429 finding): semantic call T16 never adjacent to
  another tool call — 3 intervening turns each side (nearest calls T12 /
  T20, distance 4), exactly one semantic call. Machine-checked: the
  twelve-tool structure describe asserts call turns
  [2,4,6,10,12,16,20,22,26,30,34,36], |Δ|≥2 from T16, non-call
  neighbors, and the pacing table's presence. Both docs document it as
  an explicit table (gate-table convention) + the worksheet carries a
  "deliberately slow-walked" pre-run note and a pacing tally.
- Duration recomputed + FLAGGED (not silently crept): eleven-tool
  recounts to 373 spoken words under its own stated method — its
  published ≈240 undercounted its document (disclosed; frozen file
  untouched). Twelve-tool = 426 (H207/A219); +53 net (new turns +59,
  tightenings −6). ≈2:50 @150wpm / ≈3:33 @120 + beats → over 2:45 in
  every scenario, over 3:00 at deliberate pace. Levers in the script:
  paste/voice prompts (hand-typing ≈207 words ≈ 6 min), timed
  rehearsal, jump-cut the five "Yes." turns, optional trims ≈5 s.
- Tests: demo-script.test.ts extended in place (eleven-tool + Phase-1
  describes untouched) — twelve-tool structure (36/12/5, pacing,
  live-value doc pins) + full 12-step walk with the semantic seam
  mocked (vi.mock, hermetic). 22 files / 235 tests.
- Independent pre-commit review (read-only subagent, 10 categories —
  turn-mapping fidelity programmatically diffed, pinned values checked
  script↔worksheet↔test↔flights.json, narration facts, duration
  recount): 4 should-fix + 2 nits, ALL fixed pre-commit ("six Yes."→
  five & 13 prompts; trim deltas −2/−7/−2 ≈5 s; worksheet commit-split
  + test-count accuracy; live-response provenance recorded here;
  pacing prose/assertion aligned on non-adjacency; turn blocks
  truncated at tail sections to de-fragile the ungated-gate check).
- Per-tree evidence: worktree run at p5c1 → 22 files / 229 tests PASS
  (with .env.local present); WITHOUT .env.local, 5
  src/lib/semantic-client.test.ts failures — reproduced identically at
  30c9daa, so PRE-EXISTING (fresh-checkout gap, F006), not Phase 5.

Evidence: scripts/verify.sh -> PASS (exit 0) at the final tree; npx
vitest run -> 22 files / 235 tests (+6 over the phase); verify.sh --url
https://replan-phi.vercel.app -> PASS (exit 0); fresh build emits
assets/index-D6Pri8NM.js, identical to the served bundle; served bundle
greps twelve registrations, one per tool. REMAINING: the human run per
docs/verification/phase5-human-run-worksheet.md.
