export const meta = {
  name: 'nancy-aaa-critic-loop',
  description: 'Screenshot the game, subject every shot to a harsh AAA critic panel, fix what fails, repeat until it passes',
  phases: [
    { title: 'Capture', detail: 'build and screenshot every reviewable state' },
    { title: 'Critique', detail: 'harsh critics score each shot against the AAA bar' },
    { title: 'Fix', detail: 'apply the fixes each critic demands' },
    { title: 'Verdict', detail: 'blind A/B against the reference bar' },
  ],
}

/** How many capture → critique → fix rounds to run before reporting. */
const MAX_ROUNDS = Number(args?.rounds ?? 3)
/** A shot passes when every critic scores it at or above this. */
const PASS = Number(args?.pass ?? 8.5)

const SHARED = `
PROJECT: "The Lamplight Cipher" — an original first-person point-and-click mystery adventure
game in the browser. Repo root: /home/user/nancy-  (branch claude/nancy-drew-puzzle-game-uzkhnp)
Stack: Vite + TypeScript, plain DOM + CSS + Canvas. Design tokens in src/styles/tokens.css.

THE BAR: the most recent Nancy Drew adventure games (Sea of Darkness, Midnight in Salem,
Ghost of Thornton Hall) and adjacent AAA narrative adventures. Not "good for a web game" —
good, full stop, next to a commercial title.

HOW TO LOOK AT A SCREENSHOT: use the Read tool on the PNG path. You will see the image.
Judge what is actually in front of you, not what the code says should be there.
`

const RUBRIC = `
SCORE 1-10 ON EACH AXIS. Be harsh. 7 = "competent". 9-10 = "I would believe this shipped."
A single glaring defect caps the overall score at 6 no matter how good the rest is.

1. COMPOSITION & FRAMING — does the image read instantly? Is there a clear focal hierarchy?
   Is the UI placed where it does not fight the art? Any awkward crops, dead space, tangents?
2. LIGHT & COLOUR — is there a coherent key light with real falloff? Does the palette hold
   together? Are the darks rich rather than crushed, the highlights warm rather than blown?
   Does the UI sit INSIDE the scene's light, or float on top of it like a web page?
3. TYPOGRAPHY — correct typeface for the register (display / body / chrome)? Sane measure,
   leading and tracking? Any orphans, widows, clipping, or text over busy artwork without
   a scrim? Does the type feel period-appropriate, or does it feel like a default web font?
4. MATERIAL & DEPTH — do surfaces read as lit physical objects (brass, paper, leather, glass)
   with edge highlights and cast shadows? Or as flat CSS rectangles with a sepia tint?
5. POLISH & CRAFT — alignment, consistent spacing rhythm, consistent corner radii and border
   weights, no clipped content, no scrollbars, no debug artifacts, no default focus rings,
   no obviously-placeholder content.
6. ATMOSPHERE — does this image make you want to be in that room? Does it feel like a mystery?

BE SPECIFIC. "Improve the typography" is worthless. "The clue card title is Crimson Pro at
~18px with 1.6 leading, which is too loose for a two-word heading — it should be Cormorant
Garamond 600 at ~22px with 1.15 leading" is useful. Cite what you SEE, with locations.
`

const FIX_RULES = `
YOU MAY EDIT: src/styles/**, src/ui/**, src/engine/scene-view.ts, src/engine/weather.ts,
src/puzzles/**. Do NOT edit src/engine/types.ts, src/engine/state.ts, or src/game/**
(content is owned elsewhere) unless the defect is literally in the content prose.
Do NOT run git commands. Do NOT commit.
Use the design tokens in src/styles/tokens.css; never hardcode a colour or duration.
After editing run \`npx tsc --noEmit\` and confirm no new errors.
`

// Each round: rebuild, re-shoot, re-critique, fix. Stops early once everything passes.
let round = 0
let history = []

