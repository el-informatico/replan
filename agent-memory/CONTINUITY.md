# CONTINUITY — Replan session handoff

Written 2026-08-31 at `main` = `d9470e8`. Paste this whole file into a fresh
session before any work. Sources are cited by path throughout; where this file
and a source disagree, the source on disk wins and this file must be fixed.

---

## 1. PROJECT

Replan is a **WebMCP Challenge Devpost submission** (webmcp.devpost.com): a
simulated flight-booking site for a Lima→Miami cancellation scenario. The
"agent" operating the site is ChatGPT itself, in its in-app browser,
discovering and calling `document.modelContext.registerTool()` tools by natural
language. There is **no custom LLM, NLU, or voice layer** — the product surface
is well-typed browser tools plus a UI that reacts live to their invocation.
Repo index and non-negotiables: `CLAUDE.md`. System shape:
`docs/architecture/overview.md`.

Methodology in use — `~/projects/ares/docs/agentic-coding-plan.md` (the
master document; read §0, §2, §5 before changing process):

- **Task contracts before code** (§2 Layer 1): every unit of work gets a
  written TASK / ACCEPTANCE CRITERIA / VERIFICATION / CONSTRAINTS / DONE ONLY
  WHEN contract before any code is generated.
- **Evidence-bound execution, no unverified "done"** (§0, §2 Layer 4): never
  accept a self-report of completion; "done" carries command + literal exit
  code + commit hash. "Should work" / "I believe this is fixed" are banned
  phrases.
- **Small verified commits** (§2 Layer 4, §5): one verified increment = one
  commit, gated by `scripts/verify.sh` exit 0; `git log` is the recoverable
  state machine.
- **Independent reviewer before closing a phase** (§3, §5): the coder never
  reviews its own work as the final gate; the reviewer sees requirement +
  implementation + evidence, not the coder's reasoning trail.

---

## 2. STATE OF THE REPO

- **Repo:** https://github.com/el-informatico/replan (public; origin
  `git@github.com:el-informatico/replan.git`; license MIT, verified via GitHub
  API — commit `caf20d7`).
- **Live URL:** **https://replan-phi.vercel.app** — the ONLY public URL. Vercel
  Deployment Protection makes deployment-hash URLs and the
  `replan-el-informatico` alias SSO-redirect; never hand judges anything else
  (failures F002; commit `caf20d7`).
