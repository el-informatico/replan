# Phase 2 Closure Audit — raw evidence and design clarifications

- **Date:** 2026-08-31 · **Trigger:** reviewing session's audit request
  (Parts A1–A4 raw evidence, B1–B3 clarifications)
- **Outcome:** no re-implementation needed except **B2**, shipped as its
  own verify-gated increment `d0bac3c` (p2c12). Everything else is
  evidence quotation or documentation. Raw reviewer output preserved at
  `docs/reviews/phase2-independent-review.md`.

## A1 — Per-commit verify evidence (all eleven Phase-2 commits)

**What was captured at commit time (stated plainly):** every increment
was gated by running `scripts/verify.sh` (no arguments) before `git
commit`; in the implementing session the output was piped through
`grep`/`tail` filters, so the literal shell `$?` of verify.sh itself was
echoed to the transcript for only some commits. What IS contemporaneous
and durable for every commit: (a) verify.sh's own final line
`verify.sh: PASS (exit 0)` — which the script prints only when all legs
passed — visible in each pre-commit run, and (b) the per-commit
`Evidence:` line inside each commit message (part of pushed history,
written at commit time, quoting the test counts of that run). No separate
per-commit log file was kept. The worktree re-runs below are **re-runs
performed now at each commit's own tree** (labeled as such — they are
reproducibility evidence, not the historical capture).

**Re-run method:** `git worktree add --detach /tmp/replan-audit <sha>`
(one worktree, checked out per commit; `node_modules` symlinked —
`git diff --stat 66c2d4d^..5158a97 -- package.json package-lock.json` is
empty, so deps are identical across the range), then
`bash scripts/verify.sh` in the worktree; exit code taken literally.

| Commit | p2c | Contemporaneous `Evidence:` line (from the commit message) | Re-run now: exit | PASS legs |
|---|---|---|---|---|
| `66c2d4d` | c1 plan | `Evidence: scripts/verify.sh -> PASS (exit 0); 9 files / 76 tests green` | **0** | 4 |
| `0513f97` | c2 T5 | `Evidence: scripts/verify.sh -> PASS (exit 0); 11 files / 108 tests` | **0** | 4 |
| `cd6b364` | c3 T6 | `Evidence: scripts/verify.sh -> PASS (exit 0); 12 files / 121 tests` | **0** | 4 |
| `26bc978` | c4 T7 | `Evidence: scripts/verify.sh -> PASS (exit 0); 14 files / 136 tests` | **0** | 4 |
| `e849f81` | c5 T8 | `Evidence: scripts/verify.sh -> PASS (exit 0); 15 files / 147 tests` | **0** | 4 |
| `5716271` | c6 T9 | `Evidence: scripts/verify.sh -> PASS (exit 0); 17 files / 167 tests` | **0** | 4 |
| `7871c04` | c7 T10 | `Evidence: scripts/verify.sh -> PASS (exit 0); 18 files / 175 tests` | **0** | 4 |
| `d187136` | c8 UI | `Evidence: scripts/verify.sh -> PASS (exit 0); 19 files / 178 tests` | **0** | 4 |
| `73fa2d7` | c9 eval | `Evidence: scripts/verify.sh -> PASS (exit 0); 19 files / 178 tests` | **0** | 4 |
| `da0d390` | c10 review fixes | `Evidence: scripts/verify.sh -> PASS (exit 0); 19 files / 186 tests.` | **0** | 4 |
| `5158a97` | c11 closure | `Evidence: scripts/verify.sh -> PASS (exit 0); 19 files / 186 tests.` | **0** | 4 |

Consistency note: the closure report's p2c9 row also said 178 tests, and
the c9 commit message (`19 files / 178 tests`) matches its re-run — no
discrepancy exists in the record. During THIS audit, a `paste`-based
one-layer extraction initially displayed the Evidence lines shifted by
one row (the interleaved concurrent-session commit `dd4b923` has no
Evidence line and broke the pairing); per-commit `git log --format=%B -1
<sha> | grep '^Evidence: scripts'` runs, quoted above, are the
authoritative alignment and were re-checked individually for the
ambiguous rows (`dd4b923`, `0513f97`, `73fa2d7`, `da0d390`, `5158a97`).

Raw re-run output (literal):

```
66c2d4d  exit=0  |  4  |  verify.sh: PASS (exit 0)
0513f97  exit=0  |  4  |  verify.sh: PASS (exit 0)
cd6b364  exit=0  |  4  |  verify.sh: PASS (exit 0)
26bc978  exit=0  |  4  |  verify.sh: PASS (exit 0)
e849f81  exit=0  |  4  |  verify.sh: PASS (exit 0)
5716271  exit=0  |  4  |  verify.sh: PASS (exit 0)
7871c04  exit=0  |  4  |  verify.sh: PASS (exit 0)
d187136  exit=0  |  4  |  verify.sh: PASS (exit 0)
73fa2d7  exit=0  |  4  |  verify.sh: PASS (exit 0)
da0d390  exit=0  |  4  |  verify.sh: PASS (exit 0)
5158a97  exit=0  |  4  |  verify.sh: PASS (exit 0)
```

