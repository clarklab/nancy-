# The Lamplight Cipher

A first-person point-and-click mystery adventure for the browser, built to the
production bar of the modern Nancy Drew adventure games — original story,
original cast, painted locations, diegetic puzzles, and a case that can be
solved by paying attention.

> Autumn, 1998. A nineteen-year-old apprentice archivist is sent alone to
> appraise the records of a dissolving coastal pilotage authority, and finds
> that the shipwreck that killed thirty-one people in 1974 was signed off by a
> man who could not hold a pen.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # typecheck + production bundle into dist/
npm run preview      # serve the built bundle
```

## What is here

| Path | What it is |
| --- | --- |
| `src/engine/` | Content-agnostic game engine — state machine, scene renderer, weather, audio, orchestrator |
| `src/ui/` | Presentation subsystems — HUD, journal, dialogue, puzzle host, cinematics, menus |
| `src/game/` | The game itself: scenes, cast, clues, items, dialogue trees, puzzle definitions |
| `src/puzzles/` | The minigame implementations |
| `src/styles/` | Design tokens and per-subsystem stylesheets |
| `docs/design/` | The design documents the content is authored from |
| `tools/` | Art pipeline, font vendoring, screenshot harness, checks |

### Architecture

Content is **data**, not code. Every room, conversation, clue and puzzle is a
typed value in `src/game/**` that satisfies the schema in
`src/engine/types.ts`. Two small declarative languages do the work:

- **`Condition`** — a predicate over game state (`hasClue`, `act`, `flag`,
  `puzzleSolved`, composed with `all` / `any` / `not`). Hotspots, dialogue
  options and scene layers are all gated by these, which is how one painted
  room evolves across five acts.
- **`Effect`** — a state mutation or a presentation beat (`giveClue`,
  `narrate`, `goto`, `openPuzzle`, `if`/`sequence`). Effects run in order and
  the presentational ones block until the player acknowledges them, so pacing
  is expressed in the content rather than hand-coded.

`GameState` interprets both and knows nothing about the DOM; it talks to a
`Presenter` interface that `Game` implements. That split is what makes the
state machine unit-testable and lets any subsystem be replaced independently.

What the compiler cannot catch — an effect referencing a clue nobody defines, a
room with no exit, a puzzle that is never opened — `validateContent()` in
`src/game/content.ts` catches on every dev boot.

### Art

All imagery is generated with `gpt-image-2` and committed as web-optimised
WebP. The pipeline is resumable and prompt-hash aware, so re-running only
regenerates what actually changed:

```bash
npm run manifest                     # docs/design/** -> tools/art-manifest.json
OPENAI_API_KEY=... npm run art       # generate everything missing
OPENAI_API_KEY=... npm run art -- --kind scenes --force
```

House style lives in one place: `masterStyleSuffix` in
`docs/design/art-bible.json` is appended to every background prompt, so
restyling the whole game is a single edit.

### Audio

Nothing but the voice cast is a file. Every ambience bed, music cue and sound
effect is synthesised at runtime in `src/engine/audio.ts` — filtered noise for
rain and wind, Poisson-distributed transients for fire, oscillator beds for
music, all sharing one synthesised convolution reverb so the game sounds like
one room.

Because "it compiles" says nothing about whether it makes a sound, there is a
real check that boots the engine, taps the output, and asserts each bed and
one-shot moves the signal:

```bash
npm run dev            # in one terminal
npm run check:audio    # in another
```

### Score

Six zone beds and five dramatic cues, composed with ElevenLabs Music and cooked
by `tools/generate-music.mjs`. A bed belongs to a **place**, not a room — the
zones follow the geography the scenes are already authored in, so the music
persists while you move around the pilotage building and only changes when you
actually go somewhere else. Scored per room, it would cut every time a door
opened.

```bash
ELEVENLABS_API_KEY=... npm run music     # render what is missing
npm run music -- --relevel               # re-level to new LUFS targets, no regeneration
```

Two things the pipeline does that matter more than the generation:

**Loops are made on disk, not in the engine.** A generated track has a beginning
and an end. Each bed has its tail folded back over its head with an equal-power
crossfade, so the file is already circular when it reaches the browser and the
engine just sets `loop = true`. Measured at the wrap point, the sample delta is
**1**, against 2,600–3,800 elsewhere in the same audio.

**Everything is normalised to a fixed LUFS target** — beds to −32, cues to −27.
The model returns tracks mastered at commercial level, between −11 and −16 LUFS
and up to 4.6 LU apart, which is far too loud for a bed and would make crossing
from one zone to the next read as a volume jump rather than a change of place.
The gain is flat rather than `loudnorm`, because dynamic compression applied
after the loop fold would pull the two halves of the join to different gains and
put the seam back.

Composed tracks play **through the music strip**, not straight from their
element. That is what keeps the settings fader and, more importantly, voice
ducking working over them — a track wired to the speakers directly would talk
over every line in the game. `npm run check:audio` asserts it by tapping the
graph, so if the routing ever breaks the check hears silence.

Any cue without a composed track falls back to its synthesised plan, so the
score can be rendered a track at a time and the game is never silent.

### Voice

98 lines are performed by a twelve-strong British cast, rendered with ElevenLabs
and committed as mp3. The selection is deliberate rather than exhaustive: every
character's greeting per act, every lie-trap reply, and every cutscene beat —
the lines that carry a performance. Incidental follow-ups stay as text, which is
also how the Nancy Drew games handle barks.

Casting lives in `docs/design/voice-cast.json`, and each entry records *why* that
voice, so a recast can be argued against intent rather than taste. Unattributed
cutscene prose is Wren's, because the cutscene register is hers — she is the
camera, not a detached narrator.

```bash
npm run voice:manifest                     # pick the lines -> tools/voice-manifest.json
ELEVENLABS_API_KEY=... npm run voice       # render everything missing
```

Both steps are resumable and hash-aware, so a re-run costs nothing for unchanged
dialogue. The renderer resolves every cast voice before spending a character: a
shared-library voice has to be added to the account's own library first, and
until it is, requests for it 404 in a way that looks like a tier problem and is
not. `src/game/cinematic-voice.test.ts` holds the id contract between the
manifest and the player, because when those two disagree the game does not fail
— it just goes quiet.

### Checks

```bash
npm test               # engine unit tests
npm run typecheck      # tsc --noEmit
npm run check:audio    # procedural audio actually produces signal
npm run shoot          # capture screenshots of every reviewable state
```

## Accessibility

- Full keyboard operation; every panel traps focus and returns it on close.
- Hold <kbd>Space</kbd> to outline every interactive hotspot — no pixel hunting.
- `prefers-reduced-motion` thins the weather and collapses transitions rather
  than removing atmosphere entirely.
- Puzzles never encode their only signal in hue.
- Text speed, UI scale, contrast and a dyslexia-friendly face are all settings.

## Licence and attribution

Original work. Nancy Drew and Her Interactive are trademarks of their
respective owners and are referenced here only as a quality benchmark — no
characters, names, art or story from those games appear in this project.
