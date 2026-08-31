# ADR-0001: Static client-side app — Vite + TypeScript + React, not Next.js

- **Status:** Accepted
- **Date:** 2026-08-31
- **Ledger:** D001 in `agent-memory/decisions.md`

## Context

Phase 0 needs a minimal deployable web skeleton, and the dispatch asks for an
explicit, justified choice between "plain JS" and Next.js. Hard constraints
from the product shape:

1. **WebMCP is 100% client-side.** `document.modelContext` is a `[SecureContext]`
   DOM API on the top-level document. There is no server component to the tool
   protocol — nothing a server framework could add to tool discovery or
   invocation (W3C WebMachine Learning spec, rev 41d12f0, 2026-08-21;
   https://webmachinelearning.github.io/webmcp/).
2. **The dataset is static** (~26 synthetic flights as JSON) and must remain a
   plain file for later embedding/indexing work — no DB, no API routes.
3. **The methodology demands deterministic verification legs** — typecheck,
   lint, build, unit tests wired into `scripts/verify.sh`
   (`~/projects/ares/docs/agentic-coding-plan.md` §2 Layer 3: prefer
   computational controls). A no-tooling `index.html` file gives none of those.
4. Later phases need a UI that **reacts live to tool calls** (holds, cost
   summary, constraint updates) — a component model earns its keep there.

The method-conformant sibling frontend (`~/projects/projects/touchpoint-teller/app/teller-ui`,
built under the same plan) is Vite + React + TS strict + ESLint flat + Vitest.

## Decision

**Vite + TypeScript (strict) + React 19, generated from the current official
`create-vite` `react-ts` template** (Vite 8, TS 6, oxlint — the template's
current default linter), plus Vitest for unit tests. A static SPA building to
`dist/`, deployed as static files. Explicitly:

- **Not Next.js**: a server-rendered framework for a purely client-side tool
  surface. It would add runtime, config, and deploy moving parts with zero
  product benefit, and the challenge explicitly allows any static host
  (webmcp.devpost.com/rules §4).
- **Not a no-tooling plain-HTML file**: "plain JS" in the minimal sense can't
  give `verify.sh` deterministic typecheck/lint/build legs, and would force a
  re-scaffold the moment the tool-reactive UI lands.

One deliberate deviation from the sibling convention: **oxlint instead of
ESLint 9 flat config**, because the official template now ships oxlint as its
default. Both are deterministic computational controls satisfying the
methodology; keeping the template's default avoids hand-maintained lint config
drift during a 3-day challenge window.

## Consequences

- Deploy is a static `dist/` upload (Vercel auto-detects Vite; no server).
- React's weight is carried from Phase 0 but prevents a re-scaffold in Phase 1.
- Tests are colocated in `src/**/*.test.ts` (Vitest, node environment) so
  `tsc -b` typechecks them — no separate top-level `tests/` tree (ADR-0002).
- Localhost dev counts as a secure context, so WebMCP works in `npm run dev`
  under a flag-enabled Chrome — convenient for development.