## A2 — Raw independent-review output + reviewer context

The reviewer's report is preserved **verbatim** in
`docs/reviews/phase2-independent-review.md`, including its findings 1–11
and verdict. What the reviewer was and was not given is stated in that
file's preamble; summarized here: it received the repo path, the diff
scope command (`git diff d9470e8..HEAD -- src/ evals/`), pointers to the
requirement documents (phase2 plan §3/§1/§7 + ADR-0005 + ADR-0004
addendum), the instruction to run `tsc -b` and `vitest run` itself, and
the seven-dimension findings format — and did NOT receive the
implementing session's transcript, `agent-memory/progress.md`, or any
implementer narrative. Caveat: it had working-tree read access (nothing
prevented it opening agent-memory); its prompt did not direct it there
and its report cites only the diff, plan, ADRs, and code. The subagent's
full JSONL transcript was not committed at review time and lived only at
an ephemeral harness path — a process gap; future reviews are committed
to `docs/reviews/` at review time.

## A3 — Bundle greps (literal commands and outputs)

The audit's commands, run verbatim (double-quote pattern):

```
$ curl -s https://replan-phi.vercel.app/assets/index-CbfTzfiT.js | grep -oc 'name:"search_hotels"'
0
$ ... | grep -oc 'name:"update_hotel_reservation"'
0
$ ... | grep -oc 'name:"book_ground_transport"'
0
$ ... | grep -oc 'name:"notify_contact"'
0
$ ... | grep -oc 'name:"calculate_total_cost"'
0
$ ... | grep -oc 'name:"generate_itinerary_summary"'
0
```

All six return **0** because the minifier emits backtick template
literals, not double-quoted strings (observed in Phase 2 closure:
`name:`search_hotels``). The corrected pattern:

```
$ curl -s https://replan-phi.vercel.app/assets/index-CbfTzfiT.js | grep -oc 'name:`search_hotels`'
1
$ ... | grep -oc 'name:`update_hotel_reservation`'
1
$ ... | grep -oc 'name:`book_ground_transport`'
1
$ ... | grep -oc 'name:`notify_contact`'
1
$ ... | grep -oc 'name:`calculate_total_cost`'
1
$ ... | grep -oc 'name:`generate_itinerary_summary`'
1
```

Each returns exactly 1. Full enumeration (the bundle is one line, so
`-oc` cannot distinguish one occurrence from several — this can):

```
$ curl -s .../index-CbfTzfiT.js | grep -o 'name:`[a-z_]*`' | sort | uniq -c
      1 name:``
      1 name:`book_ground_transport`
      1 name:`calculate_total_cost`
      1 name:`confirm_booking`
      1 name:`generate_itinerary_summary`
      1 name:`hold_reservation`
      1 name:`notify_contact`
      1 name:`ping`
      1 name:`search_flights`
      1 name:`search_hotels`
      1 name:`update_constraints`
      1 name:`update_hotel_reservation`
```

Eleven tool names, exactly once each (the empty `name:``` is a non-tool
object literal). Disclosure: the first attempt to loop these commands in
one line mangled the quoting (single quotes blocked `$tool` expansion) —
the runs above are the corrected, verbatim invocations.

## A4 — Phase 1 open items 3 and 5 (status, explicit)

