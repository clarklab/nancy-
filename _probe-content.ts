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
  DialogueNode,
  Effect,
  GameContent,
  Hotspot,
  Scene,
} from '@/engine/types';

import { scenes } from '@/game/scenes';
import { items } from '@/game/items';
import { clues } from '@/game/clues';
import { characters } from '@/game/characters';
import { dialogue } from '@/game/dialogue';
import { puzzles } from '@/game/puzzles';
import { cinematics } from '@/game/cinematics';
import { acts, START_SCENE, OPENING_CINEMATIC, GAME_TITLE } from '@/game/acts';

export const DEBUG: Record<string, any> = {};

export interface ValidationIssue {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Static analysis primitives for the act-aware reachability checks
// ---------------------------------------------------------------------------

/**
 * Three-valued truth. `maybe` means "this analysis cannot decide".
 *
 * Every consumer below treats `maybe` as *possible*. That asymmetry is the
 * whole safety story of these checks: an unprovable condition is assumed
 * satisfiable, so the analyser can only ever report content that is broken in
 * every consistent playthrough. A checker that guesses pessimistically cries
 * wolf, and a checker that cries wolf gets switched off — at which point it
 * stops catching the real soft-locks too.
 */
type Tri = 'yes' | 'no' | 'maybe';

const NEGATE: Record<Tri, Tri> = { yes: 'no', no: 'yes', maybe: 'maybe' };

/**
 * Evaluates a condition when the only fact known statically is the act number.
 * Inventory, flags, puzzle progress and visit history are all `maybe`.
 */
function evalInAct(cond: Condition | undefined, act: number): Tri {
  if (!cond) return 'yes';
  switch (cond.kind) {
    case 'always':
      return 'yes';
    case 'never':
      return 'no';
    case 'act':
      return (cond.min === undefined || act >= cond.min) &&
        (cond.max === undefined || act <= cond.max)
        ? 'yes'
        : 'no';
    case 'all': {
      let worst: Tri = 'yes';
      for (const c of cond.of) {
        const v = evalInAct(c, act);
        if (v === 'no') return 'no';
        if (v === 'maybe') worst = 'maybe';
      }
      return worst;
    }
    case 'any': {
      let best: Tri = 'no';
      for (const c of cond.of) {
        const v = evalInAct(c, act);
        if (v === 'yes') return 'yes';
        if (v === 'maybe') best = 'maybe';
      }
      return best;
    }
    case 'not':
      return NEGATE[evalInAct(cond.of, act)];
    default:
      return 'maybe';
  }
}

/** A conjunction of gates is possible in `act` unless one of them is provably false. */
const possibleIn = (conds: readonly (Condition | undefined)[], act: number): boolean =>
  conds.every((c) => evalInAct(c, act) !== 'no');

/** Does this condition tree constrain the act at all? Used to spot act-gated content. */
function mentionsAct(cond: Condition | undefined): boolean {
  for (const k of walkConditions(cond)) if (k.kind === 'act') return true;
  return false;
}

/** An effect together with the `if`-conditions that guard it in its own tree. */
interface GuardedEffect {
  effect: Effect;
  where: string;
  guards: (Condition | undefined)[];
}

/**
 * Like `walkEffects`, but carries the enclosing `if` conditions down with each
 * effect. Reachability has to know *when* a `goto` fires, not merely that the
 * scene mentions one somewhere — a `goto` buried in an `inAct(3)` branch is not
 * an exit in Act V.
 */
function* walkGuarded(
  effects: Effect[] | undefined,
  where: string,
  guards: (Condition | undefined)[] = [],
): Generator<GuardedEffect> {
  if (!effects) return;
  for (const [i, e] of effects.entries()) {
    const at = `${where}[${i}]`;
    yield { effect: e, where: at, guards };
    if (e.kind === 'if') {
      yield* walkGuarded(e.then, `${at}.then`, [...guards, e.cond]);
      yield* walkGuarded(e.else, `${at}.else`, [...guards, { kind: 'not', of: e.cond }]);
    } else if (e.kind === 'sequence') {
      yield* walkGuarded(e.of, `${at}.of`, guards);
    }
  }
}

/**
 * Where a block of effects lives. Scene-owned effects run in a known room;
 * puzzle and dialogue effects run wherever the player opened the puzzle or
 * started the conversation, which has to be resolved by a fixpoint below.
 */
type SiteOwner =
  | { kind: 'scene'; scene: string }
  | { kind: 'puzzle'; puzzle: string }
  | { kind: 'dialogue'; character: string };

interface Site {
  where: string;
  effects: Effect[];
  /** Conditions that must hold for this block to be able to run at all. */
  gate: (Condition | undefined)[];
  owner: SiteOwner;
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

