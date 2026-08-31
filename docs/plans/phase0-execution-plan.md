# Phase 0 — Foundation: Execution Plan

Date: 2026-08-31 · Status: EXECUTING · Owner: Claude Code (GLM 5.3[1m] via Z.ai)

## 1. Task contract (Definition of Done)

```
TASK: Replan Phase 0 — Foundation (repo skeleton, dataset, WebMCP smoke tool, deploy)
ACCEPTANCE CRITERIA:
  1. Agent-legible repo layout per agentic-coding-plan.md §1, scoped to a
     WebMCP-only frontend; omissions justified in docs/decisions/
  2. Synthetic flight dataset, static JSON, 20–30 flights, Lima→Miami
     cancellation scenario; fields cover destination / arrival-deadline /
     max-price / max-layover filtering; schema documented in docs/domain/
  3. Minimal deployable web skeleton; stack justified in docs/decisions/;
     one smoke tool "ping" registered via document.modelContext.registerTool()
     with trivial input schema and trivial return
  4. Deployed to a public URL (Vercel); scripts/verify.sh runs clean locally
     and smoke-checks the deployed URL
  5. agent-memory/current.md + progress.md reflect actual end-of-phase state
  6. MIT LICENSE at repo root, positioned for GitHub About detection
VERIFICATION: scripts/verify.sh exit 0 (typecheck + lint + build + unit);
curl smoke of deployed URL; manual WebMCP discovery check (browser — see open items)
CONSTRAINTS: no business-logic tools (no search_flights etc.); evidence blocks
only; one commit per verified increment
DONE ONLY WHEN: all six criteria carry passing cited evidence
```

## 2. Research synthesis (delegated, 2026-08-31)

Three subagents investigated in parallel; findings cross-checked, no conflicts.

### 2.1 WebMCP API surface (spec rev 41d12f0, 2026-08-21)

