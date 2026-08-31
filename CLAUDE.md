# Replan — Agentic Travel Recovery

WebMCP Challenge submission (webmcp.devpost.com, deadline 2026-09-03): a
simulated flight-booking site for a Lima→Miami cancellation scenario. The
"agent" operating this site is ChatGPT itself, in its in-app browser,
discovering and calling `document.modelContext.registerTool()` tools by natural
language. There is no custom LLM, NLU, or voice layer in this codebase — the
product surface is well-typed browser tools plus a UI that reacts live to
their invocation.

This file is an **index**, not an encyclopedia — follow the pointers.

## Start here, every session

1. `cat agent-memory/current.md`
2. `tail -60 agent-memory/progress.md` and `cat agent-memory/decisions.md`
3. `git log --oneline -10`

## Non-negotiable rules (override any instinct to move faster)

1. **Evidence only.** "Done" requires the evidence block — command + literal
   exit code + commit hash. Ban "should work" / "I believe this is fixed."
2. **One verified increment = one commit**, gated by `scripts/verify.sh` exit 0.
   `git log` is the recoverable state machine.
3. **Phase discipline.** Build only what the current phase's contract requires
   (`docs/plans/`). No business-logic tools before their Phase 1 task contracts
   exist — resist adding `search_flights` early.
4. **Contracts before code** (Layer 1 of the upstream methodology).
5. **WebMCP tools are the product.** Register statically at page load, validate
   inputs inside `execute` (the browser does not validate against
   `inputSchema`), return JSON-serializable values, surface errors as
   returned text so the model can self-correct. See
   `docs/architecture/webmcp-integration.md`.

## Commands

- `scripts/verify.sh` — typecheck + lint + build + unit. This IS the
  Definition of Done; exit 0 gates every commit.
- `scripts/verify.sh --url <deployed-url>` — same, plus a deploy smoke test.
- `npm run dev` — local dev server (localhost is a secure context, so
  `document.modelContext` works there in WebMCP-enabled browsers).
- `npx vercel deploy --prod` — deploy (requires `vercel login`).

## Pointers

- `docs/plans/phase0-execution-plan.md` — current phase contract + research synthesis
- `docs/architecture/overview.md` — system shape
- `docs/architecture/webmcp-integration.md` — registration pattern, API constraints
- `docs/decisions/` — ADRs (stack choice, layout scoping, WebMCP pattern)
- `docs/domain/flight-dataset.md` — dataset schema + scenario anchor
- `agent-memory/` — current / progress / decisions / failures / lessons
- `evals/` — functional / regression / e2e / held_out (empty by design until Phase 1)
- Upstream methodology: `~/projects/ares/docs/agentic-coding-plan.md`
