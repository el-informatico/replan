# Demo usage guide — recording variants vs the verification run

For a human preparing to record the submission video or to run the
outstanding verification. Reference-style; each section stands alone.
Everything here orbits ONE verified 36-turn narrative — the variants
change only delivery (narration condensation, pasting, editing), never
tool calls, arguments, pinned outputs, turn order, or pacing.

## 1. The three variants and what each is for

| | LONG — live/unscripted | MEDIUM — paste | SHORT — jump-cut |
|---|---|---|---|
| File | `twelve-tool-demo-script.md` | `twelve-tool-demo-script-medium.md` | `twelve-tool-demo-script-short.md` |
| Human delivery | types or speaks extemporaneously | pastes pre-written prompts | pastes pre-written prompts |
| Agent narration | as written (canonical) | the long script's three named trims applied | tightest natural form (17 further cuts) |
| Gates (5) | live, natural pause | live, answered immediately | answered live, "Yes." turns removed in post |
| Editing | none (rehearsal/live record) | none — single clean take | five gate cuts + inter-turn pass |
| Dialogue words (corrected method) | 431 | 408 | 326 filmed / ≈321 as-cut |
| Real duration estimate | ≈2:52–3:36 + beats — over the 2:45 comfort target in every scenario, over 3:00 at deliberate pace | single take ≈2:21–3:30 — under 3:00 only when brisk (best ≈39 s margin, worst ≈30 s over) | final edit ≈1:36–2:04 — under 3:00 by ≈56–84 s, under 2:30 by ≈26–54 s (full cut plan required) |
| Use for | **the verification run** + rehearsal baseline | first choice for a single-take video IF a timed rehearsal lands under ≈2:50 | the safety-margin submission take |

**LONG (live/unscripted).** The canonical script, machine-pinned against
the real tool modules by `evals/functional/demo-script.test.ts`. You
type or speak the traveler's lines as they come; the run is the closest
thing to how a judge improvising from the page would actually discover
and drive twelve WebMCP tools in natural language. It is also the one
most likely to run past 3:00 — which is fine, because this variant's
job is fidelity (verification and rehearsal), not the video clock.
(Turn 15 was live-corrected — see the script's deltas note — after
real-world testing showed the original phrasing never triggered the
semantic tool.)

**MEDIUM (paste).** Identical narrative with the long script's three
named narration trims applied, every prompt pasted from the document,
and the five confirmation gates answered the instant they appear. One
clean unedited take. It fits 3:00 only at a brisk pace — rehearse once
against a timer; if the rehearsal exceeds ≈2:50, take that as the
signal to move to SHORT rather than to rush.

**SHORT (jump-cut).** The same recording discipline as MEDIUM plus the
tightest narration that still reads as natural speech, and a post-edit
cut plan that removes the five gate "Yes." turns and the paste/dead-air
between turns. This is the variant with real margin — but the margin
exists only if the FULL cut plan is applied (gate cuts alone leave the
video at ≈1:40–2:40: under 3:00, yet still ~10 s over the 2:30 comfort
target at worst — the inter-turn pass is where the margin comes from).

## 2. Running any variant against ChatGPT Desktop

1. Open **https://replan-phi.vercel.app** in ChatGPT Desktop's in-app
   browser (Work/Codex plan; model **GPT-5.6 Sol or Terra** — Luna has
   WebMCP disabled; Settings → Browser → Permissions → Enable site
   tools). Path B: Chrome 149+ with `chrome://flags/#enable-webmcp-testing`.
2. Before turn 1: the **"Agent tools" card must list TWELVE tools, every
   row "registered"** — any "unavailable" row means stop (that check and
   its failure meanings: worksheet P0).
3. Start from a fresh page load; do not reload mid-run — state is
   in-page (worksheet P2).
4. Before ANY take that includes turn 16, run the semantic floor
   re-check (worksheet P3): one paced probe of the dawn query, expect
   ≈FL-021 ≈0.69, then wait ≥60 s before turn 1.
5. Deliver the human turns per your variant: type/speak (LONG), paste
   (MEDIUM/SHORT). Never paraphrase — the pinned outputs assume the
   exact wording.

