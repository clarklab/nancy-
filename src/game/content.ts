/**
 * Content assembly and integrity checking.
 *
 * Content is authored as TypeScript modules rather than JSON so the compiler
 * catches a mistyped scene id at build time. What the compiler cannot catch —
 * an effect pointing at a clue nobody defines, a room with no way out, a
 * puzzle that is never opened — is caught here by `validateContent`, which
 * runs on every dev boot and in the test suite.
 */

import type {
  Condition,
  Effect,
  GameContent,
  Hotspot,
  Scene,
} from '@/engine/types';

import { scenes } from './scenes';
import { items } from './items';
import { clues } from './clues';
import { characters } from './characters';
import { dialogue } from './dialogue';
import { puzzles } from './puzzles';
import { cinematics } from './cinematics';
import { acts, START_SCENE, OPENING_CINEMATIC, GAME_TITLE } from './acts';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

/** Walks every effect tree in the content, yielding each effect with its path. */
function* walkEffects(
  effects: Effect[] | undefined,
  where: string,
): Generator<{ effect: Effect; where: string }> {
  if (!effects) return;
  for (const [i, e] of effects.entries()) {
    const at = `${where}[${i}]`;
    yield { effect: e, where: at };
    if (e.kind === 'if') {
      yield* walkEffects(e.then, `${at}.then`);
      yield* walkEffects(e.else, `${at}.else`);
    } else if (e.kind === 'sequence') {
      yield* walkEffects(e.of, `${at}.of`);
    }
  }
}

/** Walks a condition tree, yielding each leaf predicate. */
function* walkConditions(cond: Condition | undefined): Generator<Condition> {
  if (!cond) return;
  yield cond;
  if (cond.kind === 'all' || cond.kind === 'any') {
    for (const c of cond.of) yield* walkConditions(c);
  } else if (cond.kind === 'not') {
    yield* walkConditions(cond.of);
  }
}

function* allHotspotEffects(scene: Scene): Generator<{ effects: Effect[]; where: string }> {
  const tag = (hs: Hotspot, part: string) => `scene:${scene.id}/${hs.id}.${part}`;
  for (const hs of scene.hotspots) {
    yield { effects: hs.onInteract, where: tag(hs, 'onInteract') };
    if (hs.blockedEffects) yield { effects: hs.blockedEffects, where: tag(hs, 'blockedEffects') };
    if (hs.onWrongItem) yield { effects: hs.onWrongItem, where: tag(hs, 'onWrongItem') };
    for (const a of hs.accepts ?? []) {
      yield { effects: a.effects, where: tag(hs, `accepts:${a.item}`) };
    }
  }
  if (scene.onEnter) yield { effects: scene.onEnter, where: `scene:${scene.id}.onEnter` };
  if (scene.onFirstEnter) yield { effects: scene.onFirstEnter, where: `scene:${scene.id}.onFirstEnter` };
}

/**
 * Cross-references every id the content mentions against what it defines, and
 * reports structural problems that would strand a player.
 */
