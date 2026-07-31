export const meta = {
  name: 'nancy-content-build',
  description: 'Implement the full game content graph: scenes, items, clues, cast, dialogue, puzzles, cinematics',
  phases: [
    { title: 'Content', detail: 'author the content modules from the design docs' },
    { title: 'Puzzles', detail: 'implement the puzzle minigames' },
    { title: 'Verify', detail: 'validate the graph and harshly review each module' },
  ],
}

const SHARED = `
PROJECT: "The Lamplight Cipher" — an original first-person point-and-click mystery adventure
game in the browser, built to the production quality of the most recent Nancy Drew games.
Repo root: /home/user/nancy-  (branch claude/nancy-drew-puzzle-game-uzkhnp)

STACK: Vite + TypeScript (strict, noUnusedLocals, noUnusedParameters), no UI framework.
Plain DOM + CSS + Canvas. Alias "@/" -> "src/".

READ THESE FIRST — they define everything:
- docs/design/story-bible.json   the canonical story: cast, timeline, acts, clues, solution
- docs/design/scenes.json        the scene manifest: every location, its hotspots, navigation
- docs/design/puzzles.json       the 16 puzzle specifications
- docs/design/dialogue.json      the conversation trees
- docs/design/art-bible.json     palette, typography, style rules
- src/engine/types.ts            THE content schema — every type you author must satisfy it
- src/game/content.ts            how content is assembled and validated
- src/engine/state.ts            Condition/Effect semantics

The design docs are the SOURCE OF TRUTH for story facts. Do not invent new characters,
locations, or plot. You may (and should) enrich prose, add flavour hotspots, and tighten
wording — but names, motives, the timeline and the solution are fixed.

QUALITY BAR — this is a AAA game:
- Prose is the product. Every examine line should be worth reading: specific, sensory, in the
  protagonist's voice, never "It's a desk." A detective NOTICES things — write what she notices
  and what it implies.
- No dead ends. Every scene must be leavable; every clue must be findable.
- Hotspot rectangles are NORMALISED (0..1) against a 16:10 frame. Place them plausibly for
  the described artwork — read the scene's artPrompt and reason about where things are.
- Every id must be kebab-case and consistent across files.

FORBIDDEN:
- Do NOT create or modify files outside your assigned list. Other agents work in parallel.
- Do NOT run git commands or commit. Do NOT run "npm run dev".
- Do NOT edit src/engine/**, src/ui/**, src/styles/**, or the design docs.

VERIFY BEFORE RETURNING: run  npx tsc --noEmit  and ensure YOUR files have no errors.
`

phase('Content')

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'filesWritten', 'idsDefined', 'typecheckClean', 'notes'],
  properties: {
    summary: { type: 'string' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    idsDefined: { type: 'array', items: { type: 'string' } },
    typecheckClean: { type: 'boolean' },
    notes: { type: 'array', items: { type: 'string' } },
  },
}

// Items/clues/characters/acts are small and highly cross-referenced, so one
// agent owns them all — splitting them would guarantee id drift.
const foundation = await agent(`${SHARED}

=== YOUR ASSIGNMENT: the content foundation ===
YOU OWN EXACTLY: src/game/items.ts, src/game/clues.ts, src/game/characters.ts, src/game/acts.ts

Author, from the design docs:
1. src/game/acts.ts — the five Act records (number, title, epigraph, goal), plus the exported
   consts GAME_TITLE, START_SCENE (the scene id the player begins in) and OPENING_CINEMATIC.
   The epigraph is a single evocative line shown on the act title card.
2. src/game/characters.ts — every cast member. portrait path is
   \`./art/portraits/<id>.webp\`, moods optional. 'bio' is what the detective has written
   about them in her case file — two or three sentences, in her voice, updated for what she
   knows by the end of Act 1.
3. src/game/clues.ts — every clue from the bible plus any the dialogue trees grant.
   'summary' is the detective's own note about what it proves. Set act, category and bearsOn.
4. src/game/items.ts — every physical object the player can carry. icon path is
   \`./art/items/<id>.webp\`. Give each an 'examineText' that is genuinely worth reading, and
   an 'artDescription' field is NOT part of the type — instead put paintable detail into
   'description'. Wire 'combinesWith' where the puzzle designs call for assembling objects.

These four files define the id vocabulary every other agent will reference, so be exhaustive
and be consistent with the design docs' ids. Return the complete list of ids you defined.
`, { label: 'content:foundation', phase: 'Content', schema: SCHEMA, effort: 'high' })

const idContext = `
IDS ALREADY DEFINED by the foundation pass (use these exactly; do not invent new ones
without also noting it in your return value):
${JSON.stringify(foundation?.idsDefined ?? [], null, 1)}
`