while (round < MAX_ROUNDS) {
  round++
  phase('Capture')

  const capture = await agent(`${SHARED}

=== ROUND ${round}: CAPTURE ===
Produce fresh screenshots of the game for visual review.

1. Run \`npm run build\`. If it fails, FIX the build errors (you may edit any file needed to
   make it compile) and try again. Report what you fixed.
2. Run \`node tools/shoot.mjs --out shots/round${round}\`.
   If a shot fails, diagnose why — a failing shot usually means a real defect (a panel that
   never opens, a promise that never resolves). Fix it and re-run.
3. Report the absolute path of every PNG produced, and any console errors the report
   recorded in shots/round${round}/report.json.

Return the list of shot names with their absolute paths.`,
    { label: `capture:r${round}`, phase: 'Capture', effort: 'high', schema: {
      type: 'object', additionalProperties: false,
      required: ['buildOk', 'shots', 'consoleErrors', 'fixesMade'],
      properties: {
        buildOk: { type: 'boolean' },
        shots: { type: 'array', items: { type: 'object', additionalProperties: false,
          required: ['name', 'path'], properties: { name: { type: 'string' }, path: { type: 'string' } } } },
        consoleErrors: { type: 'array', items: { type: 'string' } },
        fixesMade: { type: 'array', items: { type: 'string' } },
      },
    } })

  const shots = (capture?.shots ?? []).filter(s => s?.path)
  if (!shots.length) {
    log(`round ${round}: capture produced no shots — stopping`)
    break
  }
  log(`round ${round}: captured ${shots.length} shots`)

  phase('Critique')

  // Three critics per shot, each with a different allergy, so no single
  // reviewer's blind spot lets a defect through.
  const LENSES = [
    ['art-director', `You are an art director from a AAA narrative studio. You care about light,
colour, composition, material honesty and atmosphere. You have shipped games that reviewers
called beautiful. You are allergic to anything that looks like a web page wearing a costume.`],
    ['ux-designer', `You are a senior UI/UX designer for games. You care about hierarchy,
readability, spacing rhythm, affordance clarity, consistency, and whether a player would
know what to do. You are allergic to inconsistent spacing and to text that is hard to read
over artwork.`],
    ['typographer', `You are a typographer and production designer. You care about typeface
choice, size, weight, tracking, leading, measure, alignment, and period authenticity. You
notice a 2px misalignment and a wrong quote mark. You are allergic to default web type.`],
  ]

  const CRIT_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['shot', 'lens', 'scores', 'overall', 'verdict', 'defects'],
    properties: {
      shot: { type: 'string' }, lens: { type: 'string' },
      scores: { type: 'object', additionalProperties: false,
        required: ['composition', 'lightColour', 'typography', 'materialDepth', 'polish', 'atmosphere'],
        properties: {
          composition: { type: 'number' }, lightColour: { type: 'number' },
          typography: { type: 'number' }, materialDepth: { type: 'number' },
          polish: { type: 'number' }, atmosphere: { type: 'number' },
        } },
      overall: { type: 'number' },
      verdict: { type: 'string', description: 'AAA or NOT_AAA' },
      defects: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['severity', 'what', 'where', 'fix'],
        properties: {
          severity: { type: 'string' }, what: { type: 'string' },
          where: { type: 'string' }, fix: { type: 'string' },
        } } },
    },
  }

  // Pipeline so each shot's three critiques start as soon as that shot exists.
  const critiques = (await pipeline(
    shots,
    (shot) => parallel(LENSES.map(([key, persona]) => () =>
      agent(`${SHARED}

${persona}

=== CRITIQUE: the "${shot.name}" screen ===
Read this image: ${shot.path}

${RUBRIC}

Set verdict to "AAA" only if you would genuinely be content to see this in a shipped
commercial adventure game. Otherwise "NOT_AAA".
For every defect give: severity (critical|major|minor), what is wrong, WHERE in the frame,
and the specific fix — name the file and the property you would change where you can.`,
        { label: `crit:${shot.name}:${key}`, phase: 'Critique', schema: CRIT_SCHEMA })
    )),
  )).flat().filter(Boolean)

  const byShot = {}
  for (const c of critiques) {
    (byShot[c.shot] ??= []).push(c)
  }
  const worst = Object.entries(byShot).map(([name, cs]) => ({
    name,
    min: Math.min(...cs.map(c => c.overall)),
    avg: cs.reduce((a, c) => a + c.overall, 0) / cs.length,
    critical: cs.flatMap(c => c.defects.filter(d => d.severity === 'critical')),
  }))

  const failing = worst.filter(w => w.min < PASS)
  history.push({ round, scores: worst.map(w => `${w.name}=${w.min.toFixed(1)}`), failing: failing.length })
  log(`round ${round}: ${worst.map(w => `${w.name} ${w.min.toFixed(1)}`).join('  ')}`)

  if (!failing.length) {
    log(`round ${round}: every shot cleared ${PASS}. Stopping early.`)
    break
  }

  phase('Fix')

  // One fixer per failing shot, each handed the union of all three critiques.
  await parallel(failing.map(f => () => {
    const notes = byShot[f.name].map(c =>
      `--- ${c.lens} (overall ${c.overall}, ${c.verdict}) ---\n` +
      `scores: ${JSON.stringify(c.scores)}\n` +
      c.defects.map(d => `  [${d.severity}] ${d.what}\n     where: ${d.where}\n     fix: ${d.fix}`).join('\n'),
    ).join('\n\n')

    return agent(`${SHARED}

=== FIX the "${f.name}" screen ===
Three critics reviewed this screen. Its lowest score was ${f.min.toFixed(1)}/10; it must reach
${PASS}. Here is everything they said:

${notes}

${FIX_RULES}

Work through EVERY critical and major defect. Minor ones too where the fix is cheap.
Where two critics disagree, use your judgement and say which you followed and why.
Do not paper over a defect by hiding the element — fix the underlying design.

Then verify: run \`npm run build\`, then
\`node tools/shoot.mjs --out shots/verify-${f.name} --only ${f.name}\`,
and Read the resulting PNG yourself. Is it actually better? If not, iterate before returning.

Return what you changed and your own honest score for the result.`,
      { label: `fix:${f.name}`, phase: 'Fix', effort: 'high', schema: {
        type: 'object', additionalProperties: false,
        required: ['shot', 'changes', 'filesEdited', 'selfScore', 'notFixed'],
        properties: {
          shot: { type: 'string' },
          changes: { type: 'array', items: { type: 'string' } },
          filesEdited: { type: 'array', items: { type: 'string' } },
          selfScore: { type: 'number' },
          notFixed: { type: 'array', items: { type: 'string' } },
        },
      } })
  }))
}

