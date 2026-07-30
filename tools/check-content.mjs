#!/usr/bin/env node
/**
 * Content integrity gate for CI.
 *
 * Runs `validateContent` outside the browser so a broken link — an effect
 * pointing at a clue nobody defines, a room with no exit, a puzzle nothing
 * opens — fails the build instead of surfacing as a stuck player.
 *
 * Errors fail the run; warnings are printed and tolerated, because a few
 * (an item deliberately reachable only through a puzzle reward, say) are
 * legitimate.
 */

import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A Vite dev server in middleware mode gives us the "@/" alias and TS
// transforms without needing a separate build step.
const server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  server: { middlewareMode: true },
  logLevel: 'error',
});

try {
  const mod = await server.ssrLoadModule('/src/game/content.ts');
  const content = mod.buildContent();
  const issues = mod.validateContent(content);

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const counts = {
    scenes: Object.keys(content.scenes).length,
    items: Object.keys(content.items).length,
    clues: Object.keys(content.clues).length,
    characters: Object.keys(content.characters).length,
    puzzles: Object.keys(content.puzzles).length,
    dialogueTrees: content.dialogue.length,
    cinematics: Object.keys(content.cinematics).length,
    acts: content.acts.length,
  };
  console.log('content:', JSON.stringify(counts));

  if (warnings.length) {
    console.log(`\n${warnings.length} warnings:`);
    for (const w of warnings) console.log(`  ${w.where}: ${w.message}`);
  }

  if (errors.length) {
    console.error(`\n${errors.length} ERRORS:`);
    for (const e of errors) console.error(`  ${e.where}: ${e.message}`);
    process.exitCode = 1;
  } else {
    console.log('\ncontent OK');
  }
} finally {
  await server.close();
}
