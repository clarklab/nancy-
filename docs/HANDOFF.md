# Handoff

Written at the end of the first build session. The game is **playable and
content-complete**; what remains is visual polish, and one specific piece of
tooling keeps failing in a way you need to know about before you repeat it.

Branch: `claude/nancy-drew-puzzle-game-uzkhnp` · PR: clarklab/nancy-#1 (draft)
Last commit: `2c0e97a`. CI green. Working tree clean.

---

## 1. Where things actually stand

### Done and verified

| Area | State | How it was verified |
| --- | --- | --- |
| Story | 5 acts, 10 cast, 60 clues, full solution chain | `docs/design/story-bible.json` |
| Content | 34 scenes, 85 items, 46 dialogue trees, 14 cinematics | `npm run check:content` exits 0 |
| Puzzles | 16 defined, 16 implemented and registered | `src/puzzles/index.ts` registers all four batches |
| Art | 34 scenes, 10 portraits, 85 items, 12 UI | all present under `public/art/` |
| Voice | 64 lines, 10 British-cast voices | `public/audio/vo/`, index at `src/game/vo-index.json` |
| Audio | procedural, calibrated | `npm run check:audio` passes |
| Progression | provably completable | `docs/critical-path.md` — 73 steps |
| Harness | 11/11 shots, 0 console errors | `node tools/shoot.mjs` |

### Not done

**Visual polish.** Three independent critics scored every screen between
**3.0 and 5.6 out of 10** against a pass bar of 8.5. That is the whole of the
remaining work, and it is well specified — see §3.

