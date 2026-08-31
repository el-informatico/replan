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
