/**
 * Below ground: the strongroom, the undercroft and the room that was not there.
 *
 * The three coldest interiors in the game and the only ones with water in
 * them. Everything down here is about what survives: a deed box two inches
 * above a waterline, a wall nine courses thick, and a machine that has been
 * telling the truth to nobody since 1908.
 */

import type { Scene, SceneId } from '@/engine/types';
import {
  advanceTo,
  all,
  at,
  clue,
  exit,
  flagged,
  has,
  inAct,
  knows,
  lacks,
  not,
  puzzle,
  set,
  solved,
  sound,
  take,
  tell,
  think,
  unsolved,
  when,
} from './util';

export const vaultScenes: Record<SceneId, Scene> = {
  // -------------------------------------------------------------------------
  strongroom: {
    id: 'strongroom',
    name: 'The Strongroom',
    subtitle: 'Series 14/B, bottom shelf',
    background: './art/scenes/strongroom.webp',
    weather: 'none',
    ambience: 'cellar-drip',
    enterIf: all(inAct(2), solved('puz-three-movements')),
    grade: 'saturate(0.8) brightness(0.96)',
    layers: [
      {
        id: 'flood',
        src: './art/scenes/strongroom-flood.webp',
        visibleIf: all(inAct(2, 2), unsolved('puz-bottom-shelf')),
        animate: 'drift',
      },
    ],
    onFirstEnter: [
      think(
        'Barrel-vaulted granite, one caged bulb, and steel racking to the springing of the vault.',
        'It smells of iron and cold stone and old string, and there is no reverberation at all, which is the strangest thing about it.',
      ),
    ],
    onEnter: [
      when(all(inAct(2), solved('puz-bottom-shelf'), knows('clue-deed-box-flimsy')), [advanceTo(3)]),
    ],
    hotspots: [
      {
        id: 'timelock',
        label: 'Chubb three-movement timelock',
        shape: at(0.02, 0.2, 0.2, 0.6),
        cursor: 'look',
        onInteract: [
          when(
            all(inAct(2, 2), unsolved('puz-bottom-shelf')),
            [
              sound('lock-refuse'),
              think(
                'Eighteen twenty. The door has swung to behind me and the three movements are running the other way now, and they will not release until seven in the morning.',
                'One. There is no keyhole. Two. There is nobody in the building. Three. Panicking is a use of forty minutes and I have not got forty minutes to spare.',
              ),
            ],
            [
              think(
                'Three brass movements behind a glazed plate in the inner face, ticking at slightly different rates, as they have since 1911.',
                'It cannot be picked, drilled or argued with. It can only be told the truth about what hours this building keeps.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'deed-box',
        label: 'Japanned deed box: A. FERRIER, WARDEN',
        shape: at(0.6, 0.56, 0.2, 0.18),
        cursor: 'take',
        huntable: true,
        onInteract: [
          when(
            lacks('flimsy-page-two'),
            [
              sound('drawer-open'),
              tell(
                'Empty, except for a quarter-inch of paper dust, a dead moth, and one sheet of blue-black flimsy pressed flat against the bottom by its own weight.',
                '“… until oil supply is restored and the No. 2 vaporiser renewed. Masters are advised to give the reef a berth of not less than two miles.” Page 2 of 2.',
              ),
              take('flimsy-page-two'),
              clue('clue-deed-box-flimsy'),
              think(
                'Page two. Page one is ash on my bench four floors up.',
                'It has been in a locked box in a locked vault behind a timelock for twenty-four years, two inches above the waterline, and nobody has opened it since the man whose name is on the lid stopped being able to hold a pen.',
              ),
            ],
            [
              when(
                lacks('naismiths-bank-letter'),
                [
                  take('naismiths-bank-letter'),
                  clue('clue-bank-refusal'),
                  tell(
                    'NAISMITH’S BANK, 15 August 1974. Dear Sir, We are unable to extend further facility to the Authority beyond the current quarter …',
                  ),
                  think(
                    'Underneath the flimsy, flat to the tin. Four months from insolvency, in a bank manager’s own handwriting, dated four days after a man collapsed at his desk.',
                  ),
                ],
                [think('Japanned tin, stencilled in white, and lighter than it has any right to be.')],
              ),
            ],
          ),
        ],
      },
      {
        id: 'box-17',
        label: 'Series 14/B box 17',
        shape: at(0.38, 0.5, 0.18, 0.16),
        cursor: 'look',
        onInteract: [
          when(
            inAct(4),
            [
              clue('clue-box17-relabel'),
              think(
                'The label is typed on the Imperial 66 at full a-occlusion, which is 1998 and not 1989.',
                'Requisitioned on the fourteenth of September, with no return entry anywhere in the issue register. A box came home that was never sent home, because it never left the building; it went up to a gallery and came back down without a slip.',
                'Seventeen items in it. The 1989 reboxing schedule says twenty-three.',
              ),
            ],
            [
              think(
                'Bottom shelf, third from the end. New label, old box, and a tide-line of dust where an older label was scraped off.',
                'Sallow asked for this box at ten past nine in the morning and was dead by four.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'bottom-shelf',
        label: 'The bottom shelf, 1974',
        shape: at(0.26, 0.66, 0.34, 0.2),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            all(inAct(2, 2), unsolved('puz-bottom-shelf')),
            [
              think(
                'Water under the door and over the flags, an inch above the sole of my shoe already, and a torch with a filament going orange.',
                'One. Which of these exists anywhere else. Two. Nothing else matters.',
              ),
              puzzle('puz-bottom-shelf'),
            ],
            [
              think(
                'Twenty-four boxes on the bottom shelf and the tide-lines still on them at three inches.',
                'What I got onto the top shelf is legible. What I did not is going to cost me a citation at a time, in a room with a red pencil in it.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'vent-grille',
        label: 'Ventilation grille',
        shape: at(0.78, 0.14, 0.14, 0.14),
        cursor: 'look',
        onInteract: [
          when(
            all(inAct(2, 2), solved('puz-bottom-shelf')),
            [
              tell(
                '“… forty-seven of them, and I did it with my own hands …”',
                '“… he was in the chair, he could not hold a pen, you know that better than anybody …”',
                '“… you were never even there, that is the whole of it, you were never there …”',
                'And then, for a long time, somebody crying.',
              ),
              think(
                'Two women, forty feet up a galvanised trunk, at about half past midnight, and I am in four inches of water writing down the words I am sure of.',
                'I will not put a name in the speaker column. I want to. I am not going to, because I do not know, and a certainty I have not got is the one thing that gets struck out loud in front of everybody.',
              ),
            ],
            [
              think(
                'A grille at the springing of the vault with a duct behind it going straight up through forty feet of granite to the Wardens’ Hall landing.',
                'Somebody could stand up there and be heard down here, and would never once think of it.',
              ),
            ],
          ),
        ],
      },
      exit('vault-door', 'Out through the vault door', at(0.02, 0.8, 0.24, 0.2), 'long-registry', {
        cursor: 'walk-back',
        enabledIf: not(all(inAct(2, 2), unsolved('puz-bottom-shelf'))),
        blockedEffects: [
          sound('lock-refuse'),
          think('Eleven inches of steel and three clockwork movements. Seven o’clock. Not before.'),
        ],
        before: [
          when(all(inAct(2), solved('puz-bottom-shelf'), knows('clue-deed-box-flimsy')), [
            think(
              'Seven o’clock, and the door goes back, and Sabine Ferrier-Kyne is standing in the Long Registry with a towel, a cup of tea and a written apology for the state of the building.',
              'I cannot tell whether I am being helped or handled. I am not going to be able to tell for three more days.',
            ),
            advanceTo(3),
          ]),
        ],
      }),
    ],
  },

  // -------------------------------------------------------------------------
  undercroft: {
    id: 'undercroft',
    name: 'The Undercroft',
    subtitle: 'Brick vaults under the north end',
    background: './art/scenes/undercroft.webp',
    weather: 'none',
    ambience: 'cellar-drip',
    enterIf: inAct(2),
    layers: [
      {
        id: 'dark',
        src: './art/scenes/undercroft-dark.webp',
        visibleIf: flagged('undercroft-dark'),
      },
      {
        id: 'breach',
        src: './art/scenes/undercroft-breach.webp',
        visibleIf: solved('puz-tide-room'),
      },
    ],
    onFirstEnter: [
      think(
        'Soft red brick, salt bloom flowering white across the limewash, and one bulb on a flex that swings when the door opens and moves every shadow in the room.',
        'And a blind wall filling a Portland stone opening, which is an arch that was built to be an arch.',
      ),
    ],
    hotspots: [
      {
        id: 'blind-north-wall',
        label: 'The blind north wall',
        shape: at(0.34, 0.28, 0.32, 0.44),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            solved('puz-tide-room'),
            [think('Nine courses out, stacked against the pier, and a black gap breathing cold air at me.')],
            [
              when(
                all(inAct(3), has('crowbar'), knows('clue-chart-overlays')),
                [
                  think(
                    'Nine courses of brick in a Portland stone opening, in cement twenty-three years younger than the wall it is sitting in.',
                    'Works Order 75/188, June 1975, seal chamber, damp, initialled p.p. The wreck was November 1974.',
                    'That is not damp. That is a decision, and I have a crowbar off Sandbach’s deck and no legal authority whatsoever.',
                  ),
                  puzzle('puz-tide-room'),
                ],
                [
                  think(
                    'Brick where brick has no business being: a Portland stone arch, dressed and moulded, filled flush with nine courses of common stock.',
                    'The mortar is pale and hard and the wall around it is soft and yellow. Somebody sealed this, and it was not in 1811.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: 'sump',
        label: 'The sump',
        shape: at(0.4, 0.78, 0.22, 0.16),
        cursor: 'look',
        onInteract: [
          think(
            'An iron grating over a brick pit with eighteen inches of black water in it and a pump that kicks in about every four minutes.',
            'In heavy rain it backs up, and when it backs up the water goes where the floor falls, which is north-east, which is under the strongroom door.',
            'Somebody has known that since at least 1946 and has dealt with it by keeping the interesting boxes on the bottom shelf.',
          ),
        ],
      },
      {
        id: 'mortar-sample',
        label: 'Mortar sample',
        shape: at(0.28, 0.6, 0.12, 0.14),
        cursor: 'take',
        onInteract: [
          when(
            lacks('mortar-sample'),
            [
              take('mortar-sample'),
              think(
                'A thumbnail of cement out of the joint, bagged and labelled, against a sample of the original lime out of the pier four feet away.',
                'One is a soft buff lime with brick dust in it. One is a hard grey Portland cement with a sharp sand. They are not the same century, never mind the same wall.',
              ),
            ],
            [think('Bagged, labelled, and cross-referenced to the fabric survey. Not proof on its own. Nothing is.')],
          ),
        ],
      },
      {
        id: 'bulb-flex',
        label: 'Bare bulb on a flex',
        shape: at(0.5, 0.04, 0.14, 0.16),
        cursor: 'use',
        onInteract: [
          sound('click-soft'),
          when(
            flagged('undercroft-dark'),
            [set('undercroft-dark', false), think('Back on, and swinging, and every shadow in the vault moving with it.')],
            [
              set('undercroft-dark'),
              think(
                'Off. Black as the inside of a box, and the pump running somewhere to the left, and the sea coming through the stone as a sort of pressure rather than a sound.',
                'If anybody comes down those steps I will see the light on the brick before I hear them.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'plan-comparison',
        label: 'Building plan pinned to a joist',
        shape: at(0.72, 0.34, 0.18, 0.2),
        cursor: 'look',
        onInteract: [
          when(
            knows('clue-chart-overlays'),
            [
              think(
                'This plan is dated 1976 and it shows solid ground where the 1948 survey shows a chamber twenty feet by twelve.',
                'Nobody falsified anything. They redrew the plan after the wall went up, from the wall, which is exactly what a draughtsman is supposed to do.',
              ),
            ],
            [
              think(
                'A dyeline plan on a joist, curled and fly-spotted, with the north end drawn as one continuous hatched mass.',
                'It does not agree with the way this room sounds when you knock on it, and I have nothing yet to say so with.',
              ),
            ],
          ),
        ],
      },
      exit('up-to-registry', 'Up to the Long Registry', at(0.02, 0.42, 0.12, 0.4), 'long-registry', {
        cursor: 'walk-left',
      }),
      exit('up-to-courtyard', 'Up the area steps', at(0.86, 0.4, 0.13, 0.4), 'courtyard-and-site-hut', {
        cursor: 'walk-right',
      }),
      exit('into-breach', 'Through the breach', at(0.42, 0.4, 0.16, 0.24), 'tide-room', {
        cursor: 'walk',
        visibleIf: solved('puz-tide-room'),
        before: [think('Cold air, and dust still hanging in it, and a smell of nothing at all.')],
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'tide-room': {
    id: 'tide-room',
    name: 'The Tide Room',
    subtitle: 'Sealed June 1975',
    background: './art/scenes/tide-room.webp',
    weather: 'dust',
    ambience: 'cellar-drip',
    enterIf: all(inAct(3), solved('puz-tide-room')),
    onFirstEnter: [
      think(
        'Twenty-three years of undisturbed air, and the dust from the wall still turning over in the torch beam.',
        'A glass cylinder, a brass clock train, a drum wrapped in smoked paper, and a shelf of sixty-seven more.',
        'Nobody sealed a tide gauge because of damp.',
      ),
    ],
    layers: [
      {
        id: 'running',
        src: './art/scenes/tide-room-marigraph-running.webp',
        visibleIf: solved('puz-tide-room'),
      },
    ],
    hotspots: [
      {
        id: 'marigraph',
        label: 'Kelvin & White stilling-well marigraph',
        shape: at(0.32, 0.24, 0.26, 0.5),
        cursor: 'use',
        huntable: true,
        onInteract: [
          think(
            'Weight hung, drum shipped, paper smoked and mounted, pen inked to the datum, clutch in, clock wound.',
            'And it starts writing the height of the sea in front of me, in a bricked-up room, twenty-three years after somebody decided it had nothing to say.',
            'An instrument that has been stopped proves nothing until it is running. Start it, watch it write, then read the old drums.',
          ),
        ],
      },
      {
        id: 'drum-1974-44',
        label: 'Drum 1974/44',
        shape: at(0.66, 0.44, 0.16, 0.18),
        cursor: 'take',
        onInteract: [
          when(
            lacks('marigraph-drum-44'),
            [
              take('marigraph-drum-44'),
              when(lacks('tide-surge-finding'), [take('tide-surge-finding')]),
              clue('clue-marigraph-drum'),
              tell(
                'Drum 1974/44. Week ending 9 November 1974. At 23.04 on the 3rd the trace stands 1.4 metres above prediction.',
              ),
              think(
                'One point four metres of surge, which nobody measured at the time because this machine was in a room and the room was in the dark.',
                'Four point two metres over the Sowens, not two point eight. The Inquiry’s central assumption is not disputed. It is simply wrong, and it has been wrong in a sealed room for twenty-three years.',
              ),
            ],
            [think('Smoked paper, a fine white line, and a scale in feet with a metric conversion pencilled beside it in 1971.')],
          ),
        ],
      },
      {
        id: 'drum-shelf',
        label: 'Sixty-seven years of smoked drums',
        shape: at(0.78, 0.28, 0.18, 0.36),
        cursor: 'look',
        onInteract: [
          think(
            '1908 to 1975, in order, in their tubes, labelled by year and week in four different hands.',
            'Not one of them has ever been read by anybody. It is the only witness in this entire case with no opinion in its head, and it has been sitting in the dark waiting to be asked since before the Titanic.',
          ),
        ],
      },
      {
        id: 'inquiry-papers',
        label: 'Bundle tied with tape, never accessioned',
        shape: at(0.14, 0.6, 0.2, 0.18),
        cursor: 'take',
        onInteract: [
          when(
            lacks('inquiry-working-papers'),
            [
              take('inquiry-working-papers'),
              tell(
                'ROSSPORT INQUIRY — ASSESSOR’S WORKING PAPERS — RETURNED TO THE AUTHORITY, MARCH 1975. NOT ACCESSIONED.',
              ),
              think(
                'Returned in the March and walled up in the June, and never given an accession number, which is why nobody could ever weed it: you cannot destroy what is not on a list.',
                'The most carelessly kept bundle in this building is the only one that survived intact, and that is going to keep me awake.',
              ),
            ],
            [think('Pink tape, a granite-dust bloom on the top sheet, and the knot still the assessor’s clerk’s knot.')],
          ),
        ],
      },
      {
        id: 'rejects-list',
        label: 'List of Persons Considered and Not Called',
        shape: at(0.14, 0.4, 0.18, 0.16),
        cursor: 'look',
        onInteract: [
          when(lacks('rejects-list'), [take('rejects-list')]),
          clue('clue-inquiry-rejects'),
          tell(
            '29. Mrs O. Verge — wife of relief keeper — no direct knowledge — not called. [a small tick in the margin]',
            '33. Miss S. Ferrier — the Warden’s private secretary — no official capacity — not called.',
          ),
          think(
            'Forty-one names, typed on the Underwood 5 that stands four feet from Mrs Verge’s chair.',
            'No official capacity. Somebody wrote that in 1975 about the person who had been running this Authority eleven months earlier, and it was not a lie, and that is exactly the trouble.',
            'And there is a tick beside number 29 in a hand I have watched make ticks for a week.',
          ),
        ],
      },
      exit('breach', 'Back through the breach', at(0.02, 0.34, 0.12, 0.44), 'undercroft', {
        cursor: 'walk-back',
      }),
    ],
  },
};