- **Default branch tip:** `main` = `d9470e8` ("p1c11: close Phase 0+1 human
  verification — in-app-browser smoke PASSED"), synced with origin.
- **Deployed right now:** production serving bundle `assets/index-QbwDFBTM.js`
  (229,672 bytes), built from the app source as of `d0d9ab2`. The three
  commits after it (`948b7cb`, `e3c155c`, `d9470e8`) touched only
  `agent-memory/` and `evals/` — the served app matches current `main` src.
  Fresh evidence at handoff time: `curl` → HTTP 200; all five tool names
  grep-confirmed in the served bundle; `scripts/verify.sh` → **PASS (exit 0),
  9 test files / 76 tests**.
- **Registered WebMCP tools** (all registered statically at app mount via
  `src/tools/webmcp.ts`; declarations in `src/tools/<name>.ts`):

| Tool | One-liner | `readOnlyHint` |
|---|---|---|
| `ping` | Connectivity smoke test for the agent tool channel; echoes an optional short string with a received-at timestamp. | `true` |
| `search_flights` | Search rebooking flights from Lima; required `destination` ("MIA"/"FLL"), optional `arrive_before` (ISO w/ offset), `max_price`, `max_layover_hours`; price-ascending, compact ≤1.5K payload. | `false` (writes `lastSearch` — plan §6 amendment) |
| `hold_reservation` | Place a 15-minute wall-clock hold on a `flight_id` from search results; one active hold per flight; note states the simulation. | absent |
| `update_constraints` | Change traveler constraints (`max_price`, `max_layover_hours`, `preferred_time`; `null` clears) and **re-run the search immediately** — returns new results, not an acknowledgment. | absent |
| `confirm_booking` | Book a flight that has an active hold; returns the final itinerary with a deterministic `RPLN-<slug>` confirmation ref; idempotent. | absent |

- **Key source map:** registrar `src/tools/webmcp.ts`; validators
  `src/tools/validate.ts`; store `src/state/store.ts` (ADR-0004); pure search
  `src/domain/search.ts`; dataset `src/data/flights.json` (26 flights) +
  `src/domain/flights.ts` (`validateDataset`); budget enforcement
  `src/tools/budgets.test.ts`; UI `src/App.tsx` (subscribes to store +
  tool-call log). Eval suites: `evals/functional/` (rebooking narrative,
  demo-script pinning).
- **Scenario anchor:** cancelled LIM→MIA nonstop (AA 918, 2026-09-12); traveler
  must reach MIA or FLL before a PortMiami cruise boarding close at
  2026-09-13T15:00−04:00. Canonical constraint defaults in
  `scenario.constraints_hint` — `docs/domain/flight-dataset.md`.

---

## 3. PHASE HISTORY

Only Phases 0 and 1 exist; both CLOSED and VERIFIED. Phase 2 (multi-domain:
hotel / ground-transport / notification / cost-summary) is planned in
`agent-memory/current.md` but has **no execution plan and no contracts yet**.
Full per-increment history: `git log --oneline` (18 commits, `e1ce1a8` →
`d9470e8`). House note: this project's evidence blocks are command + literal
exit code + commit hash (convention recorded in
`docs/plans/phase0-execution-plan.md` §2.3); the pinned tool-output JSON lives
in full in `agent-memory/current.md`.

### Phase 0 — Foundation (`e1ce1a8` → `caf20d7`, closed 2026-08-31)

Built: repo skeleton + Vite/TS(strict)/React 19 scaffold + `scripts/verify.sh`
(`e1ce1a8`); synthetic 26-flight dataset + invariant validator + schema doc
(`ad0a9a9`); WebMCP registrar + `ping` smoke tool + live tool-call UI
(`5229807`, `8cdccd0`); production deploy + memory closure (`7bd6999`); GitHub
remote live + protection status + smoke procedure (`caf20d7`).

Real evidence (quoted from `agent-memory/progress.md` and commit messages):

- Dataset: `Test Files 1 passed (1), Tests 8 passed (8)` — zero
  `validateDataset()` violations + discriminator tests on both sides of every
  scenario constraint.
- Web skeleton: `scripts/verify.sh` → `verify.sh: PASS (exit 0)`; served
  bundle contains the tool descriptor: `curl -s
  https://replan-phi.vercel.app/assets/index-*.js | grep -oc 'name:"ping"'`
  → `1`.
- Deploy: `vercel deploy --prod --yes --token …` → deployment Ready
  (production); `scripts/verify.sh --url https://replan-phi.vercel.app` →
  `PASS: deploy smoke (HTTP 200, app shell present)` + `verify.sh: PASS
  (exit 0)`.
- Repo/license (`caf20d7`): `gh api repos/el-informatico/replan` → license
  MIT / public; `curl replan-phi.vercel.app` → 200 direct; pushed history
  re-verified clean of AI-attribution markers.

Key ADRs: **ADR-0001** (`docs/decisions/0001-stack-choice.md`) — static
client-side Vite + TS strict + React, NOT Next.js (WebMCP is 100% client-side,
dataset static, verify.sh needs deterministic legs). **ADR-0002**
(`0002-repo-layout-scoping.md`) — methodology §1 tree scoped down with every
omission justified in a table, never silent. **ADR-0003**
(`0003-webmcp-registration-pattern.md`) — one registrar module, static
registration at load, abort-before-reregister, errors-as-data envelope, local
minimal TS types (no `webmcp-types` dependency).

Disclosed deviations (none silent):

- Git history rewritten once (2026-08-31) to strip AI co-author trailers per
  the user's rule — recorded in `agent-memory/progress.md`; post-rewrite hashes
  are the canonical ones.
- oxlint instead of the sibling convention ESLint 9 flat — deliberate,
  justified in ADR-0001 (template default, still a deterministic computational
  control).
- GitHub push slipped past the phase boundary (criterion 6 "pending push" in
  `progress.md`) — closed in the follow-up commit `caf20d7`.
- Explicit verification gap: live agent discovery of `ping` NOT verified
  in-session (headless WSL2) — carried as the human open item; later
  user-confirmed (recorded in `agent-memory/current.md` open item 1).

### Phase 1 — Core flight tools (`9f0f125` → `d9470e8`, closed 2026-08-31)

Built: plan + per-tool Layer-1 contracts + ADR-0004 (`9f0f125`); store + pure
search + `search_flights` (`1c015e7`); `hold_reservation` (`aa2dfa8`);
`update_constraints` (`666e6cc`); `confirm_booking` (`d1fbe3b`); authoring
brief pass + `budgets.test.ts` (`4fd5c7e`); full live-reactive UI (`0c75c33`);
independent-review fixes + functional eval + contract amendments (`d0d9ab2`);
deploy evidence + memory closure (`948b7cb`); machine-verified demo script
(`e3c155c`); human in-app-browser verification PASSED (`d9470e8`).

Real evidence (quoted from `agent-memory/progress.md` and commit messages):

- Per tool — `verify.sh` exit 0 each; T2 exact +15min expiry at injected clock
  (12:00→12:15Z); T3 merged re-search spans MIA+FLL (max_price=300 test
  asserts both airports, all rows ≤300); T4 deterministic ref, idempotent
  re-confirm byte-identical + `idempotent:true`, booking count 1 **including
  the confirm→re-hold→confirm cycle**.
- Independent review (diff `caf20d7..0c75c33`): 8 confirmed findings (1 major),
  all fixed with regression tests in `d0d9ab2` — evidence line:
  `scripts/verify.sh → PASS (exit 0); unit 8 files / 73 tests passed
  (8 new since p1c7: stray-hold consumption, exact layover boundary, calendar
  rollovers + leap day, null-clear, output budgets, 3 narrative evals)`.
- Deploy (`948b7cb`): `verify.sh --url https://replan-phi.vercel.app` → exit
  0; served bundle `assets/index-QbwDFBTM.js` contains each of the five tool
  `name:`s ×1; T1+T3 narrative executed against the real tool modules in
  `evals/functional/rebooking-narrative.test.ts`.
- Human smoke test, Path A (ChatGPT Desktop in-app browser), PASSED
  2026-08-31 — from the outcome block in `agent-memory/current.md`, with the
  machine-pinned JSON values it asserted:
  - `ping` → `{"ok":true,"pong":true,"echo":"ready",…}`
  - `search_flights` → `{"ok":true,"count":17,…}` first row
    `{"id":"FL-015", … "price_usd":299}`, price-ascending
  - `hold_reservation` FL-016 → `"ttl_minutes":15`, expiry exactly 15 min out
  - `update_constraints {max_layover_hours:2}` → `count` 17→14, FL-015
    dropped, FLL alternates promoted at `$198/$221/$267/$289`, FL-016 hold
    survived, live UI re-render
  - `confirm_booking` → `"confirmation_ref":"RPLN-FL016"`
  - Final gate (`d9470e8`): `scripts/verify.sh → PASS (exit 0), 9 files /
    76 tests`.

Key ADRs: **ADR-0004** (`docs/decisions/0004-simulated-booking-state.md`) —
module-level in-memory observable store (`src/state/store.ts`) with injectable
clock and lazy expiry; React state, localStorage, and any backend each rejected
with reasons in the ADR. Ledger D005 (authoring budgets, test-enforced) and
D006 (static registration kept, dynamic deferred) in
`agent-memory/decisions.md`.

Disclosed deviations (none silent):

- **Contract amendments, post-review** (`docs/plans/phase1-execution-plan.md`
  §6): T1 AC6 `readOnlyHint: false` (tool writes `lastSearch` — honest
  annotation over the original plan line); T1 AC5 split domain-full vs
  tool-compact field sets. Amended in the open, in the plan file.
- Commit-plan drift: plan §3 sketched p1c1–p1c7; execution ran p1c1–p1c11,
  splitting the tail (UI / review fixes / closure / demo-script test / human
  verification) — each still exactly one verified increment per commit.
- seats_left never decremented on hold (dataset static) — documented in
  contract T2 CONSTRAINTS, not silent.
- The demo script's turn-count discrepancy (script assumes no confirmation
  gates; reality has two) is **flagged, deliberately not auto-corrected** —
  see `agent-memory/current.md` "Flagged discrepancy" note.