const [scenesResult, dialogueResult, puzzleDefsResult] = await parallel([
  () => agent(`${SHARED}
${idContext}

=== YOUR ASSIGNMENT: the scene graph ===
YOU OWN EXACTLY: src/game/scenes.ts  (you may split into src/game/scenes/*.ts with an
index that re-exports a single \`scenes\` record, if that reads better — your call.)

Author every scene in docs/design/scenes.json as a typed \`Scene\`.

For each scene:
- background: \`./art/scenes/<id>.webp\`
- Place 4-8 hotspots with plausible normalised rects. READ the artPrompt and reason about
  composition: a desk described as "right foreground" belongs around x 0.5-0.85, y 0.55-0.9.
  Travel hotspots belong at the frame edges with walk-* cursors.
- onInteract effects that tell the story: 'think' for the detective's observations, 'narrate'
  for anything with a voice, giveClue/giveItem where the design says a clue lives here,
  openPuzzle for puzzle locations, talk for characters, goto for travel.
- Gate act-specific content with visibleIf/enabledIf conditions so a scene evolves across
  the five acts rather than being static.
- Use \`layers\` where a scene has a visible state change (a lit lamp, an opened panel,
  a moved rug): src \`./art/scenes/<id>-<layer>.webp\`, with a visibleIf condition.
  List every layer image you reference in your return value's notes — they must be generated.
- Set weather and ambience per the manifest.
- onFirstEnter for the arrival beat; keep it short and atmospheric.

The navigation graph must match the manifest and must be fully connected both ways.
`, { label: 'content:scenes', phase: 'Content', schema: SCHEMA, effort: 'high' }),

  () => agent(`${SHARED}
${idContext}

=== YOUR ASSIGNMENT: the conversations ===
YOU OWN EXACTLY: src/game/dialogue.ts  (or src/game/dialogue/*.ts with an index exporting
a single \`dialogue\` array.)

Turn docs/design/dialogue.json into typed \`DialogueTree\` values — one per character per act
they appear in.

Requirements:
- Each character's VOICE must be unmistakable. A reader should identify the speaker from a
  single line. Use the speechStyle notes in the story bible.
- availableIf conditions gate probing topics on holding the relevant clue.
- Mark the lie-trap nodes \`isConfrontation: true\` and write the evasion → crack as a
  parent node with \`children\` follow-ups.
- effects: giveClue where the conversation yields evidence, setFlag for story state,
  addCounter for trust/suspicion where the design uses it.
- Write \`exhausted\` and \`farewell\` lines per tree, in character.
- Keep lines under ~45 words. This is performed dialogue, not prose.
- Node ids must be globally unique across ALL trees — prefix with the character id.
`, { label: 'content:dialogue', phase: 'Content', schema: SCHEMA, effort: 'high' }),

  () => agent(`${SHARED}
${idContext}

=== YOUR ASSIGNMENT: puzzle definitions and cinematics ===
YOU OWN EXACTLY: src/game/puzzles.ts, src/game/cinematics.ts

1. src/game/puzzles.ts — a \`PuzzleDefinition\` for each of the 16 puzzles in
   docs/design/puzzles.json: id, name, premise (the in-fiction framing shown when it opens),
   the three escalating hints verbatim from the design (tightened for voice), onSolve effects
   (give the clue/item, set flags, advance the act where the design says so), and
   allowSkipAfterMs (use 300000 — five minutes — for the harder ones, omit for the easy ones).

2. src/game/cinematics.ts — author the story cutscenes:
   - 'opening': the arrival. 4-6 beats establishing the place, the weather, the job, and the
     wrongness. Images \`./art/scenes/<sceneId>.webp\` reusing scene art with Ken Burns moves.
   - one act-transition cinematic for each of acts 2-5 that the design's cliffhangers call for
   - 'ending-solved' and 'ending-wrong' for the two resolutions
   Beats need real writing — this is where the game's voice is loudest. Keep each beat's text
   to one or two sentences; let the images breathe.

List every image path you reference in notes so the art pipeline can generate them.
`, { label: 'content:puzzledefs', phase: 'Content', schema: SCHEMA, effort: 'high' }),
])

phase('Puzzles')

// The 16 minigames split into four thematic batches so each agent holds a
// coherent set of interaction patterns in mind rather than context-switching.
const BATCHES = [
  { key: 'cipher', file: 'src/puzzles/cipher.ts', what: 'the cipher / decoding / document-restoration puzzles' },
  { key: 'mechanism', file: 'src/puzzles/mechanism.ts', what: 'the mechanical linkage / dial / lock / assembly puzzles' },
  { key: 'logic', file: 'src/puzzles/logic.ts', what: 'the logic-grid / sorting / deduction / map-navigation puzzles' },
  { key: 'sensory', file: 'src/puzzles/sensory.ts', what: 'the optical / light / audio / rhythm / chemistry puzzles' },
]

