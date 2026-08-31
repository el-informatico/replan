# ADR-0002: Repository layout scoped down from the methodology's §1 tree

- **Status:** Accepted
- **Date:** 2026-08-31
- **Ledger:** D002 in `agent-memory/decisions.md`

## Context

The upstream methodology (`~/projects/ares/docs/agentic-coding-plan.md` §1)
specifies a general-purpose agent-legible layout. This project is a
**WebMCP-only static frontend with a local synthetic dataset** — no backend, no
services, no containers. The Phase 0 dispatch requires each omitted or
simplified layer to be justified rather than silently dropped.

## Decision

**Keep** (all Phase 0 acceptance criteria): `CLAUDE.md` (index style),
`docs/architecture/`, `docs/decisions/` (ADR files — note: no sibling ever
populated this dir; decisions lived in `agent-memory/decisions.md`; this
project does both, ADR file + D-ledger entry), `docs/domain/`, `docs/plans/`,
`agent-memory/{current,progress,decisions,failures,lessons}.md`,
`evals/{functional,regression,e2e,held_out}/`, `scripts/verify.sh`,
git history as state machine (one commit per verified increment).

**Omit or simplify**, with reasons:

| §1 layer | Disposition | Why |
|---|---|---|
| `.claude/skills/` | Omit (Phase 0) | Nothing has repeated ≥2 times yet worth packaging; a skill added before a real workflow exists is speculative surface. Revisit when a recurring workflow (e.g. "add-webmcp-tool") emerges in Phase 1+. |
| `.claude/agents/` | Omit (Phase 0) | Planner/Coder/Reviewer role split is a Phase 4 concern of the methodology; premature here. |
| `.claude/hooks/`, `.claude/commands/` | Omit (Phase 0) | No stop-hook enforcement loop in this dispatch; `verify.sh` gating is enforced by the non-negotiable rules in `CLAUDE.md` and by the dispatch's evidence-block requirement. |
| `tests/` (top-level) | Simplified | Vitest tests are colocated (`src/**/*.test.ts`) so `tsc -b` typechecks them; behavioral/scenario tests belong under `evals/`. A parallel top-level `tests/` tree would split one concern across two places. |
| `scripts/health-check.sh` | Omit | Nothing long-running to health-check; the only liveness question is "is the deploy up," which `verify.sh --url <deployed>` answers directly. |
| Backend trees (`services/`, `infra/`, docker, CI wiring) | Never applied | Static frontend + static JSON dataset; deployment is Vercel's static build. |

## Consequences

- The tree stays shallow enough to orient in one screen — the point of an
  agent-legible repo.
- Every omission above is reversible and dated; when Phase 1 adds the
  "add-webmcp-tool" workflow, `.claude/skills/` is the first thing to revisit.
- `evals/*` dirs exist now with READMEs stating purpose, so their emptiness is
  documented intent, not accident.
