# Current work

**PHASE 0 (Foundation) COMPLETE AND CLOSED OUT — 2026-08-31.** All six
acceptance criteria verified with evidence (see `progress.md`). Remaining
open item: ONE — the human-run in-app-browser smoke test (procedure below).

## Delivered (close-out state)

- Repo: **https://github.com/el-informatico/replan** (public, main,
  MIT — GitHub's own license API reports `spdx_id: MIT`; About homepage set
  to the live URL). Pushed history verified free of AI-attribution markers.
- Live site: **https://replan-phi.vercel.app** — Vercel production, public
  (HTTP 200 anonymous, direct, no redirect). `scripts/verify.sh --url
  https://replan-phi.vercel.app` → exit 0.
- Code: registrar (`src/tools/webmcp.ts`) + `ping` tool + live tool-call UI;
  26-flight dataset with enforced invariants; ADR-0001..0003.
- Commits: `e1ce1a8` → `ad0a9a9` → `5229807` → `8cdccd0` → `7bd6999`
  (all pushed; remote matches local).

## Deployment protection — status confirmed (no action required)

Project `replan` has Vercel Standard protection:
`ssoProtection: {deploymentType: "all_except_custom_domains"}` (API evidence,
2026-08-31). Effect in practice (curl, anonymous):

| URL | Result |
|---|---|
| https://replan-phi.vercel.app (published everywhere) | **200 direct — public** |
| https://replan-el-informatico.vercel.app | 302 → vercel.com SSO |
| https://replan-<hash>-el-informatico.vercel.app (per-deployment) | 302 → vercel.com SSO |

Judges only ever receive `replan-phi.vercel.app`, which is exempt and open.
If the human nevertheless wants to review/disable: Vercel dashboard →
team "el-informatico's projects" → project `replan` → **Settings → Domains →
Deployment Protection** (account-wide: team Settings → Deployment
Protection). Note Standard protection on deployment URLs is platform default
behavior; only custom domains are exempt by design.

## Phase 0 — open verification (the ONE remaining item)

Human-run smoke test of WebMCP tool discovery. No assistant session can run
this (headless WSL2, no WebMCP-capable browser). Run ONE of the paths below,
then record the outcome under "Outcome" at the bottom and tick the box.

### Path A — ChatGPT in-app browser (the actual judging environment)

Requirements: ChatGPT desktop app with in-app browser; ChatGPT Work/Codex
plan; model GPT-5.6 **Sol or Terra** (Luna has WebMCP disabled —
https://learn.chatgpt.com/docs/webmcp).

1. Open ChatGPT desktop app → open the in-app browser.
2. Navigate to: `https://replan-phi.vercel.app`
3. Verify the page shows: heading "Replan", an **Agent tools** card listing
   `ping` with status **`registered`** (if it says `unavailable`, stop and
   record the detail text verbatim — that means registration failed).
4. In the chat, send exactly:
   `What tools does this page provide? List them, then call ping with no arguments.`
5. Expected agent behavior: it reports a tool named `ping` (description:
   connectivity smoke test) and calls it.
6. Expected tool result (JSON): `{"ok": true, "pong": true, "echo": null,
   "received_at_utc": "<ISO timestamp>"}`.
7. Expected page behavior: the **Tool-call log** card renders a new `ping`
   entry live at the moment of invocation.
8. Optional second call: `Call ping with echo set to "hello from the agent"`
   → expect `{"ok": true, "pong": true, "echo": "hello from the agent", …}`.

### Path B — Chrome (flag), no ChatGPT plan needed

1. Chrome 149+: enable `chrome://flags/#enable-webmcp-testing`, restart.
2. Open `https://replan-phi.vercel.app` — the Agent tools card must show
   `ping` as `registered`.
3. Either use the browser's agent side panel, or install the "Model Context
   Tool Inspector" extension
   (github.com/beaufortfrancois/model-context-tool-inspector), list the page's
   tools, and execute `ping` with input `{}`.
4. Expected: identical result shape as Path A step 6.

### Outcome (fill in after running)

- [ ] Path used: A / B — Date: ______
- [ ] `ping` listed by the agent/inspector: yes / no
- [ ] Result matched `{ok:true, pong:true, echo:…}`: yes / no (paste actual JSON)
- [ ] Tool-call log updated live on page: yes / no
- Notes: ______

If ANY step fails, do not debug blind — capture the exact result text, then
check DevTools console for `[webmcp]` errors (the registrar logs registerTool
failures) and record everything here for Phase 1 triage.

## Also pending on the human (non-blocking)

- Add the AI-use disclosure to the GitHub README (per user's own plan, 2026-08-31).

## What Phase 1 (flight-tool task contracts) should assume

1. The registrar in `src/tools/webmcp.ts` is THE path for new tools: declare a
   `WebMcpTool` object, add a `registerX()`, call it in `App.tsx`'s effect.
   Abort-before-reregister, feature-detection, and status typing already work.
2. Errors-as-data is the contract: every tool returns `{ ok: true, … }` or
   `{ ok: false, error }` — never rejects deliberately (ADR-0003).
3. Dataset loading: `loadDataset()` from `src/domain/flights.ts`; filter
   fields are `destination.code`, `arrive_iso` (explicit offsets — compare
   parsed instants, never strings), `price_usd`, `total_layover_minutes`.
   Scenario defaults (deadline/airports/price/layover) live in
   `scenario.constraints_hint`.
4. Any dataset edit must keep `validateDataset()` at zero violations;
   `verify.sh` gates this.
5. Deploy = `vercel deploy --prod --yes --token "$(cat ~/.vercel-token)"`;
   verify with `scripts/verify.sh --url https://replan-phi.vercel.app`.
   Push = `git push` (origin = git@github.com:el-informatico/replan.git, SSH
   auth confirmed working). Note: future deployment-hash URLs will SSO-redirect
   (Standard protection) — always smoke the `replan-phi` alias.
6. `verify.sh` legs: deps → typecheck → lint → build → unit → optional
   `--url` smoke. Commit only on exit 0; push after verify.
7. Commit messages in this repo carry NO AI co-author trailers (user rule,
   2026-08-31; disclosure lives in the GitHub README).

## Session environment notes (carry forward)

- Loopback TCP is blocked for this assistant's shell calls (servers visible
  in `ss` but unreachable; external HTTPS fine) — local `vite preview` smoke
  tests are impossible; use the deployed URL.
- Never `pkill -f` with a pattern that appears in the invoking command line —
  it matches (and kills) the invoking shell itself. Use `fuser -k PORT/tcp`.
- `vercel login` inside WSL cannot complete the OAuth callback on this
  machine (mirrored networking + Hyper-V firewall blocks the loopback). Token
  auth via `~/.vercel-token` (0600) is the working path. Vercel CLI ≥47.2.2
  required (59.10.0 installed globally).
- GitHub: `gh` authenticated as el-informatico (ssh protocol); SSH key tested
  ("Hi el-informatico!").
