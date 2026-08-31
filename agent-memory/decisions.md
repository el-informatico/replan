# Decisions ledger

D-series running ledger. Full Context/Decision/Consequences live in
`docs/decisions/` ADRs; this ledger carries the Why/How-applied one-liners
and links. Newest at the bottom.

## D001 — Static client-side Vite + TS(strict) + React, not Next.js
**Date:** 2026-08-31
**Why:** WebMCP is 100% client-side (`[SecureContext]` DOM API, no server
component); dataset is static; methodology demands deterministic
typecheck/lint/build/unit legs; Phase 1+ needs a tool-reactive UI.
**How applied:** current official `create-vite` react-ts template — Vite 8,
TS 6 strict, React 19, oxlint (template default; sibling ESLint convention
deliberately not replicated — ADR-0001), Vitest added. ADR:
`docs/decisions/0001-stack-choice.md`.

## D002 — Methodology §1 layout scoped for a WebMCP-only frontend
**Date:** 2026-08-31
**Why:** general-purpose tree over-fits a static frontend; each omission must
be justified, not silent.
**How applied:** kept all criterion-required layers; omitted `.claude/*`
(no repeatable workflows yet), top-level `tests/` (colocated vitest),
`health-check.sh` (folded into `verify.sh --url`); never applied backend
trees. ADR: `docs/decisions/0002-repo-layout-scoping.md`.
