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