  // =========================================================================
  // ACT-AWARE REACHABILITY
  //
  // The checks above prove that every id resolves and that every room has an
  // exit. That is not enough, and shipping proved it: a room can have a
  // perfectly good exit that is only visible in Act III, and an act can open
  // with the player standing somewhere that exit cannot be reached from. The
  // graph then looks healthy to a link-checker and is unplayable to a person.
  //
  // Everything below models the one fact that is knowable without running the
  // game — which act the player is in — and asks the questions a playtester
  // would ask: can I get there, can I get back, and can I still pick up the
  // thing the endgame is going to ask me for.
  // =========================================================================

  const actNumbers = [...new Set(c.acts.map((a) => a.number))].sort((x, y) => x - y);
  const lastAct = actNumbers[actNumbers.length - 1];

  // -- effect sites ---------------------------------------------------------
  // Every block of effects in the content, tagged with what has to be true for
  // it to run and with the room the player is standing in when it does.

  const sites: Site[] = [];

  for (const scene of Object.values(c.scenes)) {
    const owner: SiteOwner = { kind: 'scene', scene: scene.id };
    const base: (Condition | undefined)[] = [scene.enterIf];
    const push = (effects: Effect[] | undefined, where: string, gate: (Condition | undefined)[]) => {
      if (effects && effects.length) sites.push({ where, effects, gate, owner });
    };
    push(scene.onEnter, `scene:${scene.id}.onEnter`, base);
    push(scene.onFirstEnter, `scene:${scene.id}.onFirstEnter`, base);
    for (const hs of scene.hotspots) {
      const tag = `scene:${scene.id}/${hs.id}`;
      const live = [...base, hs.visibleIf, hs.enabledIf];
      push(hs.onInteract, `${tag}.onInteract`, live);
      push(hs.onWrongItem, `${tag}.onWrongItem`, live);
      for (const a of hs.accepts ?? []) {
        push(a.effects, `${tag}.accepts:${a.item}`, [...live, { kind: 'hasItem', item: a.item }]);
      }
      // Blocked effects run precisely when `enabledIf` fails; with no
      // `enabledIf` the hotspot is always enabled and they are dead code.
      push(hs.blockedEffects, `${tag}.blockedEffects`, [
        ...base,
        hs.visibleIf,
        hs.enabledIf ? { kind: 'not', of: hs.enabledIf } : { kind: 'never' },
      ]);
    }
  }

  for (const p of Object.values(c.puzzles)) {
    if (p.onSolve.length) {
      sites.push({
        where: `puzzle:${p.id}.onSolve`,
        effects: p.onSolve,
        gate: [],
        owner: { kind: 'puzzle', puzzle: p.id },
      });
    }
  }