---

## 4. OPEN ITEMS (verbatim from `agent-memory/current.md`)

Copied verbatim except one elision, marked, per this document's scope rule:

1. **Phase 0 in-app-browser verification: CLOSED** — user-confirmed
   (Phase 1 dispatch, 2026-08-31).
2. **Phase 1 in-app-browser verification: CLOSED — PASSED 2026-08-31**
   (details at the top of this file; full script with results below).
3. (User, non-blocking) AI-use disclosure in the GitHub README.
4. (Optional polish) Dynamic tool registration (register hold/confirm only
   in matching page states) is a scored "WebMCP Leverage" opportunity
   deliberately deferred — see D006 for the reasoning; revisit only if
   there's slack before the *[deadline elided — supplied separately]*.
5. **(Planning input, awaiting user decision)** the demo script's turn
   count vs. the observed confirmation gate — see "Observed" section
   below; script text deliberately NOT updated without confirmation.

---

## 5. STANDING RULES THE NEXT SESSION MUST FOLLOW

From `~/projects/ares/docs/agentic-coding-plan.md` (§0, §2, §5) and this
project's `CLAUDE.md` non-negotiables + accumulated convention:

- **Evidence-bound "done".** Never accept or emit a self-report of completion.
  "Done" = the evidence block: command + literal exit code + commit hash.
  Banned: "should work", "I believe this is fixed". (§0 corollary 1; §2
  Layer 4; `CLAUDE.md` rule 1.)
