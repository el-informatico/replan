# Phase 2 Independent Review — raw reviewer output (verbatim)

- **Date:** 2026-08-31 (review ran pre-deploy, fixes shipped in `da0d390`)
- **Provenance:** reproduced verbatim from the reviewer subagent's final
  report as delivered to the implementing session. The subagent's full
  JSONL transcript was not committed at review time; it lived at the
  harness's ephemeral task-output path (`/tmp/claude-1000/-home-juanz-
  projects-replan/<session>/tasks/<agent-id>.output`) and is not durable.
  This file — the report itself — is the surviving raw artifact. (Process
  note: future reviews get committed here at review time, not after.)

## What the reviewer WAS given (its entire invocation prompt)

- The repo path and project framing (one paragraph: WebMCP hackathon,
  simulated travel-recovery site, tools via document.modelContext).
- The instruction that it had no part in writing Phase 2 and must not
  modify files — read and report only.
- Scope: `git diff d9470e8..HEAD -- src/ evals/`, with the note that
  `8e81643` touched only agent-memory (ignore), and the p2c1–p2c9 commit
  list.
- Pointers to the requirement side: `docs/plans/phase2-execution-plan.md`
  (§3 contracts T5–T10, §1 decisions D007–D010, §7 amendments 1–2) and the
  two ADRs (0005 full, 0004 Phase-2 addendum).
- Instruction to run `npx vitest run` and `npx tsc -b` itself.
- Seven review dimensions (contract compliance AC-by-AC, validation gaps,
  state-machine holes, budget/authoring, data integrity, UI/registration,
  eval coverage), the numbered-findings format (severity, file:line,
  repro, violated contract line), the requirement to verify findings
  before reporting, and the verdict question.

## What the reviewer was NOT given

- The implementing session's transcript or reasoning trail.
- `agent-memory/progress.md` (the implementer's own evidence narrative)
  or `current.md`.
- Any statement of what the implementer believed was finished or why
  design choices were made beyond what the plan/ADR documents themselves
  say.

Caveat stated plainly: the reviewer subagent had read access to the whole
working tree (it was told to read the repo), so it *could* have opened
agent-memory or this file's later amendments — its prompt did not direct
it there, and its report cites only the diff, the plan, the ADRs, and the
code. Independence here rests on diff+contract isolation and a separate
context, per the upstream methodology's reviewer-independence rule.

---

# Phase 2 Independent Review — Replan

Baseline confirmed myself: `npx tsc -b` exit 0; `npx vitest run` — 19 files / 178 tests, all green. Diff scope `d9470e8..HEAD -- src/ evals/` reviewed in full (store/payload diffs are purely additive — the frozen-infra constraint holds; no Phase-1 tool file touched). Time-dependent claims were verified by executing the real tool modules under Node's type-stripping with a JSON-import shim (no files created), plus hand-computed fare/budget arithmetic.

## Dimension 1 — Contract compliance (T5–T10, AC by AC)

Nearly clean. Every AC of T5, T6, T7, T9 has both implementation and a cited test, including exact boundaries (pickup window at 14:00/21:45 accepted, 13:59/21:46 rejected; budget boundary at equality vs 1 cent over; whole-night 25 h rejection; Feb-30 calendar rejection). Amendment 1 (annotations) and Amendment 2 (T9 empty-state) are followed exactly. Gaps found are listed as findings 3, 4, 11 below.

## Dimension 2 — Validation gaps

Clean apart from finding 8. No numeric tool inputs exist in Phase 2 (so no L003 numeric-bound exposure); `getIsoDatetime` with impossible-calendar rejection is used on every timestamp (`search_hotels`, `update_hotel_reservation`, `book_ground_transport`, `notify_contact`); null-vs-absent semantics are deliberate and tested (`items: null` → default; `contact.phone: null` → absent); arrays as inputs/contacts rejected; `items` enum/duplicate handling exact.

## Dimension 3 — State-machine holes

One major (finding 2), verified live. `resetForTests` covers every new field incl. clock reset (`/home/juanz/projects/replan/src/state/store.ts:299-313`). `calculate_total_cost` is total across all state combinations (empty snapshot tested at the domain layer; latest-of-two-bookings tested; NOT_BOOKED pointers correct). Hotel update idempotency is correct for same-instant-different-offset spellings and does not notify on no-ops.

## Dimension 4 — Budget/authoring

One major (finding 1) plus minors 7, 9, 10. Names/charset/uniqueness/param-description budgets are mechanically enforced for all 11 tools and pass. Description lengths: all six Phase-2 tools 303–359 chars (see finding 10).

## Dimension 5 — Data integrity

Data satisfies every claim I could check: 18 hotels, 12 Miami (9 MIA / 3 FLL) + 6 FLL, zones 6/6/6, $79–$349, 3 sold out 09-12 + 3 on 09-13, port-distance invariant, all tag equivalences, seed-safety window 09-11…16; fare math verified by hand: FLL→downtown 25.64 / 65.90 / 95.90 and MIA→downtown 12.62 / 20.95 / 27.70, ordering invariant holds. Gaps: findings 5, 6.

## Dimension 6 — UI/registration

Clean. All 11 tools registered (`/home/juanz/projects/replan/src/App.tsx:38-50`); every new store field rendered (hotel results card, reservation card, transport card, notifications card, running-total card via the shared `buildCostBreakdown`); phase note counts correctly (4 flight tools + 6 named + ping = 11). `ItineraryCard` uses last-array-element booking, but insertion order always equals confirm order (re-confirm returns early without re-adding, `confirm.ts:88-92`), so it can never disagree with `latestBooking`.

## Dimension 7 — Eval coverage

Clean. `evals/functional/multi-domain-narrative.test.ts` chains the dispatched sequence (flight precondition → search_hotels with window+near_airport → hotel shift with a too-early correction → transport taxi→shuttle replace flow → notify → cost over-budget → `update_constraints` raise → re-read within-budget → complete receipt) plus two error-recovery tests. Pins are tight (664.62, −35.38, refs, end-state store shape); only trivial looseness (`count > 0` on the retry leg).

## Findings

**1. MAJOR — `search_hotels` output exceeds the 1.5K budget on an ordinary post-crunch window; the budgets test asserts a non-widest case and mislabels it "the widest case".**
`/home/juanz/projects/replan/src/tools/hotels.ts:138-155`, `/home/juanz/projects/replan/src/tools/budgets.test.ts:88-102`.
Repro (real tool, executed): `search_hotels({city:"Miami", check_in:"2026-09-14T15:00:00-04:00", check_out:"2026-09-16T15:00:00-04:00"})` → `count:11, showing:8`, note present, every row carrying `nights`+`total_stay_usd` → **1555 chars** (1-night 09-14→09-15 → 1553). The asserted case (09-12→09-14, 1131 chars) is narrower because the crunch sold-outs cut the result set to 6 — that is exactly why it is not the widest.
Violates: plan §2 ("budgets confirmed verbatim … budgets.test.ts keeps enforcing them mechanically regardless"), §0 conflict resolution, and T5 VERIFICATION ("output <= 1.5K assertion"). Fix direction: trim the row projection (e.g. drop `rooms_left`/`star` or cap at 6-7 rows when a window is present) and repoint the budgets test at a case with 8 windowed rows.

**2. MAJOR — Cross-tool validation is write-time-only; later flight re-confirmation leaves stale state that `generate_itinerary_summary` reports as coherent — the Phase-1 "stray hold" class.**
`/home/juanz/projects/replan/src/tools/hotel-reservation.ts:119-137`, `/home/juanz/projects/replan/src/tools/transport.ts:104-135`, `/home/juanz/projects/replan/src/domain/trip.ts:152-219`.
Repro A (verified live): `update_hotel_reservation({reservation_id:"HTL-R001", new_check_in:"2026-09-11T15:00:00-04:00"})` with no flight (allowed, T6 AC5) → confirm FL-016 (arrives 09-12 13:45) → `generate_itinerary_summary()` returns `ok:true` with hotel check-in 09-11 strictly before the arrival. Re-sending the *same* before-arrival date returns `idempotent:true` — the idempotency check (line 121) short-circuits before the CHECK_IN_BEFORE_ARRIVAL check, so the agent gets no signal on the no-op (a *different* early date does error correctly).
Repro B (verified live): confirm FL-016 → `book_ground_transport({type:"taxi", pickup_time:"2026-09-12T14:05:00-04:00"})` → confirm FL-021 (FLL, lands 09-13 06:05) → summary returns `status:"complete"` with a ground leg from **MIA** picking up **09-12 14:05**, the day before the new flight lands; `calculate_total_cost` charges the stale $27.70 MIA leg against the FLL itinerary (total 521.70).
No AC literally requires re-validation (T6 AC5 / T7 AC4 are call-time checks), but this is precisely the cross-tool cycle class the plan's review history targets (§0 item 4, L004; Phase-1 finding 1) and T10 AC3's "complete" attestation becomes false in the large. Either re-derive/flag on read (e.g. summary marks a stale leg) or document the simplification in ADR-0004's addendum with a regression test pinning the chosen behavior.

**3. Minor — T10 AC3 half-implemented: the missing list does not "name … the tool that books it".**
`/home/juanz/projects/replan/src/domain/trip.ts:153-154`, `summary.ts:50-55`: `missing` is bare kind strings; no tool pointers anywhere in the receipt (T9's NOT_BOOKED has them, `cost.ts:88-101`). The agent must infer which tool books each missing piece.

**4. Minor — T10 VERIFICATION's named "empty state (status partial, missing all three, ok:true, total 0)" has no test.**
D008's seed makes it unreachable at the tool layer; Amendment 2 covers T9's analogous line but not T10's. A direct `composeItinerary(emptySnapshot)` test (mirroring `trip.test.ts`'s structural-empty pattern) is absent; behavior is correct by construction.

**5. Minor — ADR-0005's seeded-reservation timestamps contradict the data (and are internally impossible).**
`/home/juanz/projects/replan/docs/decisions/0005-synthetic-ancillary-datasets.md:54-56` states check-in `2026-09-12T16:00:00-04:00` / check-out `2026-09-14T11:00:00-04:00` "(2 nights)" — a 43 h span the validator would reject. The data (`src/data/hotels.json:9-10`) and `docs/domain/hotel-dataset.md:20-21` carry 15:00/15:00. The ADR text should be corrected.

**6. Minor — dataset distribution claims are not test-pinned.**
ADR-0005 "12 Miami (9 near MIA, 3 near FLL) + 6 Fort Lauderdale" and hotel-dataset.md "Zones split 6/6/6" are enforced by nothing (validator bounds are 15–25 hotels with any city mix; only the 18-total, seed-safety, and both-sides-of-cut assertions exist). A dataset edit could silently falsify both docs. (The *discriminating-power* claims, by contrast, all have tests — verified.)

**7. Minor — remaining budget-enforcement gaps beyond finding 1.**
Asserted: search_hotels (wrong case), notify_contact (widest — all recipient fields), generate_itinerary_summary fresh (budgets) + complete chain (summary.test.ts:147-150, 1225 chars). Unasserted anywhere: `calculate_total_cost`'s widest output (full chain, 494 chars — budgets.test.ts:119 covers fresh state only) and the fixed-shape outputs of `update_hotel_reservation` / `book_ground_transport` (~363/379 chars; their contracts only required the TOOLS entry, so this is compliant-but-incomplete vs plan §4's "every Phase-2 tool output joins the ≤1.5K assertion").

**8. Minor — unbounded caller-controlled strings can breach output budgets.**
`/home/juanz/projects/replan/src/tools/notify.ts:83-104` imposes no length cap on `name`/`phone`/`email`/`relationship`; the values are echoed into `recipient.target` (notify's own output) and `notifications.last.target` (summary output), so a ~1.2K-char string pushes both past 1500. L003's exact-bounds discipline would suggest a modest cap.

**9. Minor — budgets.test.ts is order-dependent and its "(fresh state)" labels are wrong.**
No `resetForTests` in the file; by the time the cost/summary assertions run, the notify test has appended a notification. Accidentally conservative for summary today (wider than fresh), but a reorder would silently narrow coverage.

**10. Minor — plan §2 prescription (a) "aim 150–300 chars per tool description" is missed by all six Phase-2 tools** (measured 303–359; hard ≤500 respected). Process note only.

**11. Minor — two AC/verification lines without any test:** T8 AC5 (arrival deliberately *not* cross-validated against flight state — implemented, untested; a contradicting-arrival-accepted test would pin the documented choice) and summary with multiple notifications (`count > 1` + `last` path never exercised).

## Verdict

**2 majors, 9 minors.** The codebase is disciplined and the contracts are overwhelmingly honored — validation, state handling, data integrity, UI wiring, and the functional eval are all in good shape, and both amendments were applied faithfully. But the two majors are real: an ordinary post-crunch hotel search ships a 1555-char payload through a budget the project claims to enforce mechanically, and the cross-domain receipt can attest a "complete" trip whose ground leg belongs to a superseded flight. **Phase 2 should not proceed to p2c11 deploy until p2c10 fixes findings 1 and 2** (with regression tests repointed at the true widest case and a pinned stale-state behavior), ideally also the one-line ADR-0005 timestamp correction (finding 5).