const puzzleResults = await parallel(BATCHES.map(b => () => agent(`${SHARED}
${idContext}

=== YOUR ASSIGNMENT: implement ${b.what} ===
YOU OWN EXACTLY: ${b.file}  and  src/styles/puzzles-${b.key}.css

FIRST: read src/ui/puzzle-host.ts. It exports \`registerPuzzle(id, factory)\` and shared
primitives (makeDraggable, makeRotatable, makeDial, makeSlider, makeToggle, makeKeypad).
USE THEM — do not reimplement dragging. Read src/game/puzzles.ts for the definitions and
docs/design/puzzles.json for the full specs.

Decide from docs/design/puzzles.json which of the 16 puzzles fall into your category, and
implement exactly those. Each is a \`PuzzleModule\` ({ mount(root, ctx), unmount? }) registered
by id with \`registerPuzzle\`. Export a single \`register${b.key.charAt(0).toUpperCase()}${b.key.slice(1)}Puzzles()\`
function that registers all of yours, so the integration layer calls one function per batch.

QUALITY BAR — a puzzle is a TOY the player enjoys handling:
- It must LOOK like a physical object: brass, paper, glass, wood — built from the design
  tokens, layered gradients, real shadows. Never a form with a submit button.
- Immediate tactile feedback on every interaction: ctx.feedback('click') on pickup,
  'tick' on a detent, 'good'/'bad' on a check.
- The win condition must be checked continuously, not on a submit press, wherever the
  puzzle's nature allows it. Call ctx.solve() the instant the state is correct.
- Persist meaningful progress into ctx.state and call ctx.save(), so closing and reopening
  does not lose work.
- ctx.note(...) to reflect partial progress ("Three of the four dials hold.").
- Fully keyboard operable, ARIA-labelled, and legible in the colour-blind-safe mode
  (never encode the ONLY signal in hue — add shape or texture).
- Clean up every listener and animation frame in unmount().

Write the CSS in your own stylesheet file, scoped under a puzzle-specific root class so
batches cannot collide.
`, { label: `puzzle:${b.key}`, phase: 'Puzzles', schema: SCHEMA, effort: 'high' })))

phase('Verify')

const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['area', 'defectsFound', 'fixesApplied', 'qualityScore', 'remainingConcerns', 'typecheckClean'],
  properties: {
    area: { type: 'string' },
    defectsFound: { type: 'array', items: { type: 'string' } },
    fixesApplied: { type: 'array', items: { type: 'string' } },
    qualityScore: { type: 'number' },
    remainingConcerns: { type: 'array', items: { type: 'string' } },
    typecheckClean: { type: 'boolean' },
  },
}

const reviews = await parallel([
  () => agent(`${SHARED}

=== YOUR ASSIGNMENT: validate the whole content graph and FIX what is broken ===
You own no files exclusively — you may edit anything under src/game/ to fix defects.

1. Run \`npx tsc --noEmit\` and fix every error under src/game/.
2. Write and run a throwaway node script that imports the content and calls
   \`validateContent\` from src/game/content.ts (use \`npx vite-node\` — it resolves the "@/"
   alias). Fix EVERY error it reports and every warning that represents a real problem
   (unreachable scene, clue never granted, puzzle never opened, trapped room).
3. Then play the game on paper: starting from START_SCENE with nothing, can the player
   actually reach the ending? Walk the act gates. Is every clue required by the solution's
   proving chain obtainable? Is any puzzle solvable only with information the player cannot
   yet have? Report and fix real blockers.

Return the validator's final output summary in 'fixesApplied'.
`, { label: 'verify:graph', phase: 'Verify', schema: REVIEW_SCHEMA, effort: 'high' }),

  () => agent(`${SHARED}

=== YOUR ASSIGNMENT: harshly review the PROSE and the puzzles' feel ===
You may edit files under src/game/ (prose) and src/puzzles/ (feel), but do not restructure.

You are a games writer with very high standards and an editor's allergy to filler.
READ the actual content files. Then:

1. PROSE: every 'think', 'narrate', examineText, bio, clue summary and dialogue line.
   Kill: generic observations ("It's locked."), repeated sentence rhythms, anachronisms,
   inconsistent voice, exposition the player did not earn, and any line that tells the
   player how to feel. Rewrite them to be specific and physical. The detective should
   sound like ONE person throughout.
2. VOICE: each suspect must be distinguishable from their lines alone. Where two characters
   sound alike, rewrite the weaker one.
3. PUZZLE FEEL: open src/puzzles/*.ts. Is each one actually satisfying, or is it a form?
   Does it give feedback on every interaction? Would a player understand what to do without
   reading a hint? Fix what you can.

Return your honest 1-10 quality score for the writing as it now stands.
`, { label: 'verify:prose', phase: 'Verify', schema: REVIEW_SCHEMA, effort: 'high' }),
])

return {
  foundation,
  scenes: scenesResult,
  dialogue: dialogueResult,
  puzzleDefs: puzzleDefsResult,
  puzzles: puzzleResults.filter(Boolean),
  reviews: reviews.filter(Boolean),
}
