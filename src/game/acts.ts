/**
 * Act definitions and the game's entry points.
 *
 * Five acts, nine days: Monday 26 October to Tuesday 3 November 1998. The act
 * titles, goals and gates come from the story bible; the epigraph is the line
 * printed on the act title card, and is the only authorial voice in the game.
 *
 * `GAME_TITLE` matches the boot screen in `index.html` and the title-screen
 * key art. The lamplight is a dead beacon nine miles offshore; the cipher is
 * two millimetres of 2H pencil beside a dead man's signature.
 */

import type { Act } from '@/engine/types';

export const GAME_TITLE = 'The Lamplight Cipher';

/**
 * The crossing from Rossport. Twenty minutes out, spray has got into Wren's
 * satchel and fused two leaves of her own commission, and no plot lands until
 * she has separated them by hand.
 */
export const START_SCENE = 'the-ardent';

/**
 * Cold open: the letter of 11 September, the ferry, the headland coming out of
 * the rain. Authored in `src/game/cinematics.ts` under this id.
 */
export const OPENING_CINEMATIC: string | undefined = 'cin-opening';

export const acts: Act[] = [
  {
    number: 1,
    title: 'The Appraisal',
    epigraph:
      'A dead man asked that the papers be read by a stranger. The Conservancy sent a nineteen-year-old with a spatula.',
    goal:
      'Take possession of an archive that does not want you. Learn the slip, the tube, the index and the press; certify series 1/A, 2/C and 9/E; and find out why Cormac Sallow wanted series 14/B read by somebody from outside.',
  },
  {
    number: 2,
    title: 'Series 14/B',
    epigraph:
      'Weeding a file takes an afternoon. Weeding an index takes a fortnight. Nobody ever does the index.',
    goal:
      'Prove the 1974 Nine Bells file was gutted and retyped. Sort the forty-seven cards, derive the seven accession numbers that exist as cards and no longer exist as paper, and set three timelock movements from the hours this building has kept since 1946.',
  },
  {
    number: 3,
    title: 'The Forgery',
    epigraph:
      'She has to destroy the only evidence for the thing she believes, and she has to do it properly.',
    goal:
      'Authenticate the Deakin letter to the letter of the commission and file an honest adverse report, whatever it costs. Then register the three surveys, open the chamber that left the plans in 1975, and put three books on one table.',
  },
  {
    number: 4,
    title: 'Per Procurationem',
    epigraph:
      'On behalf of: two millimetres of pencil, and no rule in a hundred and eighty-seven years requiring anybody to write down whose hand held it.',
    goal:
      'Give the hand a name. Sort forty-eight signatures drawn from four custodies, fix the boundary dates unaided, cite three independent proofs of incapacity — and get the keeper’s log off the rock before the sea closes the landing.',
  },
  {
    number: 5,
    title: 'The Nine Bells',
    epigraph: 'Nothing you were told. Only what you can hold up to a window.',
    goal:
      'Build eight links that survive Mr Pargeter, cite every assertion to a document you physically hold, word the referral to what the paper actually proves — and set the character of the light by hand before dark.',
  },
];
