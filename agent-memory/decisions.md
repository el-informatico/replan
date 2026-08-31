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

## D005 — Authoring budgets adopted and test-enforced
**Date:** 2026-08-31
**Why:** research brief (docs/research/webmcp-tool-authoring-brief.md) gives
hard guidance: ≤500-char tool descriptions, ≤150-char param descriptions,
~1.5K tool outputs, "minimum essential information" payloads.
**How applied:** p1c6 pass (compact payload cap 8 + showing-note, trimmed
descriptions, structured error codes, readOnlyHint accuracy) + p1c8 added
output-budget tests to budgets.test.ts. New tools must be added to its TOOLS
array — the one manual step.

## D006 — Static registration kept; dynamic registration deferred
**Date:** 2026-08-31
**Why:** the brief flags state-gated register/unregister as a "WebMCP
Leverage" opportunity (register hold_reservation only when results exist,
etc.). Rejected for now: judge-facing predictability (all five tools visible
immediately on any visit), ADR-0003's static-at-load commitment, and the
Sep 3 deadline make the churn a bad trade.
**How applied:** all tools register at mount; revisit only with slack, and
measure against the held-out eval set (per methodology) if tried.