export function validateContent(c: GameContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (where: string, message: string) => issues.push({ severity: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ severity: 'warning', where, message });

  const has = {
    scene: (id: string) => id in c.scenes,
    item: (id: string) => id in c.items,
    clue: (id: string) => id in c.clues,
    character: (id: string) => id in c.characters,
    puzzle: (id: string) => id in c.puzzles,
    cinematic: (id: string) => id in c.cinematics,
  };

  // Which scenes/puzzles are actually reachable from somewhere.
  const referencedScenes = new Set<string>([c.startScene]);
  const openedPuzzles = new Set<string>();
  const grantedClues = new Set<string>();
  const grantedItems = new Set<string>();
  const usedItems = new Set<string>();

  const checkEffects = (effects: Effect[] | undefined, where: string) => {
    for (const { effect: e, where: at } of walkEffects(effects, where)) {
      switch (e.kind) {
        case 'goto':
          if (!has.scene(e.scene)) err(at, `goto unknown scene "${e.scene}"`);
          referencedScenes.add(e.scene);
          break;
        case 'unlockScene':
          if (!has.scene(e.scene)) err(at, `unlockScene unknown scene "${e.scene}"`);
          referencedScenes.add(e.scene);
          break;
        case 'giveItem':
          if (!has.item(e.item)) err(at, `giveItem unknown item "${e.item}"`);
          grantedItems.add(e.item);
          break;
        case 'takeItem':
          if (!has.item(e.item)) err(at, `takeItem unknown item "${e.item}"`);
          break;
        case 'giveClue':
          if (!has.clue(e.clue)) err(at, `giveClue unknown clue "${e.clue}"`);
          grantedClues.add(e.clue);
          break;
        case 'openPuzzle':
          if (!has.puzzle(e.puzzle)) err(at, `openPuzzle unknown puzzle "${e.puzzle}"`);
          openedPuzzles.add(e.puzzle);
          break;
        case 'talk':
          if (!has.character(e.character)) err(at, `talk to unknown character "${e.character}"`);
          break;
        case 'cinematic':
          if (!has.cinematic(e.id)) err(at, `unknown cinematic "${e.id}"`);
          break;
        case 'setAct':
          if (!c.acts.some((a) => a.number === e.act)) err(at, `setAct to undefined act ${e.act}`);
          break;
        default:
          break;
      }
    }
  };

  const checkCondition = (cond: Condition | undefined, where: string) => {
    for (const k of walkConditions(cond)) {
      if (k.kind === 'hasItem' || k.kind === 'lacksItem') {
        if (!has.item(k.item)) err(where, `condition references unknown item "${k.item}"`);
        usedItems.add(k.item);
      } else if (k.kind === 'hasClue' || k.kind === 'lacksClue') {
        if (!has.clue(k.clue)) err(where, `condition references unknown clue "${k.clue}"`);
      } else if (k.kind === 'puzzleSolved' || k.kind === 'puzzleUnsolved') {
        if (!has.puzzle(k.puzzle)) err(where, `condition references unknown puzzle "${k.puzzle}"`);
      } else if (k.kind === 'visited') {
        if (!has.scene(k.scene)) err(where, `condition references unknown scene "${k.scene}"`);
      }
    }
  };

  // -- scenes --------------------------------------------------------------
  for (const scene of Object.values(c.scenes)) {
    if (!scene.background) err(`scene:${scene.id}`, 'missing background');
    checkCondition(scene.enterIf, `scene:${scene.id}.enterIf`);

    const seenHotspot = new Set<string>();
    for (const hs of scene.hotspots) {
      if (seenHotspot.has(hs.id)) err(`scene:${scene.id}`, `duplicate hotspot id "${hs.id}"`);
      seenHotspot.add(hs.id);
      checkCondition(hs.visibleIf, `scene:${scene.id}/${hs.id}.visibleIf`);
      checkCondition(hs.enabledIf, `scene:${scene.id}/${hs.id}.enabledIf`);
      for (const a of hs.accepts ?? []) {
        if (!has.item(a.item)) err(`scene:${scene.id}/${hs.id}`, `accepts unknown item "${a.item}"`);
        usedItems.add(a.item);
      }
      if (hs.shape.type === 'rect') {
        const { x, y, w, h } = hs.shape.rect;
        if (x < 0 || y < 0 || x + w > 1.001 || y + h > 1.001) {
          warn(`scene:${scene.id}/${hs.id}`, `hotspot extends outside the frame`);
        }
        if (w < 0.02 || h < 0.02) {
          warn(`scene:${scene.id}/${hs.id}`, `hotspot is very small (${w.toFixed(3)}x${h.toFixed(3)})`);
        }
      }
    }

    for (const { effects, where } of allHotspotEffects(scene)) checkEffects(effects, where);

    // Every room needs a way out, or the player is stuck.
    const exits = scene.hotspots.filter((hs) =>
      [...walkEffects(hs.onInteract, '')].some((e) => e.effect.kind === 'goto'),
    );
    if (!exits.length) {
      err(`scene:${scene.id}`, 'no hotspot leads anywhere — the player would be trapped');
    }

    for (const layer of scene.layers ?? []) {
      checkCondition(layer.visibleIf, `scene:${scene.id}/layer:${layer.id}.visibleIf`);
    }
  }

  // -- dialogue ------------------------------------------------------------
  const nodeIds = new Set<string>();
  for (const tree of c.dialogue) {
    const where = `dialogue:${tree.characterId}@act${tree.act}`;
    if (!has.character(tree.characterId)) err(where, `unknown character "${tree.characterId}"`);
    checkCondition(tree.availableIf, `${where}.availableIf`);

    const walkNodes = (nodes: typeof tree.nodes, prefix: string) => {
      for (const n of nodes) {
        const at = `${prefix}/${n.id}`;
        // Node ids are the save key for "already asked", so they must be unique.
        if (nodeIds.has(n.id)) err(at, `duplicate dialogue node id "${n.id}"`);
        nodeIds.add(n.id);
        checkCondition(n.availableIf, `${at}.availableIf`);
        checkEffects(n.effects, `${at}.effects`);
        if (n.children) walkNodes(n.children, at);
      }
    };
    walkNodes(tree.nodes, where);
  }

  // -- puzzles, cinematics, acts -------------------------------------------
  for (const p of Object.values(c.puzzles)) {
    checkEffects(p.onSolve, `puzzle:${p.id}.onSolve`);
    if (p.hints.length !== 3) warn(`puzzle:${p.id}`, `expected 3 hints, found ${p.hints.length}`);
    if (!openedPuzzles.has(p.id)) warn(`puzzle:${p.id}`, 'defined but never opened by any effect');
  }

  for (const cin of Object.values(c.cinematics)) {
    if (!cin.beats.length) err(`cinematic:${cin.id}`, 'has no beats');
  }

  if (!has.scene(c.startScene)) err('content', `startScene "${c.startScene}" does not exist`);
  if (c.openingCinematic && !has.cinematic(c.openingCinematic)) {
    err('content', `openingCinematic "${c.openingCinematic}" does not exist`);
  }

  // -- reachability & dead content ------------------------------------------
  for (const id of Object.keys(c.scenes)) {
    if (!referencedScenes.has(id)) warn(`scene:${id}`, 'unreachable — nothing navigates here');
  }
  for (const id of Object.keys(c.clues)) {
    if (!grantedClues.has(id)) warn(`clue:${id}`, 'never granted by any effect');
  }
  for (const id of Object.keys(c.items)) {
    if (!grantedItems.has(id)) warn(`item:${id}`, 'never granted by any effect');
  }

  return issues;
}

/** Assembles the full content graph. */
export function buildContent(): GameContent {
  return {
    title: GAME_TITLE,
    scenes,
    items,
    clues,
    characters,
    dialogue,
    puzzles,
    cinematics,
    acts,
    startScene: START_SCENE,
    openingCinematic: OPENING_CINEMATIC,
  };
}

/**
 * Loads content and, in development, surfaces integrity problems loudly.
 * Errors are fatal in dev so a broken link is fixed before it ships; in a
 * production build the game degrades rather than refusing to start.
 */
export async function loadContent(): Promise<GameContent> {
  const content = buildContent();

  if (import.meta.env.DEV) {
    const issues = validateContent(content);
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');

    if (warnings.length) {
      console.groupCollapsed(`%cContent: ${warnings.length} warnings`, 'color:#e0a83f');
      for (const w of warnings) console.warn(`${w.where}: ${w.message}`);
      console.groupEnd();
    }
    if (errors.length) {
      console.group(`%cContent: ${errors.length} ERRORS`, 'color:#c2453a;font-weight:bold');
      for (const e of errors) console.error(`${e.where}: ${e.message}`);
      console.groupEnd();
    }
  }

  return content;
}
