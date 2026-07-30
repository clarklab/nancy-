/**
 * Every conversation in the game, one tree per character per act.
 *
 * The engine picks the tree whose `characterId` matches the person being
 * spoken to and whose `act` matches the current act, so a character's voice
 * can move across the story without the scene knowing anything about it.
 *
 * House rules for this directory:
 *  - Node ids are globally unique and prefixed with the speaker (`sab-`,
 *    `pik-`, `rit-`, `ott-`, `eni-`, `san-`, `bra-`, `ive-`, `hal-`, `sal-`),
 *    because the id is the save key for "already asked".
 *  - Probing topics are gated with `availableIf` on the clue that earns them.
 *    Wren cannot ask about a ribbon spool she has not found.
 *  - Lie traps are one parent node marked `isConfrontation`, whose reply is
 *    only the evasion; the crack lives in a `children` follow-up that the
 *    player has to press for.
 *  - Flags record story state; `trust-*` counters record who is warming to
 *    her, and `sabine-pressure` records how hard the Warden has been pushed.
 */

import type { DialogueTree } from '@/engine/types';

import { sabineTrees } from './sabine';
import { pikeTrees } from './pike';
import { ritaTrees } from './rita';
import { vergeTrees } from './verge';
import { charnockTrees } from './charnock';
import { sandbachTrees } from './sandbach';
import { aylwardTrees } from './aylward';
import { ivesonTrees } from './iveson';
import { halkettTrees } from './halkett';
import { sallowTrees } from './sallow';

export const dialogue: DialogueTree[] = [
  ...sabineTrees,
  ...pikeTrees,
  ...ritaTrees,
  ...vergeTrees,
  ...charnockTrees,
  ...sandbachTrees,
  ...aylwardTrees,
  ...ivesonTrees,
  ...halkettTrees,
  ...sallowTrees,
];

/** Convenience lookup for the engine and for tests. */
export function dialogueFor(characterId: string, act: number): DialogueTree | undefined {
  return dialogue.find((t) => t.characterId === characterId && t.act === act);
}