  for (const tree of c.dialogue) {
    const owner: SiteOwner = { kind: 'dialogue', character: tree.characterId };
    // `game.talk` only offers a tree once the act has caught up with it.
    const treeGate: (Condition | undefined)[] = [
      tree.availableIf,
      { kind: 'act', min: tree.act },
    ];
    const walkNodes = (nodes: DialogueNode[], prefix: string, gate: (Condition | undefined)[]) => {
      for (const n of nodes) {
        const at = `${prefix}/${n.id}`;
        const nodeGate = [...gate, n.availableIf];
        if (n.effects && n.effects.length) {
          sites.push({ where: `${at}.effects`, effects: n.effects, gate: nodeGate, owner });
        }
        if (n.children) walkNodes(n.children, at, nodeGate);
      }
    };
    walkNodes(tree.nodes, `dialogue:${tree.characterId}@act${tree.act}`, treeGate);
  }

  // -- host resolution ------------------------------------------------------
  // A puzzle's reward and a dialogue node's effects happen in whatever room the
  // player opened them from. Resolve that by fixpoint, because a puzzle can be
  // opened from a conversation and a conversation can be started by a puzzle.

  const puzzleHosts = new Map<string, Set<string>>();
  const dialogueHosts = new Map<string, Set<string>>();

  const hostsOf = (owner: SiteOwner): Set<string> => {
    if (owner.kind === 'scene') return new Set([owner.scene]);
    if (owner.kind === 'puzzle') return puzzleHosts.get(owner.puzzle) ?? new Set();
    return dialogueHosts.get(owner.character) ?? new Set();
  };

  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const add = (map: Map<string, Set<string>>, key: string, scenesToAdd: Set<string>) => {
      let set = map.get(key);
      if (!set) map.set(key, (set = new Set()));
      for (const s of scenesToAdd) {
        if (!set.has(s)) {
          set.add(s);
          changed = true;
        }
      }
    };
    for (const site of sites) {
      const hosts = hostsOf(site.owner);
      if (!hosts.size) continue;
      for (const { effect } of walkGuarded(site.effects, site.where)) {
        if (effect.kind === 'openPuzzle') add(puzzleHosts, effect.puzzle, hosts);
        else if (effect.kind === 'talk') add(dialogueHosts, effect.character, hosts);
      }
    }
    if (!changed) break;
  }

  // -- per-act navigation graph --------------------------------------------

  /** Scene -> scenes the player can walk to, using only edges live in `act`. */
  const edgesInAct = (act: number): Map<string, Set<string>> => {
    const out = new Map<string, Set<string>>();
    for (const site of sites) {
      if (!possibleIn(site.gate, act)) continue;
      const hosts = hostsOf(site.owner);
      if (!hosts.size) continue;
      for (const { effect, guards } of walkGuarded(site.effects, site.where)) {
        if (effect.kind !== 'goto') continue;
        if (!possibleIn(guards, act)) continue;
        const dest = c.scenes[effect.scene];
        // A scene whose `enterIf` cannot hold in this act is not an edge.
        if (!dest || evalInAct(dest.enterIf, act) === 'no') continue;
        for (const h of hosts) {
          let set = out.get(h);
          if (!set) out.set(h, (set = new Set()));
          set.add(effect.scene);
        }
      }
    }
    return out;
  };

  const closure = (edges: Map<string, Set<string>>, from: Iterable<string>): Set<string> => {
    const seen = new Set<string>();
    const queue = [...from];
    for (const s of queue) seen.add(s);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of edges.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };

  /** Sites that raise the act to exactly `act`, i.e. the doors into it. */
  const entriesTo = (act: number) => sites.filter((s) =>
    [...walkGuarded(s.effects, s.where)].some(
      ({ effect }) => effect.kind === 'setAct' && effect.act === act,
    ),
  );

  const actEdges = new Map<number, Map<string, Set<string>>>();
  const actReach = new Map<number, Set<string>>();
  /** Where the player is standing the moment each act begins. */
  const actEntry = new Map<number, Set<string>>();
  const actEntryIsFallback = new Set<number>();

