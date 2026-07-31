# Handoff

State of the game at release. The previous version of this file described a
build that was content-complete and visually unfinished; that is no longer the
shape of the work, so it has been rewritten rather than appended to.

---

## 1. Where things stand

| Area | State | How it was verified |
| --- | --- | --- |
| Story | 5 acts, 10 cast, 60 clues, full solution chain | `docs/design/story-bible.json` |
| Content | 34 scenes, 85 items, 46 dialogue trees, 14 cinematics | `npm run check:content` exits 0 |
| Puzzles | 16 defined, implemented and registered | `src/puzzles/index.ts` |
| Art | 34 scenes at 2560×1600, 10 portraits, 85 items, 12 UI | `public/art/` |
| Voice | 98 lines, 12-strong British cast, 19.5 min | `public/audio/vo/`, `src/game/vo-index.json` |
| Audio | procedural, calibrated | `npm run check:audio` |
| Progression | provably completable | `docs/critical-path.md` — 73 steps |
| Harness | 11/11 shots, 0 console errors | `node tools/shoot.mjs` |
| Visual | scored 8.3–8.7 against the Nancy Drew bar | four independent critics, measured |

Deployment is `netlify.toml` — build `npm run build`, publish `dist`, Node 22 to
match CI. Cache headers are pinned per directory because 43MB of the site is art
and voice served by stable path rather than by content hash.

---

## 2. What the visual pass actually found

Four rounds, each one an independent critic measuring pixels on captured PNGs
and a bounded fixer working only from what was measured. Scores went from
**3.0–5.6** at baseline to **8.3–8.7**, and three of four critics say the game
wins a blind side-by-side against *Sea of Darkness* with the logos removed.

The findings worth keeping, because they are all the same shape — a defect that
source review cannot see and only a measurement on a rendered frame will catch:

**Nothing was lit.** Every "specular" was an element-local CSS gradient. Provable
from a capture: three dials 460px apart put their brightest pixel at the same
2px offset from their own centres. A real key light moves that highlight
laterally across the span.

**`font-variant-caps: all-small-caps` on Cormorant.** Its small capitals are cut
to a 0.36em x-height against 0.66em for capitals, so every label carrying it
rendered at half its declared size. This is why the puzzle screens had 6px
control labels while the stylesheet looked reasonable.

**`transform: scale(0.86)` on a legend.** Shrinks painted glyphs without changing
any computed style. No CSS audit finds this; only measuring the ink does.

**`withoutEnlargement: true` in the art pipeline.** The output spec asked for
1920px wide and silently got 1536, so every painted background was upscaled by
the browser at display time.

**Contrast failures on real numbers, not taste.** A nameplate caption at 1.11:1.
Twelve elements below 3:1 on the deduction board — every label of the game's
core mechanic. Five sensory control labels at 1.07:1 that had survived every
previous review including one that scored the area 7.4.

---

## 3. Read this before running another critic loop

**A bounded fix round must not deepen, extend or strengthen an existing effect.**
This is the single most important thing on this page. Twice, a round improved
one thing by pushing a value further in the direction a previous round had
already pushed it:

- The journal's page dissolve deepened every round. The last readable line of a
  bottom card walked y1039 → y964 → y920 while the leaf foot never moved, so
  each round of "fixes" deleted two to four more lines of readable copy.
- Round one's new key light was strengthened until it clipped its own box and
  left a razor 1px seam down the full 1200px height of the frame.

Both times the agent believed it was improving things, and both times only a
critic diffing against the *earlier* captures caught it. Ask every reviewer
explicitly whether anything got worse; do not only ask what is still imperfect.

**Pin every review to a named capture directory.** One round scored `r2` while
believing it was scoring `final`, and sent an area back to re-fix two criticals
that had already been fixed two rounds earlier — the H1 contrast it reported as
1.98:1 was 12.16:1 in the build it was supposed to be reviewing.

**A critic that refuses a defect is working correctly.** One fixer was asked to
correct a slider that "misreports its value", measured the thumb at 20.39
against a readout of 20, found the critique's track span had overshot the
channel's cap by 56px, and changed nothing. That is the right outcome.

**Give each agent a disjoint file list.** Four agents editing CSS in parallel is
fine; two editing the same stylesheet is not. Only the capture agent builds —
concurrent `vite build` runs corrupt the shared `dist/`.

**`tools/safe-commit.sh` exists** for committing while agents are mid-write. In
practice, staging explicit paths for your own work and letting agents finish
before staging theirs is simpler and was what shipped this.

---

## 4. Things that will bite you

**Shared-library ElevenLabs voices must be added to the account library** before
they can be synthesised by id. Until they are, requests 404 in a way that reads
as a tier or permissions problem and is not. This silently cost the cast its two
most important voices — the protagonist and the narrator — while the other ten
rendered fine. `tools/generate-voice.mjs` now preflights the whole cast before
spending a character, and `src/game/cinematic-voice.test.ts` holds the id
contract between the manifest and the player, because when those disagree the
game does not fail, it just goes quiet.

**Blocking surfaces hang automation.** `narration.say/think` and
`dialogue.converse` only resolve on player input. The harness uses
`__test.setAutoAdvance(ms)` and never awaits a conversation. A new blocking
surface needs the same escape.

**`forceClose()` resumes the boot flow**, which lets `newGame()` start the
opening cinematic over whatever you navigated to.
`__test.startNewGameSkippingIntro` sets `skipCinematics` first.

**Agents leave scratch at the repo root.** `.gitignore` covers `/_*.mjs`,
`/*probe*.mjs`, `/shoot*.mjs`, `/.tmp*/`. Widen it rather than committing them.

**API keys are the user's** and are not in the repo. `OPENAI_API_KEY` for
`npm run art`, `ELEVENLABS_API_KEY` for `npm run voice`. Both pipelines are
resumable and hash-aware, but the hash cache lives in `tools/.artcache`, which is
gitignored — a fresh clone re-renders everything on the first run.

---

## 5. Known limits

**Scene art is a finishing re-export, not native resolution.** The masters are
1536×1024 because that is the largest landscape the image API returns.
`tools/finish-scenes.mjs` exports them at 2560×1600 on exactly the centre crop
that `background-size: cover` was already showing, so composition and hotspot
coordinates are unchanged and the browser downsamples instead of upsampling.
Every room measures sharper at display size (×1.26 to ×2.00 by Laplacian
variance) and the tool refuses to run if any comes out softer. When the API can
render 16:10 at size, delete the tool and widen the `scenes` spec in
`generate-art.mjs`.

**Two cutscene beats are deliberately unvoiced.** One is two women arguing
through forty feet of ventilation trunk; the other is a question and Wren's
answer inside a single beat. A beat gets one audio file, so a lone reader would
flatten both into a monologue.

**~90 flags are set but never read.** Mostly deliberate dialogue-state
bookkeeping for the deduction board. Harmless.

**`combinesWith` is descriptive, not executable.** `items.ts` declares seven
chains and `content.ts` validates them, but no engine code consumes the field —
the chains are implemented as hotspot interactions instead, which is the correct
adventure-game design. Every item they produce is reachable; verified.

---

## 6. Commands

```bash
npm run dev            # http://localhost:5173
npm run build          # typecheck + bundle
npm test               # 21 tests
npm run check:content  # graph integrity, act-aware reachability
npm run check:audio    # needs the dev server running
node tools/shoot.mjs --out shots/x     # 11 screenshots
node tools/finish-scenes.mjs           # re-export painted plates
npm run voice:manifest && npm run voice # re-render the voice cast
```
