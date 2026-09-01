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