- `document.modelContext.registerTool({ name, description, inputSchema, execute, annotations?, title? }, { signal?, exposedTo? })` → `Promise<undefined>` — https://webmachinelearning.github.io/webmcp/
- `[SecureContext]`: HTTPS or localhost only; feature-detect with
  `typeof document.modelContext?.registerTool === "function"` (OpenAI's own pattern, https://learn.chatgpt.com/docs/webmcp)
- `inputSchema` is a JSON Schema **object** (not string); browser does NOT
  validate inputs against it — validate inside `execute`, return descriptive
  error text as a successful result so the model can retry (Chrome best practices)
- `execute(inputObject, { signal })` → any JSON-serializable value; plain
  objects/strings are what OpenAI's docs return (no MCP `{content:[...]}` envelope needed)
- No `unregisterTool()`: unregistration = `AbortController.abort()`
- Tools die with the document → registration script must run on every page load
- Re-registering an existing name rejects (`InvalidStateError`) — abort the old
  signal first
- Tool name charset: `[A-Za-z0-9_.-]`, 1–128 chars ("ping" is valid)
- Access paths: ChatGPT desktop in-app browser (WebMCP on by default, imperative
  API only, top-level page only — no iframes) or Chrome 149+ with
  `chrome://flags/#enable-webmcp-testing`
- Stale-API trap: pre-mid-2026 material shows `navigator.modelContext`,
  sync register, `unregisterTool(name)` — all wrong now

### 2.2 Challenge rules (https://webmcp.devpost.com/ + /rules)

- Deadline **Sep 3, 2026, 1:00 pm PT** (open as of 2026-08-31); winners ~Sep 23
- Submission requires: live URL, public repo (GitHub/GitLab/Bitbucket) that is
  open source with a license file "detectable and visible at the top of the
  repository page (in the About section)", <3 min video, text description
- Rules quote `document.modelContext.registerTool({ name, description, inputSchema, execute })` verbatim
- "OSI-approved" not literally stated; MIT at root satisfies detection
- Judges access via ChatGPT in-app browser or Chrome+flag; no deploy platform
  is required or preferred (Vercel/Netlify both supporters)

### 2.3 House conventions (siblings: ares, touchpoint-teller, ai-banking-gateway)

- agent-memory: append-only ledgers, newest at bottom; current.md rewritten in
  place; evidence = command + literal exit code
- verify.sh: `set -uo pipefail` (not `-e`), `===` banners, explicit PASS/FAIL,
  exact exit-code propagation
- Method-conformant frontend precedent: Vite + React 19 + TS strict + ESLint 9
  flat + Vitest (touchpoint-teller/app/teller-ui)
- No WebMCP work in any sibling — first here

## 3. Decisions (full ADRs in docs/decisions/)

| # | Decision | Rationale |
|---|----------|-----------|
| D001 | Static client-side app: Vite + TypeScript + React 19; **not** Next.js, not a no-tooling HTML file | WebMCP is 100% client-side; zero server runtime needed. Next.js adds a framework for nothing. Vite+TS+React matches the house method-conformant frontend (teller-ui) and gives verify.sh deterministic legs (typecheck/lint/build/unit). React stays because later phases need a UI that reacts live to tool calls. |
| D002 | Scope §1 layout down: omit `.claude/{skills,agents,hooks,commands}`, top-level `tests/`, `scripts/health-check.sh`; keep everything the criteria require | No repeatable workflows yet to package as skills; vitest tests colocated + evals/ carry test intent; health-check collapses into `verify.sh --url`. ADR-0002 records each omission. |
| D003 | One registrar module registering statically at load; feature-detect + `AbortController`; local minimal TS types for `ModelContext` (no `webmcp-types` dependency) | Registration must run every page load anyway; abort-before-reregister avoids InvalidStateError; a 15-line local interface avoids supply-chain risk on an unstable API. |

## 4. Commit plan (one verified increment = one commit)

1. **c1 repo skeleton + app scaffold** — git init, layout, CLAUDE.md index,
   ADR-0001/0002, agent-memory seeds, evals/ READMEs, scripts/verify.sh,
   LICENSE (MIT), Vite+TS+React hello app. Verify: `scripts/verify.sh` exit 0.
2. **c2 dataset** — src/data/flights.json (~26 flights), docs/domain/flight-dataset.md,
   src/domain/flights.ts (types + invariant validator), tests/flights.test.ts
   (vitest, schema + filter-field coverage). Verify: verify.sh green incl. unit leg.
3. **c3 ping tool** — src/tools/webmcp.ts (registrar + local types),
   src/tools/ping.ts, App shows registration status + live tool-call log;
   ADR-0003; architecture doc. Verify: verify.sh green (UI check manual).
4. **c4 deploy + memory finalization** — Vercel prod deploy, `verify.sh --url`
   smoke green, agent-memory/{current,progress,decisions} updated with evidence
   blocks. Verify: curl evidence captured in progress.md.

## 5. Verification matrix

| Criterion | Evidence |
|---|---|
| 1 layout | `find` tree + ADR-0002 text, commit c1 |
| 2 dataset | vitest invariants green (unique ids, ISO parse, arrive>depart, layover consistency, 20–30 rows, MIA/FLL only), commit c2 |
| 3 ping tool | verify.sh green; `grep` shows registerTool descriptor fields; manual browser check (open item) |
| 4 deploy + verify | `vercel --prod` URL + `curl -sI` 200 + HTML contains app marker, `scripts/verify.sh --url <URL>` exit 0 |
| 5 memory | current.md/progress.md content at c4 |
| 6 license | LICENSE at root (MIT); GitHub About render = **user-involved open item** (no gh CLI, no remote) |

## 6. Open items requiring the user (blocking, flagged early)

1. **Vercel auth**: CLI 37.2.1 present, `vercel whoami` → no credentials.
   Need `! vercel login` before c4.
2. **GitHub repo**: no `gh` CLI, no remotes anywhere on this machine. Challenge
   requires a public repo; About-section license check needs it. User must
   create the repo + push (or install/auth gh). Tracked in current.md.
3. **Manual WebMCP discovery check**: this session is headless WSL2 — no
   ChatGPT in-app browser and no flag-enabled Chrome available to me. Both
   verification paths are user-manual; instructions + open item recorded in
   current.md per dispatch requirements.

## 7. Scenario anchor for the dataset (design note)

Original booking LIM→MIA cancelled; traveler must reach Miami before a cruise
departing PortMiami. Rebooking window: 2026-09-12 evening → 2026-09-13 morning
(EDT). Mix: nonstop/red-eye/1–2 stops, MIA majority + FLL alternates (later
ground-transport phase), price spread ~$180–$950, layovers 0–6h+ so
max-layover filtering has discriminating power. Timezones: America/Lima (UTC−5,
no DST) and America/New_York (UTC−4 until 2026-11-01) — ISO strings carry
explicit offsets.