Smaller known items in `docs/integration-defects.md`: the hover ring reads as a
hard rectangle (#2), rain falls inside the cabin on `the-ardent` (#12), empty
inventory slots read as flat rectangles and `plate-slot.webp` is generated but
unused (#13).

---

## 2. Read this before re-running the critic loop

`tools/workflows/critic-loop.js` **died twice, both times in the fix phase.**

- Run 1 (`wf_d6a4ed4c-845`): 42 agents started, 40 returned. Round-1 fixes
  landed and were a genuine improvement — the journal went from a single
  column on a black void to a real two-page spread. Committed as `0ebfd07`.
- Run 2 (`wf_0ba551d1-d64`): 36 started, 34 returned. Produced 1 capture and
  33 critiques and then **0 fixes** — it died before any fixer ran.

Both runs died around the same point. The likely cause is the fix phase's
weight: one fixer per failing shot, each at high effort, each rebuilding,
re-shooting and re-reading a PNG. Eight to eleven of those in one phase is
apparently more than the run survives.

**Do not just launch it again.** The critiques are the valuable part and they
already exist. What is needed is a *bounded* fix pass.

A subtle trap: the loop looks alive from its journal because the result count
sits just short of the total. Check file mtimes instead —

```bash
W=/root/.claude/projects/.../subagents/workflows/<runId>
ls -t $W/agent-*.jsonl | head -3 | xargs -I{} stat -c '%y {}' {}
```

If the newest transcript has not moved in ten minutes, it is dead, not busy.

---

## 3. The prepared next step

The 33 critiques from run 2 have already been extracted, deduplicated by
screen, filtered to critical/major, and grouped into four briefs:

**`tools/critique-briefs.json`** — keys `journal`, `puzzles`, `converse`,
`world`. Each value is markdown, ready to paste into an agent prompt.

They are unusually good. A sample, verbatim:

> The page is not lit. I sampled the spread: brightest point 238,225,197 at the
> head, darkest 221,203,168 mid-page — a 7% value range over an object
> occupying 60% of the frame. That is ambient fill, not a key with falloff.

> The entire puzzle frame is not centred in the viewport. Measured on the PNG:
> the outer gold-cornered frame runs x=32 to x=1647 on a 1920px canvas — 32px
> of margin on the left, 273px of pure dead black on the right.

> The 1911 sand-cast brass instruction plate is typeset in Inter Tight — a
> 2020s neo-grotesk. The plate is diegetic scenery, not chrome.

### Recommended shape

Four agents, **one phase, no loop**, each owning a disjoint set of files:

| Agent | Brief key | Owns |
| --- | --- | --- |
| journal | `journal` | `src/ui/journal.ts`, `src/styles/journal.css` |
| puzzles | `puzzles` | `src/styles/puzzle.css`, `src/styles/puzzles-*.css`, `src/puzzles/*.ts` |
| converse | `converse` | `src/ui/dialogue.ts`, `src/ui/menus.ts`, and their stylesheets |
| world | `world` | `src/styles/base.css`, `src/styles/hud.css`, `src/ui/hud.ts`, `src/engine/scene-view.ts` |

Tell each one: **do not rebuild, do not re-shoot, do not commit.** Just fix.
Capture once yourself afterwards with `node tools/shoot.mjs --out shots/next`
and read the PNGs. That keeps each agent cheap enough to finish.

Recurring themes across all four briefs, worth stating as global direction:

1. **Nothing is lit.** Surfaces use flat ambient fill. Every panel needs a key
   light with real falloff — the design tokens already carry `--glow-lamp` and
   the shadow ramp for this.
2. **Dead space.** Several screens leave 40% of the frame empty black or empty
   paper. Grids using `repeat(auto-fill, …)` are leaving orphan tracks.
3. **Clipping.** The journal's bottom card row is cut mid-sentence; it needs
   pagination, not overflow.
4. **Centring.** The puzzle frame sits 240px left of centre.
5. **Wrong typeface on diegetic objects.** Chrome type (`--font-ui`, Inter
   Tight) is being used on in-world props like a 1911 brass plate.

---

## 4. Things that will bite you

**`tools/safe-commit.sh` is not optional.** Agents write files continuously. It
fingerprints the tree, runs typecheck + tests + build, then re-fingerprints and
retries if anything moved. Plain `git add -A` will capture a half-written file —
that is exactly how a mid-write `mechanism.ts` reached CI. Usage:
`bash tools/safe-commit.sh "message" <maxAttempts> <maxWaitSeconds>`

**Blocking beats hang automation.** `narration.say/think` and
`dialogue.converse` only resolve on player input. The harness uses
`__test.setAutoAdvance(ms)` and never awaits a conversation. If you add a new
blocking surface, add the same escape or the harness will hang with no error.

**`forceClose()` resumes the boot flow.** It resolves the title screen, which
lets `newGame()` run and start the opening cinematic *over* whatever you
navigated to. `__test.startNewGameSkippingIntro` sets `skipCinematics` first.

**Agents leave probe scripts at the repo root.** `.gitignore` covers
`/_*.mjs`, `/.*.mjs`, `/*probe*.mjs`, `/shoot*.mjs`. Widen it rather than
committing them.

**API keys** are the user's, supplied in chat, and are **not** in the repo.
Re-supply via env: `OPENAI_API_KEY` for `npm run art`, `ELEVENLABS_API_KEY`
for `npm run voice`. Both pipelines are resumable and hash-aware, so a re-run
with the same inputs costs nothing.

---

## 5. Open questions for the user

1. **Title.** The repo is *The Lamplight Cipher*; the story bible titles the
   work *NOTICE TO MARINERS — A Wren Adare Mystery*. I kept the former because
   the key art, favicon, boot animation and README are all built around the
   lamp. Worth confirming.
2. **`combinesWith` is data-only.** `src/engine/types.ts` declares it and
   `items.ts` populates seven chains, but no engine code consumes it. No
   progression depends on it. Either implement it or drop the field.
3. **~90 flags are set but never read.** Mostly deliberate dialogue-state
   bookkeeping for the deduction board. Harmless, but worth a sweep.

---

## 6. Commands

```bash
npm run dev            # http://localhost:5173
npm run build          # typecheck + bundle
npm test               # 15 engine unit tests
npm run check:content  # graph integrity, act-aware reachability
npm run check:audio    # needs the dev server running
node tools/shoot.mjs --out shots/x   # 11 screenshots
```