phase('Verdict')

// Final gate: a fresh critic who has seen none of the iteration, asked the
// single question the whole loop exists to answer.
const final = await agent(`${SHARED}

=== FINAL VERDICT ===
You have not seen any of this project's iteration history. Judge it cold.

1. Run \`npm run build\` then \`node tools/shoot.mjs --out shots/final\`.
2. Read EVERY PNG in shots/final/.
3. For each one, answer the only question that matters:

   If you were handed this screenshot and a screenshot from a recent commercial Nancy Drew
   game, with no labels and no context, and asked "which one is the AAA commercial product?"
   — which would you pick, and why?

   Answer honestly for each screen. If ours would lose, say so and say exactly what gives
   it away.

4. Give a final overall score and a ship / do-not-ship recommendation.

${RUBRIC}`,
  { label: 'final-verdict', phase: 'Verdict', effort: 'high', schema: {
    type: 'object', additionalProperties: false,
    required: ['perScreen', 'overallScore', 'wouldShip', 'tellsThatGiveItAway', 'strongest', 'weakest'],
    properties: {
      perScreen: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['screen', 'score', 'blindPick', 'reasoning'],
        properties: {
          screen: { type: 'string' }, score: { type: 'number' },
          blindPick: { type: 'string', description: 'OURS or COMMERCIAL' },
          reasoning: { type: 'string' },
        } } },
      overallScore: { type: 'number' },
      wouldShip: { type: 'boolean' },
      tellsThatGiveItAway: { type: 'array', items: { type: 'string' } },
      strongest: { type: 'string' },
      weakest: { type: 'string' },
    },
  } })

return { rounds: history, final }