- **Task contracts before implementation.** Every unit of work gets the
  Layer-1 contract (TASK / ACCEPTANCE CRITERIA / VERIFICATION / CONSTRAINTS /
  DONE ONLY WHEN) before code. Per-tool format precedent:
  `docs/plans/phase1-execution-plan.md` §2. No business-logic tools before
  their contracts exist. (§2 Layer 1; `CLAUDE.md` rules 3–4.)
- **One verified increment = one commit**, gated by `scripts/verify.sh`
  exit 0 — including docs-only commits. A bad iteration is a `git reset`,
  not a lost session. (§2 Layer 4.)
- **Independent review before closing a phase** — reviewer subagent on the
  phase diff (validation gaps, state-machine holes, description quality)
  BEFORE deploy. The coder never reviews its own work as the final gate.
  (§3, §5.)
- **No AI-attribution trailers in commits** (no co-author lines, no
  "generated with" trailers) — user rule; AI use is disclosed in the README
  only. **Re-verify after every push** that the remote history is clean
  (Phase 0 history was rewritten once for this — `agent-memory/progress.md`).
- **Errors as data, not thrown exceptions.** Every tool returns
  `{ok:true,…}` or `{ok:false, code, error:"what was wrong + how to fix"}`;
  `execute` never deliberately rejects. Validate inputs inside `execute` —
  the browser does NOT validate against `inputSchema`. (ADR-0003;
  `docs/architecture/webmcp-integration.md`.)
- **Cross-tool state goes through the store** (`src/state/store.ts`,
  ADR-0004 pattern): module singleton + `subscribe` + injectable clock
  (`setClockForTests`, used by ALL time logic incl. UI countdowns) +
  `resetForTests()` in beforeEach + lazy expiry, no background timers. This
  is the precedent for any future cross-tool state need.