**Turn-0 orientation message — a clear recommendation, not a shrug:**
USE it for the **verification run** (paste the worksheet's Turn-0
message first; it makes ChatGPT surface exact tool names, arguments,
and raw JSON, which is precisely what the worksheet wants you to
transcribe). SKIP it for the **final recording take** — it is an
off-script meta-turn that costs seconds and reads as staged; the in-app
browser's own tool-use UI already shows each call and result on camera.

## 3. Jump-cuts in the SHORT variant

**Marking cuts while filming (solo, no equipment): say the word "cut"
out loud, quietly, immediately after you answer each gate — and, if you
want per-prompt markers too, just BEFORE pasting each prompt (a marker
spoken after the paste lands inside the footage the inter-turn pass
keeps, and would survive into the final audio).** A screen recording
has no camera for a visual clap-marker and a solo operator has no free
hands; a spoken word lands as a tall, findable spike on the audio
waveform in every editor (Premiere, Resolve, CapCut, Audacity — all of
them). If you cannot record audio, keep a timestamps log (turn number
+ mm:ss) as you go — slower, same result.

**Where the cuts go** (full anchors live in the short doc, one
[JUMP-CUT n of 5] block per gate):

- Gate cuts (5): cut IN on the frame the gate question finishes
  rendering; cut OUT on the frame the tool's result starts appearing.
  Removed: the "Yes." send and the pause around it. Kept: the gate
  question itself — the video stays honest that ChatGPT ran its
  per-invocation safety review.
- Inter-turn pass: cut IN on the frame each pasted prompt lands in the
  chat; cut OUT as the reply starts. Removes paste actions and dead
  air. This pass is REQUIRED for the 1:36–2:04 estimate — with only the
  five gate cuts you are back at ≈1:40–2:40, whose worst case still
  exceeds the 2:30 comfort target.
- Optional editor's call: keep gate 1 (turns 6–7) uncut to SHOW one
  full safety-review cycle (~2 s cost); cut the other four. Nice for
  judges; not required.

## 4. Demo script vs worksheet — different instruments

- A **demo script** (any variant) is what you PERFORM. It exists to be
  recorded as the submission video.
- The **worksheet** (`docs/verification/phase5-human-run-worksheet.md`)
  is the verification instrument: per-turn expected pinned JSON,
  observed-output blanks, gate tally, pacing tally, outcome record.
  Proving the site still behaves correctly is the worksheet's job —
  assisted by the machine tests below — never the video's.
- **For the still-outstanding human verification run: use the LONG
  variant.** It is the most faithful to genuine natural-language WebMCP
  discovery (real typing, real reactions, no delivery tricks), and the
  worksheet's per-turn expectations are keyed to its 36 turns. Record
  results in the worksheet and hand it back per its "After the run"
  section.
- **For actual video takes: MEDIUM first, SHORT as the safety margin —
  but only after verification has passed.** A polished video of a site
  that no longer matches its pins is worthless; verification precedes
  recording.
- The eleven-tool script and Phase 3 worksheet are the historical
  record of the 11-tool run — superseded for current purposes, kept
  unchanged.

## 5. Pre-flight checklist (cross-references — the worksheet is the detail)

- [ ] Twelve tools "registered" on https://replan-phi.vercel.app →
      worksheet **P0** (what "unavailable" means is documented there)
- [ ] Browser + model requirements met (Sol/Terra, site tools, or
      Chrome 149+ flag) → worksheet **P1**
- [ ] Fresh page state, no mid-run reload → worksheet **P2**
- [ ] Semantic floor re-check run and ≥60 s cooldown → worksheet **P3**
- [ ] Machine pins green: `scripts/verify.sh` exit 0 (runs
      `evals/functional/demo-script.test.ts` — long-script values
      against the real modules)
- [ ] Variant drift check: `npx vitest run
      evals/functional/demo-script-variants.test.ts --reporter=verbose`
      (asserts the three documents agree on every tool call, argument,
      pinned JSON fragment, unquoted turn prose, human line, gate
      position, and the semantic buffer, and that spoken money/score/
      flight-id values never mutate; add `--reporter=verbose` to also
      print the agreement table as evidence — plain runs suppress
      console output)
- [ ] Your variant's duration section read — including its margin
      statement and its honest caveats
