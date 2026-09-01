# Lessons

Reusable discoveries worth carrying across phases; promoted into
`.claude/skills/` when they harden into workflows. Format: `## LNNN —
imperative title`, `**Date:**`, `**Where:**`, narrative, `**How to apply:**`
bullets. Newest at the bottom. AMEND with a dated note when a lesson turns
out version- or context-dependent.

## L001 — WebMCP facts that are load-bearing (and the stale-material trap)
**Date:** 2026-08-31
**Where:** Phase 0 research synthesis (docs/plans/phase0-execution-plan.md §2.1).

The 2026-08-31 spec snapshot (rev 41d12f0) differs from most pre-mid-2026
blog material: it is `document.modelContext` (not `navigator.modelContext`),
`registerTool` is async and takes `{name, description, inputSchema, execute}`
plus optional `{signal}` options, unregistration is signal-abort only, and
the browser does NOT validate input against `inputSchema`. `[SecureContext]`
means plain-HTTP hosting silently lacks the API — always feature-detect.

**How to apply:**
- Trust only webmachinelearning.github.io/webmcp, developer.chrome.com/docs/ai/webmcp,
  and learn.chatgpt.com/docs/webmcp; re-check before Phase 1 (API is young).
- Keep the local types in `src/tools/webmcp.ts` in sync with the spec —
  they are the single integration point (ADR-0003).
- Errors as returned data (not rejections) so ChatGPT can self-correct.

## L002 — Process footguns in this machine's session environment
**Date:** 2026-08-31
**Where:** Phase 0 deploy/smoke work (failures F001/F002 context).

`pkill -f <pattern>` kills the invoking shell itself when the pattern occurs
in its own command line (exit 144, truncated output) — kill by port
(`fuser -k PORT/tcp`) instead. Interactive helpers for the user belong in a
script file (`/tmp/save-vercel-token.sh` pattern), because pasted one-liners
get mangled by history expansion (`!read` recalls the last `read`-command —
an unrelated old secret-prompt!) and `read -s` still runs readline (Tab
lists files). WSL OAuth callbacks (vercel login) fail under mirrored
networking — token files beat browser flows here.

**How to apply:**
- Never `pkill -f` self-matching patterns; prefer `fuser -k`.
- Give the user scripts to run, not multi-line pastes, for anything touching
  secrets or history.
- Auth in this environment: `--token "$(cat ~/.vercel-token)"`.

## L003 — Parse and boundary honesty: V8 rolls, Math.round rounds
**Date:** 2026-08-31
**Where:** reviewer findings 3+4 (Phase 1).
Two silent-correctness traps in input handling: (a) `Date.parse` accepts
impossible datetimes by rolling them forward (2026-02-30 → Mar 2) instead of
returning NaN — regex + NaN checks do NOT catch them; validate calendar
semantics (day ≤ days-in-month via `new Date(Date.UTC(y, m, 0))`, hour ≤ 23).
(b) `Math.round(bound * 60)` on user-supplied bounds admits values over the
requested cap (4.7499h → 285min passed a 284.994min cap). Compare against the
exact product.
**How to apply:** every numeric bound compares exact; every datetime input
gets semantic validation (see getIsoDatetime); add regression tests at the
boundary (just-under / exactly-at).

## L004 — A named cycle in a contract's verification list IS a test spec
**Date:** 2026-08-31
**Where:** reviewer finding 1 / failures F005.
The plan named "confirm after confirm-then-hold-again cycle" under T4
VERIFICATION; no test existed; the reviewer found the implementation broken
on precisely that cycle. Contract verification lists are executable
specifications — each named cycle gets a test in the same increment that
ships the feature.
**How to apply:** when writing a tool against a contract, walk the
VERIFICATION section line-by-line and map each line to a concrete test
before claiming done.

## L005 — Preflight a mechanism with a proxy, but never calibrate thresholds from it
**Date:** 2026-09-01
**Where:** Phase 4 Gate 1 → Gate 2 (ADR-0006 amendment; p4c6 recalibration).

Gate 1 proved the Convex vector-search loop with a local MiniLM model
(on-topic cosine 0.29–0.37) — correct for mechanism, and the only option
before the provider pick. But the initial contract carried a relevance
floor of 0.15 sitting under MiniLM's band. Production shipped Gemini,
whose cosine range is compressed (on-topic 0.616–0.694, garbage
0.556–0.567) — the 0.15 floor could NEVER fire there, so garbage would
have been returned as matches. The Gate-2 smoke caught it only because it
deliberately included an off-topic calibration query; the floor was
recalibrated live to 0.60.

**How to apply:**
- Score distributions do NOT transfer across embedding providers (or
  model versions) — never ship a threshold constant derived from a proxy.
- Structure provider-gated phases as: preflight mechanism with any proxy →
  provider pick → **provider-specific calibration pass before or
  immediately after integration**, with on-topic AND off-topic probe
  queries, before any threshold ships.
- Make the calibration probes part of the contract's VERIFICATION list so
  a reviewer/test can fail the phase without them (the Phase-4 smoke's
  garbage query is what saved this; see ADR-0006 amendment 2026-09-01).