- **New tools:** follow the established pattern (`WebMcpTool` object in
  `src/tools/<name>.ts`, budgets: description ≤500 chars / params ≤150 /
  output ≤1.5K compact ≤8 rows, `logToolCall`, `registerX()` in App's effect)
  — and **add the tool to the `TOOLS` array in `src/tools/budgets.test.ts`**;
  that mechanical check is the one manual step. Use `src/tools/validate.ts`
  validators; never hand-roll parsing.
- **Deploy discipline:** deploy per `agent-memory/current.md` (§ "What Phase
  2 should assume", item 6), then `scripts/verify.sh --url
  https://replan-phi.vercel.app` + grep the served bundle for the new tool
  names. Only the `replan-phi` alias is public (F002).
- **Held-out evals are never used for tuning** (`evals/held_out/` — §2
  Layer 5). Phase discipline: build only what the current phase's contract
  requires (`CLAUDE.md` rule 3).
- **Environment facts** (carry forward, from `agent-memory/current.md` §
  "Session environment notes"): loopback TCP blocked for this assistant's
  shell (no local preview smokes — use the deployed URL); never `pkill -f`
  with self-matching patterns (`fuser -k PORT/tcp` instead); WSL OAuth
  callbacks fail, token-file auth is the path; GitHub via `gh` (ssh) works
  directly.

---

## 6. LESSONS WORTH CARRYING FORWARD

### From `agent-memory/lessons.md` (L001–L004, condensed — file is canonical)

- **L001 — WebMCP facts that are load-bearing (and the stale-material trap).**
  Current spec (rev 41d12f0): `document.modelContext` (NOT
  `navigator.modelContext`), async `registerTool`, unregistration is
  signal-abort only, browser does NOT validate against `inputSchema`,
  `[SecureContext]` means plain HTTP silently lacks the API — always
  feature-detect. Trust only webmachinelearning.github.io/webmcp,
  developer.chrome.com/docs/ai/webmcp, learn.chatgpt.com/docs/webmcp, and
  re-verify before Phase 2 (API is young). Keep `src/tools/webmcp.ts` types
  in sync with the spec.
- **L002 — Process footguns in this machine's session environment.**
  `pkill -f` self-matching patterns kills the invoking shell (exit 144) — use
  `fuser -k`. Give the user script files, not pasted one-liners, for anything
  touching secrets/history. Token files beat browser OAuth flows here.
- **L003 — Parse and boundary honesty.** `Date.parse` rolls impossible
  datetimes forward (2026-02-30 → Mar 2) instead of NaN — validate calendar
  semantics (day ≤ days-in-month, hour ≤ 23), not just format. Numeric bounds:
  compare against the exact product, never `Math.round`-ed (4.7499h once
  passed a 284.994-min cap). Regression-test at just-under / exactly-at.
- **L004 — A named cycle in a contract's verification list IS a test spec.**
  The plan named "confirm after confirm-then-hold-again cycle"; no test
  existed; the reviewer found the implementation broken on precisely that
  cycle. Walk the VERIFICATION section line-by-line and map each line to a
  test in the SAME increment that ships the code.

### From `agent-memory/failures.md` (F001–F005 — root cause + cost)

- **F001** loopback TCP blocked in this shell (listener visible, curl times
  out; persists sandbox-off) — cost 2 iterations. Outcome: smoke the deployed
  URL only; readiness loops always bounded (`--max-time`, capped iterations).
- **F002** deployed URL served an SSO login page (Deployment Protection;
  `curl -L` followed to a 200 login) — caught by the verify.sh app-shell
  marker check; fix = public alias only. Cost 1 iteration.
- **F003** redundant `Promise<>` wrapper on `registerPing` failed typecheck —
  let inference carry promise types. Cost 1 iteration (gate caught it
  pre-commit, as designed).
- **F004** calendar-rollover test over-asserted one specific error message
  for an input rejected at an earlier validation layer — scope message
  assertions to inputs that can only fail at that layer. Cost 1 iteration.
- **F005** reviewer found the cycle the test list named but no test covered
  (→ L004). Cost 1 post-review fix iteration, caught before deploy.

### Human-observed (2026-08-31): ChatGPT's write-action confirmation gate
### tracks perceived stakes, not the `readOnlyHint` annotation

From `agent-memory/current.md` § "Observed": during the PASSED human smoke
test, ChatGPT Desktop's in-app browser inserted an extra "Would you like me to
proceed?" → human "Yes" turn before executing BOTH transactional tools
(`hold_reservation`, `confirm_booking`), while `ping`, `search_flights`, and
`update_constraints` executed directly.

- The gate did **not** map 1:1 onto `readOnlyHint`: `update_constraints`
  carries no read-only marking (annotation absent in `src/tools/constraints.ts`;
  `current.md` phrases it as "annotated false" — either way, NOT advertised
  read-only) yet ran ungated. ChatGPT judged per-tool stakes (booking/spending
  actions vs. preference updates). Single data point; treat as observation,
  not spec. (Verified in code this session: only `ping` has `readOnlyHint:
  true` and `search_flights` `false`; the three mutating tools carry no
  annotation.)
- It is ChatGPT's own per-invocation safety review — NOT controllable from
  the page; no WebMCP API suppresses or customizes it. Not a bug in this
  implementation.
- **DESIGN INPUT FOR ANY NEW TRANSACTIONAL TOOL:** a future `notify_*` or
  booking-ish tool should be EXPECTED to hit the same gate when the agent
  drives it. Budget two extra human "Yes" turns in any demo narrative that
  includes it (the five-tool demo plans ~8 spoken turns, not 6), and leave
  pacing room around the hold and confirm turns.