  for (const act of actNumbers) {
    const edges = edgesInAct(act);
    actEdges.set(act, edges);

    const entry = new Set<string>();
    if (act === actNumbers[0]) {
      entry.add(c.startScene);
    } else {
      for (const site of entriesTo(act)) {
        const hosts = hostsOf(site.owner);
        // Which earlier act could actually have triggered this turn?
        const triggerable = actNumbers.some(
          (prev) =>
            prev < act &&
            possibleIn(site.gate, prev) &&
            [...hosts].some((h) => actReach.get(prev)?.has(h)),
        );
        if (!triggerable) continue;
        for (const h of hosts) entry.add(h);
        // An act turn often moves the player in the same breath.
        for (const { effect, guards } of walkGuarded(site.effects, site.where)) {
          if (effect.kind === 'goto' && possibleIn(guards, act)) entry.add(effect.scene);
        }
      }
    }
    if (!entry.size) {
      // Nothing provably opens this act. Fall back to every scene that even
      // mentions the turn, so one unreachable act gate does not cascade into
      // "every room in Act N is unreachable" and drown the real finding.
      actEntryIsFallback.add(act);
      for (const site of entriesTo(act)) for (const h of hostsOf(site.owner)) entry.add(h);
      if (!entry.size) entry.add(c.startScene);
    }
    actEntry.set(act, entry);
    actReach.set(act, closure(edges, entry));
  }

  const reachIn = (act: number) => actReach.get(act) ?? new Set<string>();
  const actsReaching = (scene: string) => actNumbers.filter((a) => reachIn(a).has(scene));

  // -- CHECK 1: act-gated content that is stranded in its own act -----------
  //
  // Prevents: content authored for an act the player can never be in that room
  // for. Act V dressing on a mainland cottage that Act V has no route to reads
  // as finished work in the source and is invisible in the game.
  //
  // Only fires when the gate is satisfiable in *no* act where the room is
  // reachable, so content gated `inAct(3)` in a room reachable from Act III on
  // is silent.

  const gateReport = (
    scene: Scene,
    where: string,
    what: string,
    liveActs: number[],
  ) => {
    const reachable = actsReaching(scene.id);
    if (!liveActs.length) {
      warn(where, `${what} is gated on no act at all — it can never appear`);
      return;
    }
    // A gate true in every act is not act-gated; the existing unreachable-scene
    // warning already covers a room nothing navigates to.
    if (liveActs.length === actNumbers.length) return;
    if (liveActs.some((a) => reachable.includes(a))) return;
    err(
      where,
      `${what} is live only in act${liveActs.length > 1 ? 's' : ''} ${liveActs.join(', ')}, ` +
        `but "${scene.id}" is reachable only in ${
          reachable.length ? `act${reachable.length > 1 ? 's' : ''} ${reachable.join(', ')}` : 'no act'
        } — the content can never be seen`,
    );
  };

  for (const scene of Object.values(c.scenes)) {
    for (const hs of scene.hotspots) {
      const live = actNumbers.filter((a) => possibleIn([hs.visibleIf, hs.enabledIf], a));
      if (hs.visibleIf || hs.enabledIf) {
        gateReport(scene, `scene:${scene.id}/${hs.id}`, `hotspot "${hs.label}"`, live);
      }
    }
    for (const layer of scene.layers ?? []) {
      const live = actNumbers.filter((a) => possibleIn([layer.visibleIf], a));
      gateReport(scene, `scene:${scene.id}/layer:${layer.id}`, `layer "${layer.id}"`, live);
    }
  }

  // Effects gated on an act inside a room that act cannot reach: same bug, one
  // level down (a clue only granted `inAct(5)` in an Act-V-unreachable room).
  for (const site of sites) {
    if (site.owner.kind !== 'scene') continue;
    const scene = c.scenes[site.owner.scene];
    if (!scene) continue;
    for (const { effect, where, guards } of walkGuarded(site.effects, site.where)) {
      if (effect.kind !== 'if' || !mentionsAct(effect.cond)) continue;
      const live = actNumbers.filter((a) => possibleIn([...site.gate, ...guards, effect.cond], a));
      gateReport(scene, `${where}.then`, 'act-gated branch', live);
    }
  }