- **Item 3 — README AI-use disclosure: UNTOUCHED during Phase 2.**
  `grep -inE "AI|Claude|Anthropic|LLM|generated|assisted|disclosure|built with" README.md`
  matches only product-description lines ("operated by an AI agent
  (ChatGPT's in-app browser)…", "No custom LLM, NLU, or voice layer…") —
  there is still **no AI-use disclosure statement**. Remains open and
  user-owned (non-blocking); now recorded in current.md with its Phase-1
  numbering.
- **Item 5 — demo-script turn-count vs observed confirmation gates:
  UNTOUCHED by design.** The script text is still deliberately unmodified
  pending the user's call (it changes the video shot list);
  `evals/functional/demo-script.test.ts` asserts tool outputs only, so
  nothing in code changed. Carried at current.md "Open items" with a
  pointer to the "Observed" section. Phase 2 ADDS to this item rather
  than resolving it: three more tools (update_hotel_reservation,
  book_ground_transport, notify_contact) are expected to hit the same
  gate — the Phase 3 demo script must budget three more "Yes" turns.

## B1 — Was seed+shift driven by the tool-count research finding? No.

The two claims are independent, and the repo record already says so —
but my closure *report* blurred them, so here is the explicit separation:

- **(a)** The research finding (11 tools nears practitioner-reported
  selection-degradation zones) is a UX/leverage concern. It informed
  **description length and overlap policy only**: all six Phase-2
  descriptions trimmed to ≤300 chars (plan §2 prescription (a), review
  finding 10), zero sibling overlap, and evaluating with all tools
  registered.
- **(b)** The hotel lifecycle decision (D008) was driven by **the
  dispatch's own constraint**, not by (a): the task fixed the tool list
  at six and pinned the DONE criterion at "all eleven tools total (5
  existing + 6 new)". A flight-style hold/confirm pair for hotels needs
  TWO additional tools (`hold_hotel_reservation` +
  `confirm_hotel_booking`) → 13 tools → violates the dispatch criterion.
  The ADR/plan text cites exactly this ("D008 — … the 11-tool ceiling
  forbids a hotel hold/confirm pair"), not the research finding.

Would (a) have forbidden 13 tools absent the dispatch ceiling? **No.**
No hard per-page limit exists in the spec or Chrome docs; the degradation
concern is soft and centered "past roughly a dozen"; two clearly-named,
distinctly-scoped booking tools in a two-domain demo would very likely
not break selection. So the causal claim "(a) forced (b)" would be
false, and I am not making it. Honesty also requires the other half:
within the forced constraint, seed+shift was *also* the simpler path —
but it was chosen over the two alternatives on fidelity grounds, not
speed: upsert semantics inside `update_hotel_reservation` was rejected
as name-dishonest for agent tool-selection, and "no hotel state" was
rejected because it gutted `calculate_total_cost`'s multi-domain point
(both rejections are recorded in the plan §1 D008).

## B2 — Double-booking transparency: FIXED (verify-gated, `d0bac3c`)

The audit is correct: `latestBooking` costing silently dropped evidence
of an accidental second booking — inconsistent with the read-time
honesty standard applied to stale legs. Fixed by amendment, not
exemption (plan §7 amendment 6): `buildCostBreakdown` now carries
`multiple_bookings_detected: true` + `superseded_flight_ids` whenever
more than one distinct flight is booked — a STATE fact, present
regardless of requested `items` — while the summed total is unchanged
(latest only, T9 AC1–4 intact). `calculate_total_cost` and
`generate_itinerary_summary` inherit the fields from the shared
breakdown (D010); the UI running-total card renders the warning.
Tests (in `d0bac3c`): two bookings → flag + superseded ids + total
unchanged (domain `src/domain/trip.test.ts` "flags superseded bookings
without changing the total (audit B2)"; tool `src/tools/cost.test.ts`
"flags multiple flight bookings without changing the total (audit B2)"
including the `items:['hotel']` state-fact case); single booking →
fields absent (fresh reset). Gate evidence: `scripts/verify.sh` → PASS
(exit 0), 19 files / 188 tests; pushed; trailer grep clean.

## B3 — The stale-leg end-to-end test: exists, single test, passes

File/test: `src/tools/summary.test.ts` →
`generate_itinerary_summary — partial states (never an error)` →
**"flags a stale transport leg when a later flight supersedes it
(reviewer finding 2)"** (`src/tools/summary.test.ts:100`). One test
covers the full sequence end-to-end — hold+confirm FL-016 (MIA, lands
2026-09-12T13:45-04:00) → `book_ground_transport` taxi 14:05 from MIA →
hold+confirm FL-021 (FLL, lands 2026-09-13T06:05-04:00) →
`generate_itinerary_summary` — with the catching assertions:

```ts
expect(r['status']).toBe('needs_attention')
expect(r['missing']).toEqual([])
const transport = r['transport'] as Record<string, unknown>
expect(transport['from_airport']).toBe('MIA')
expect(transport['stale_reason'] as string).toContain('FLL')
expect(transport['stale_reason'] as string).toContain('book_ground_transport')
expect((r['cost'] as Record<string, unknown>)['total_usd']).toBe(521.7)
```

(plus, since `d0bac3c`, `multiple_bookings_detected` — the same scenario
contains two bookings). Isolation run:
`npx vitest run src/tools/summary.test.ts -t "flags a stale transport leg"`
→ `Tests  1 passed | 9 skipped (10)`. No gap; no new test needed. The
companion half-cycle (hotel date set flight-less, then a flight
confirms) is separately covered by "flags a hotel check-in that predates
a later-confirmed arrival" and the idempotency-masking case in
`src/tools/hotel-reservation.test.ts`.

## Audit disposition summary

| Item | Disposition |
|---|---|
| A1 | Evidence quoted per-commit (contemporaneous commit-message lines + per-tree worktree re-runs, all exit 0); capture-gap disclosed |
| A2 | Raw reviewer report committed verbatim; context given/not-given stated; JSONL ephemerality disclosed |
| A3 | Literal outputs pasted; double-quote command returns 0 (minifier quoting) — corrected form returns exactly 1 per tool; enumeration confirms 11×1 |
| A4 | Item 3 untouched (no disclosure in README), item 5 untouched by design; both re-recorded with Phase-1 numbering in current.md |
| B1 | Written: (b) driven by the dispatch's 11-tool DONE criterion, NOT by (a); (a) shaped descriptions only |
| B2 | Code fix `d0bac3c` (verify-gated, plan amendment 6, +2 tests) |
| B3 | Existing single end-to-end test quoted and re-run in isolation; no gap |
