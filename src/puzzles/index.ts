/**
 * Puzzle registration.
 *
 * Each batch module registers its own minigames against the ids declared in
 * `src/game/puzzles.ts`. Importing this one module wires all of them, so the
 * orchestrator never has to know which file a given puzzle lives in — and a
 * new puzzle is added by editing its batch, not a central table.
 *
 * Registration is explicit rather than a side effect of import: bundlers are
 * free to drop a module imported purely for effect, and a silently tree-shaken
 * puzzle presents to the player as "this mechanism has not been built yet".
 */

import { registerCipherPuzzles } from './cipher';
import { registerLogicPuzzles } from './logic';
import { registerMechanismPuzzles } from './mechanism';
import { registerSensoryPuzzles } from './sensory';

let registered = false;

/** Idempotent: safe to call from both the game boot and a test harness. */
export function registerAllPuzzles(): void {
  if (registered) return;
  registered = true;

  registerCipherPuzzles();
  registerMechanismPuzzles();
  registerLogicPuzzles();
  registerSensoryPuzzles();
}