  // -- grant / requirement index -------------------------------------------

  interface Grant {
    id: string;
    kind: 'item' | 'clue';
    hosts: Set<string>;
    conds: (Condition | undefined)[];
    where: string;
  }
  const grants: Grant[] = [];
  for (const site of sites) {
    const hosts = hostsOf(site.owner);
    for (const { effect, where, guards } of walkGuarded(site.effects, site.where)) {
      if (effect.kind === 'giveItem') {
        grants.push({ id: effect.item, kind: 'item', hosts, conds: [...site.gate, ...guards], where });
      } else if (effect.kind === 'giveClue') {
        grants.push({ id: effect.clue, kind: 'clue', hosts, conds: [...site.gate, ...guards], where });
      }
    }
  }

  /** Items that appear out of a combination are obtainable without a room; skip them. */
  const combinedItems = new Set<string>();
  for (const item of Object.values(c.items)) {
    for (const combo of item.combinesWith ?? []) combinedItems.add(combo.produces);
  }

  /** Can `id` still be picked up in `act`, restricted to `within` if given? */
  const grantableIn = (id: string, act: number, within?: Set<string>): boolean => {
    const reachable = reachIn(act);
    return grants.some(
      (g) =>
        g.id === id &&
        possibleIn(g.conds, act) &&
        [...g.hosts].some((h) => reachable.has(h) && (!within || within.has(h))),
    );
  };

  // Everything the content ever *demands* the player be holding or know. A
  // `lacksItem` is not a demand — it is satisfied by not having the thing.
  const requiredIds = new Set<string>();
  const noteRequirements = (cond: Condition | undefined) => {
    for (const k of walkConditions(cond)) {
      if (k.kind === 'hasItem') requiredIds.add(k.item);
      else if (k.kind === 'hasClue') requiredIds.add(k.clue);
    }
  };
  for (const scene of Object.values(c.scenes)) {
    noteRequirements(scene.enterIf);
    for (const layer of scene.layers ?? []) noteRequirements(layer.visibleIf);
    for (const hs of scene.hotspots) {
      noteRequirements(hs.visibleIf);
      noteRequirements(hs.enabledIf);
      // An `accepts` entry is a requirement by construction: the interaction
      // exists only for the player who is carrying that item.
      for (const a of hs.accepts ?? []) requiredIds.add(a.item);
    }
  }
  for (const tree of c.dialogue) {
    noteRequirements(tree.availableIf);
    const walkNodes = (nodes: DialogueNode[]) => {
      for (const n of nodes) {
        noteRequirements(n.availableIf);
        if (n.children) walkNodes(n.children);
      }
    };
    walkNodes(tree.nodes);
  }
  for (const site of sites) {
    for (const { effect } of walkGuarded(site.effects, site.where)) {
      if (effect.kind === 'if') noteRequirements(effect.cond);
    }
  }
  for (const item of Object.values(c.items)) {
    for (const combo of item.combinesWith ?? []) requiredIds.add(combo.item);
  }

  /** One report per piece of evidence, whichever check notices it first. */
  const strandedReported = new Set<string>();

  // -- CHECK 2: one-way edges that leave required evidence behind -----------
  //
  // Prevents: the "she crosses back and the bridge goes under" bug. A door that
  // only opens outwards is fine until the room behind it is the only place a
  // required document exists — and the player, who cannot see the graph, walks
  // through it because walking forward is what players do.
  //
  // Only edges that are one-way *within a single act* are considered, and only
  // evidence that nothing on the far side (in this act or any later one) can
  // still hand over.

  for (const act of actNumbers) {
    const edges = actEdges.get(act)!;
    const reachable = reachIn(act);
    const forwardMemo = new Map<string, Set<string>>();
    const forward = (s: string) => {
      let f = forwardMemo.get(s);
      if (!f) forwardMemo.set(s, (f = closure(edges, [s])));
      return f;
    };

    for (const from of reachable) {
      for (const to of edges.get(from) ?? []) {
        if (!reachable.has(to)) continue;
        if (from === to) continue;
        // Can she come back? If so this edge strands nothing.
        if (forward(to).has(from)) continue;

        const stranded = [...forward(from)].filter((s) => !forward(to).has(s));
        if (!stranded.length) continue;
        const strandedSet = new Set(stranded);
        const stillOpen = forward(to);

        for (const g of grants) {
          if (!requiredIds.has(g.id)) continue;
          if (combinedItems.has(g.id)) continue;
          if (strandedReported.has(g.id)) continue;
          if (!possibleIn(g.conds, act)) continue;
          if (![...g.hosts].some((h) => strandedSet.has(h))) continue;

          const recoverable =
            grantableIn(g.id, act, stillOpen) ||
            actNumbers.some((later) => later > act && grantableIn(g.id, later));
          if (recoverable) continue;

          strandedReported.add(g.id);
          err(
            `scene:${from}/->${to}`,
            `one-way in act ${act}: crossing to "${to}" strands ${[...strandedSet].join(', ')}, ` +
              `and ${g.kind} "${g.id}" is required later but can be obtained nowhere else ` +
              `(granted at ${g.where})`,
          );
        }
      }
    }
  }

  // -- CHECK 3: required evidence that stops being obtainable ---------------
  //
  // Prevents: the slow soft-lock. The player is not blocked at the moment the
  // evidence becomes unobtainable — they are blocked two acts later, at the
  // door it was the key to, with no way back and a save file that has been
  // overwritten twenty times since.

  for (const id of requiredIds) {
    if (strandedReported.has(id)) continue;
    if (combinedItems.has(id)) continue;
    const kind = id in c.items ? 'item' : id in c.clues ? 'clue' : null;
    if (!kind) continue; // unknown ids are already reported by the id checks

    const grantActs = actNumbers.filter((a) => grantableIn(id, a));
    if (!grantActs.length) {
      // Nothing in the whole game can hand this over in a reachable room.
      const anyGrant = grants.some((g) => g.id === id);
      err(
        `${kind}:${id}`,
        anyGrant
          ? 'required by a condition, but every scene that grants it is unreachable in every act'
          : 'required by a condition, but nothing ever grants it',
      );
      strandedReported.add(id);
      continue;
    }

    const lastGrantAct = grantActs[grantActs.length - 1];
    if (lastGrantAct >= lastAct) continue; // still obtainable at the end: nothing to strand

    // Is it still being asked for after the last act that could supply it?
    const askedAfter: string[] = [];
    const askIn = (cond: Condition | undefined, gate: (Condition | undefined)[], where: string) => {
      if (!cond) return;
      let asks = false;
      for (const k of walkConditions(cond)) {
        if ((k.kind === 'hasItem' && k.item === id) || (k.kind === 'hasClue' && k.clue === id)) {
          asks = true;
        }
      }
      if (!asks) return;
      const live = actNumbers.some((a) => a > lastGrantAct && possibleIn([...gate, cond], a));
      if (live) askedAfter.push(where);
    };

    for (const scene of Object.values(c.scenes)) {
      const reachableLate = actNumbers.some(
        (a) => a > lastGrantAct && reachIn(a).has(scene.id),
      );
      if (!reachableLate) continue;
      for (const hs of scene.hotspots) {
        askIn(hs.visibleIf, [scene.enterIf], `scene:${scene.id}/${hs.id}.visibleIf`);
        askIn(hs.enabledIf, [scene.enterIf], `scene:${scene.id}/${hs.id}.enabledIf`);
        for (const a of hs.accepts ?? []) {
          if (a.item !== id) continue;
          if (actNumbers.some((n) => n > lastGrantAct && possibleIn([scene.enterIf, hs.visibleIf, hs.enabledIf], n))) {
            askedAfter.push(`scene:${scene.id}/${hs.id}.accepts:${id}`);
          }
        }
      }
    }
    for (const site of sites) {
      const hosts = hostsOf(site.owner);
      const reachableLate = actNumbers.some(
        (a) => a > lastGrantAct && [...hosts].some((h) => reachIn(a).has(h)),
      );
      if (!reachableLate) continue;
      for (const { effect, where, guards } of walkGuarded(site.effects, site.where)) {
        if (effect.kind === 'if') askIn(effect.cond, [...site.gate, ...guards], where);
      }
    }
    for (const tree of c.dialogue) {
      const where = `dialogue:${tree.characterId}@act${tree.act}`;
      const treeGate: (Condition | undefined)[] = [tree.availableIf, { kind: 'act', min: tree.act }];
      askIn(tree.availableIf, treeGate, `${where}.availableIf`);
      const walkNodes = (nodes: DialogueNode[], prefix: string) => {
        for (const n of nodes) {
          askIn(n.availableIf, treeGate, `${prefix}/${n.id}.availableIf`);
          if (n.children) walkNodes(n.children, `${prefix}/${n.id}`);
        }
      };
      walkNodes(tree.nodes, where);
    }

    if (askedAfter.length) {
      strandedReported.add(id);
      err(
        `${kind}:${id}`,
        `last obtainable in act ${lastGrantAct} (granted only in ${[
          ...new Set(grants.filter((g) => g.id === id).flatMap((g) => [...g.hosts])),
        ].join(', ')}), but still required after that at ${askedAfter
          .slice(0, 3)
          .join(', ')}${askedAfter.length > 3 ? ` (+${askedAfter.length - 3} more)` : ''}`,
      );
    }
  }

  // -- CHECK 4: every act must contain its own exit -------------------------
  //
  // Prevents: the story stopping. An act whose only `setAct` sits in a room
  // that act cannot reach is a dead end that no amount of exploring will open,
  // and it looks identical from the outside to a player who has missed a clue.

  for (const act of actNumbers) {
    if (act === lastAct) continue;
    const reachable = reachIn(act);
    const doors = sites.filter((s) => {
      if (!possibleIn(s.gate, act)) return false;
      const hosts = hostsOf(s.owner);
      if (![...hosts].some((h) => reachable.has(h))) return false;
      return [...walkGuarded(s.effects, s.where)].some(
        ({ effect, guards }) =>
          effect.kind === 'setAct' && effect.act > act && possibleIn([...s.gate, ...guards], act),
      );
    });
    if (!doors.length) {
      err(
        `act:${act}`,
        `no reachable effect advances past act ${act} — the player can explore ` +
          `${reachable.size} scene(s) and the story cannot continue`,
      );
    }
  }

  // Surfaced as a warning because the fallback above kept the act analysable;
  // the real finding will be a check-4 error on the preceding act.
  for (const act of actEntryIsFallback) {
    warn(
      `act:${act}`,
      'no reachable act turn leads into this act — its reachability was analysed ' +
        'from an assumed starting room',
    );
  }

  DEBUG.actReach = Object.fromEntries([...actReach].map(([k, v]) => [k, [...v].sort()]));
  DEBUG.actEntry = Object.fromEntries([...actEntry].map(([k, v]) => [k, [...v].sort()]));
  DEBUG.actEdges = Object.fromEntries(
    [...actEdges].map(([k, v]) => [k, Object.fromEntries([...v].map(([a, b]) => [a, [...b].sort()]))]),
  );
  DEBUG.grants = grants.map((g) => ({ id: g.id, kind: g.kind, hosts: [...g.hosts], where: g.where }));
  DEBUG.required = [...requiredIds].sort();
  DEBUG.puzzleHosts = Object.fromEntries([...puzzleHosts].map(([k, v]) => [k, [...v]]));
  DEBUG.dialogueHosts = Object.fromEntries([...dialogueHosts].map(([k, v]) => [k, [...v]]));
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
