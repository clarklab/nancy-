/**
 * Pilotage House: the ground floor and the working rooms.
 *
 * The throat of the building (wicket, hooks, tube head), the stair that
 * connects everything above it, the counter where paper is asked for, the six
 * hundred feet of shelving it comes off, the table Wren works at, and the two
 * service rooms whose machines keep counting whether or not anybody writes the
 * job in the book.
 */

import type { Scene, SceneId } from '@/engine/types';
import {
  advanceTo,
  all,
  any,
  at,
  clue,
  exit,
  flagged,
  goto,
  has,
  inAct,
  knows,
  lacks,
  puzzle,
  say,
  set,
  solved,
  sound,
  speakTo,
  take,
  task,
  tell,
  think,
  unsolved,
  when,
} from './util';

export const pilotageGroundScenes: Record<SceneId, Scene> = {
  // -------------------------------------------------------------------------
  'entrance-hall': {
    id: 'entrance-hall',
    name: 'The Wicket and Entrance Hall',
    subtitle: 'Pilotage House, Brannock Head',
    background: './art/scenes/entrance-hall.webp',
    weather: 'dust',
    ambience: 'clock-room',
    layers: [
      {
        id: 'stripped',
        src: './art/scenes/entrance-hall-stripped.webp',
        visibleIf: inAct(4),
      },
    ],
    onFirstEnter: [
      think(
        'Nine forty in the morning, twenty-sixth of October. Granite, brass and a shaft of north light with the dust standing still in it.',
        'A building that has been keeping other people’s records for a hundred and eighty-seven years, and has five weeks left.',
      ),
      task('certify', 'Certify series 1/A, 2/C and 9/E before 3 November.'),
    ],
    hotspots: [
      {
        id: 'visitors-book',
        label: "The visitors' book",
        shape: at(0.32, 0.52, 0.22, 0.16),
        cursor: 'look',
        huntable: true,
        onInteract: [
          tell(
            'Mon 14 Sept — C. SALLOW — 08.56 — business: series 14/B — admitted by: S.F-K. — out: —',
            'Tue 6 Oct — B. AYLWARD — 10.20 — business: Ministry liaison — admitted by: O.V.',
            'Mon 26 Oct — W. ADARE — 09.40 — business: appraisal under s.41 — admitted by: O.V.',
          ),
          clue('clue-visitors-book'),
          think(
            'Signed in at eight fifty-six and never signed out, because you do not sign out of a building you leave in an ambulance.',
            'And the admitted-by column is initialled S.F-K. Not the chief clerk. Not Mrs Verge, who says she was on the wicket that morning and is quite certain about it.',
          ),
          when(
            inAct(3),
            [
              think(
                'Also: B. AYLWARD, sixth of October, which is a fortnight before he told me he only got here on Tuesday.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'hook-board',
        label: 'The hook board',
        shape: at(0.62, 0.36, 0.16, 0.24),
        cursor: 'take',
        huntable: true,
        onInteract: [
          when(
            all(inAct(3), lacks('strongroom-key')),
            [
              take('strongroom-key'),
              say(
                'Halvard Pike',
                'The strongroom key is on the third hook and I am going to my dinner.',
              ),
              think(
                'My commission was revoked at twenty past four this afternoon. I have no legal right to that key or that door or this hall.',
                'He knows. He said it looking at the ceiling, and left.',
              ),
            ],
          ),
          when(
            all(inAct(4), lacks('beacon-padlock-key')),
            [
              take('beacon-padlock-key'),
              think(
                'Third hook down, at the back: a keeper’s padlock key on a wire ring with a wooden tally, NINE BELLS ENT. DOOR.',
                'It has hung nine miles from its padlock since 1974 and nobody has ever thought that was strange.',
              ),
            ],
          ),
          think(
            'Numbered brass hooks, iron keys, and four of them missing without a tally against them, which in a well-run building means four people are somewhere they said they were not.',
          ),
        ],
      },
      {
        id: 'tube-head',
        label: 'The pneumatic tube head',
        shape: at(0.08, 0.12, 0.2, 0.26),
        cursor: 'use',
        onInteract: [
          when(
            all(inAct(3), lacks('revocation-fax')),
            [
              sound('latch'),
              take('revocation-fax'),
              tell(
                'MINISTRY OF TRANSPORT (MARINE DIVISION), 16.20. To: W. ADARE, appraiser.',
                'A report of forgery having been received in respect of a series under appraisal, your commission under s.41 is revoked with immediate effect pending review. You will surrender your warrant to the Warden.',
              ),
              think(
                'Sixteen twenty. It is timed, it is filed, and the carrier came up the tube with a thump like every other carrier.',
                'One. I am nineteen. Two. I have no authority. Three. Nobody has told me to leave the headland.',
              ),
            ],
            [
              when(
                inAct(2),
                [
                  think(
                    'Brass octopus, seven tubes, and a leather carrier in the cradle with a felt washer worn to nothing.',
                    'White top copy goes up, box comes down. And since Tuesday it has twice come down as the wrong box, which the tube has no opinion about at all.',
                  ),
                ],
                [
                  think(
                    'A brass octopus of seven tubes, polished by hands not by cloths. You put the slip in the carrier, the carrier in the throat, and the building swallows.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: 'aylward',
        label: "Bram Aylward, 'Ministry liaison'",
        shape: at(0.46, 0.24, 0.16, 0.4),
        cursor: 'talk',
        onInteract: [speakTo('bram-aylward')],
      },
      {
        id: 'strip-out-notice',
        label: "Contractor's notice by the door",
        shape: at(0.8, 0.4, 0.14, 0.2),
        cursor: 'look',
        onInteract: [
          tell(
            'SANDBACH & CO. ROOM CLOSURE SCHEDULE. Undercroft nth bays 26 Oct. Chart loft 30 Oct. Rolls room 31 Oct. Strongroom 2 Nov. Access strictly by arrangement.',
          ),
          think(
            'These dates are real. When a room on this list goes, the paper in it goes into a stencilled crate marked LOT 4 and stops being requisitionable, and no amount of warrant fixes that.',
          ),
        ],
      },
      {
        id: 'umbrella-stand',
        label: 'Umbrella stand and wet boots',
        shape: at(0.02, 0.62, 0.14, 0.26),
        cursor: 'look',
        onInteract: [
          think(
            'A man’s brogues, still wet, size eight, laid on newspaper. Sea boots, turned down. A black umbrella, furled properly, dry.',
            'So the chief clerk walked, the boatwoman came up from the slipway, and the Warden arrived by car and left the umbrella furled, which is a thing you only do if you have never once had to run anywhere.',
          ),
        ],
      },
      exit('front-door', 'Out to the cliff path', at(0.0, 0.34, 0.08, 0.5), 'cliff-path-churchyard', {
        cursor: 'walk-left',
      }),
      exit('to-stair', 'The great stair', at(0.86, 0.16, 0.14, 0.46), 'great-stair', {
        cursor: 'walk-right',
      }),
      exit('to-registry', 'The registry counter', at(0.28, 0.28, 0.14, 0.2), 'registry-counter', {
        cursor: 'walk',
      }),
      exit('to-reading-room', 'The reading room', at(0.56, 0.16, 0.1, 0.18), 'reading-room', {
        cursor: 'walk',
      }),
      exit('to-courtyard', 'The courtyard door', at(0.7, 0.62, 0.12, 0.24), 'courtyard-and-site-hut', {
        cursor: 'walk',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'great-stair': {
    id: 'great-stair',
    name: "The Great Stair and Wardens' Hall",
    subtitle: 'Twenty-two portraits of twenty-two men',
    background: './art/scenes/great-stair.webp',
    weather: 'none',
    ambience: 'clock-room',
    onFirstEnter: [
      think(
        'Granite treads worn into hollows, and a first-floor gallery hung with twenty-two dark portraits at eye height.',
        'You cannot get anywhere in this building without walking past all of them.',
      ),
    ],
    hotspots: [
      {
        id: 'ferrier-portrait',
        label: 'Portrait: Absalom Ferrier, Warden 1961–1976',
        shape: at(0.42, 0.24, 0.13, 0.3),
        cursor: 'look',
        huntable: true,
        onInteract: [
          tell('ABSALOM FERRIER, WARDEN 1961–1976. Painted 1972.'),
          when(
            knows('clue-nurse-ledger'),
            [
              think(
                'Sixty-one to seventy-six, on a brass plate, in a building that keeps the closing hour of every working day since 1946.',
                'And for ninety-nine days of it he was in a bed at Brannock House with his right side gone and no speech, and there is no plate anywhere in this country for the person who did the work.',
              ),
            ],
            [
              think(
                'Heavy face, heavy hands, a signet ring, and the varnish gone the colour of tea. Painted 1972, so this is a man of sixty-one.',
                'I will walk past this forty times before it means anything to me.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'portrait-row',
        label: 'Twenty-two Wardens',
        shape: at(0.16, 0.22, 0.24, 0.32),
        cursor: 'look',
        onInteract: [
          think(
            'Twenty-two of them, 1811 to 1991, all against the same near-black ground, all in the same black frames, all men.',
            'Nobody in this building has ever thought of that row as a rule. It is a rule. It is Article 9, framed and hung and dusted twice a year.',
          ),
        ],
      },
      {
        id: 'vent-trunk',
        label: 'Galvanised ventilation trunk',
        shape: at(0.74, 0.08, 0.16, 0.14),
        cursor: 'look',
        onInteract: [
          when(
            knows('clue-deed-box-flimsy'),
            [
              think(
                'Forty feet of duct from this cornice down to the strongroom, and it carries a voice the way a drainpipe carries rain.',
                'Two women stood somewhere near here on Thursday night and tore each other apart, and I was at the bottom of it in four inches of water writing down the words I was sure of.',
              ),
            ],
            [
              think(
                'A galvanised trunk running into the cornice and down through the fabric to the basements. Somebody in 1911 wanted the strongroom to breathe.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'blank-space',
        label: 'The empty hook at the end of the row',
        shape: at(0.58, 0.24, 0.09, 0.26),
        cursor: 'look',
        onInteract: [
          think(
            'A brass picture hook, a clean rectangle of unfaded panelling, and no plate under it.',
            'Warden since 1991 and nobody has commissioned one, and nobody has said why, and I would put money on nobody ever having raised it out loud in a meeting.',
          ),
        ],
      },
      {
        id: 'landing-window',
        label: 'The half-landing window',
        shape: at(0.02, 0.14, 0.13, 0.5),
        cursor: 'look',
        onInteract: [
          when(
            inAct(5),
            [
              think(
                'Hard blue, and cold, and the sea glittering all the way to the horizon like a tray of cutlery.',
                'Third of November. The gale blew itself out over the rock at about four this morning and the day has come up perfectly clear, which is the sort of thing that would be unbearable in a novel.',
              ),
            ],
            [
              when(
                inAct(3),
                [
                  think(
                    'The glass is streaming and the sash is working in its frame. Sixty miles an hour, southwesterly, and the causeway went under an hour early.',
                  ),
                ],
                [
                  think(
                    'Flat grey, no horizon to speak of, and rain that is not falling so much as standing in the air.',
                    'Nine days of weather to go and the whole coast knows exactly which way it is going.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      exit('stair-down', 'Down to the entrance hall', at(0.3, 0.78, 0.4, 0.22), 'entrance-hall', {
        cursor: 'walk-back',
      }),
      exit('stair-up', 'The upper flight', at(0.86, 0.06, 0.13, 0.36), 'chart-loft', {
        cursor: 'walk-right',
        before: [
          think('Up to the attic floor: the chart loft, the old bindery, and a hatch onto the leads.'),
        ],
      }),
      exit('door-wardens-office', "The Warden's office", at(0.36, 0.58, 0.1, 0.2), 'wardens-office', {
        cursor: 'walk',
      }),
      exit('door-board-room', 'The board room', at(0.47, 0.58, 0.1, 0.2), 'board-room', {
        cursor: 'walk',
        visibleIf: inAct(4),
      }),
      exit('door-accounts', 'The accounts office', at(0.58, 0.58, 0.1, 0.2), 'accounts-office', {
        cursor: 'walk',
      }),
      exit('door-rolls-room', 'The rolls room', at(0.69, 0.58, 0.1, 0.2), 'rolls-room', {
        cursor: 'walk',
      }),
      exit('door-muniment', 'The muniment gallery', at(0.8, 0.58, 0.1, 0.2), 'muniment-gallery', {
        cursor: 'walk',
        visibleIf: inAct(2),
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'registry-counter': {
    id: 'registry-counter',
    name: 'The Registry Counter',
    subtitle: 'Slips, stubs and a bell push worn to brass',
    background: './art/scenes/registry-counter.webp',
    weather: 'none',
    ambience: 'quiet-library',
    onFirstEnter: [
      think(
        'Mahogany, brown linoleum, a spike of pink carbons and a bell push polished down to the metal by forty years of thumbs.',
        'Everything in this building has to be asked for here, in writing, in triplicate. Good. I can work with a building like that.',
      ),
    ],
    hotspots: [
      {
        id: 'slip-lesson',
        label: 'Requisition slips and stub book',
        shape: at(0.3, 0.58, 0.22, 0.18),
        cursor: 'look',
        huntable: true,
        onInteract: [
          when(
            lacks('order-book-working-copy'),
            [
              say(
                'Ottoline Verge',
                'White top copy goes up the tube, pink carbon stays in the stub, and you press hard, dear, or the pink comes out grey.',
                'Countersignature box there. If the Warden’s out, her clerk initials it p.p. — per procurationem, on behalf of. We’ve done it since the Ark.',
              ),
              clue('clue-pp-taught'),
              take('order-book-working-copy'),
              think(
                'And a working copy of the Warden’s Order Book to look the closing hours up in, because apparently everybody here knows them and nobody writes them on the slip.',
              ),
            ],
            [
              think(
                'Series, box, date, signature, countersignature. Five boxes, and the fifth one is the whole of this case, and I have filled it in nine times without looking at it.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'standing-order-7',
        label: 'Standing Order 7, printed on the slip back',
        shape: at(0.54, 0.62, 0.16, 0.14),
        cursor: 'look',
        onInteract: [
          tell(
            'S.O.7. Every requisition by a reader not being an officer of the Authority shall pass the Warden’s pigeonhole for countersignature before issue.',
          ),
          when(
            inAct(4),
            [
              clue('clue-substituted-slips'),
              think(
                'Every slip I have written in nine days has been read by her before the box moved. Every one.',
                'She never refused me anything. She granted me everything and steered four things, and the evidence of it is in my own handwriting, in my own casebook, in a column I ruled myself.',
              ),
            ],
            [
              think(
                'Six point type on the back of a form nobody turns over. It is not a secret; it is worse than a secret. It is published.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'pike-grievance',
        label: 'Halvard Pike at the counter',
        shape: at(0.58, 0.28, 0.2, 0.34),
        cursor: 'talk',
        onInteract: [
          when(
            lacks('treasury-tag'),
            [
              say(
                'Halvard Pike',
                'One hand in this building dockets the Ministry way. Outside third, upside down to the tag, so you have to turn the whole file over to read your own file.',
                'Whitehall, 1958. Everybody else does it like a Christian.',
              ),
              clue('clue-docket-fold'),
              think(
                'Four minutes of unprompted contempt about the state of the registry, ending on the fold of a folder.',
                'He will not shake my hand and he has just given me, free, the one thing in this building that identifies a hand without a signature.',
              ),
            ],
            [speakTo('halvard-pike')],
          ),
        ],
      },
      {
        id: 'olivetti',
        label: 'Olivetti Lettera 32',
        shape: at(0.68, 0.52, 0.16, 0.16),
        cursor: 'use',
        onInteract: [
          when(lacks('specimen-sheets'), [take('specimen-sheets')]),
          set('specimen-olivetti'),
          sound('typewriter'),
          think(
            'Specimen line, card 7, all four figures and the full alphabet twice.',
            'Grey doubling on every character from a slack ribbon vibrator, and the lower-case l chipped at the foot. Machine three.',
          ),
        ],
      },
      {
        id: 'stub-book-r982211',
        label: 'Stub book, pink carbons, September 1998',
        shape: at(0.08, 0.5, 0.18, 0.2),
        cursor: 'look',
        onInteract: [
          when(
            inAct(4),
            [
              take('slip-r982211'),
              clue('clue-slip-r982211'),
              tell(
                'R98/2211 — 09.10 — 14.9.98 — C. SALLOW — series 14/B box 17 — issued by: S.F-K.',
              ),
              think(
                'Issued by the Warden, at ten past nine in the morning, because the chief clerk was on the 08.15 ferry and somebody had to work the counter.',
                'She told me she did not know he was in the building until Mrs Verge came running. This is her initial on the slip that let him in.',
                'I read this stub in my first hour here and thought it was nothing at all.',
              ),
            ],
            [
              think(
                'Pink carbons on a spike in date order, pressed hard by somebody who was taught to press hard.',
                'September is near the bottom. Sallow, box 17, ten past nine in the morning, and then nothing after it until the middle of October.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'treasury-tags',
        label: 'Bundle of treasury tags',
        shape: at(0.24, 0.72, 0.14, 0.14),
        cursor: 'take',
        onInteract: [
          when(
            lacks('treasury-tag'),
            [
              take('treasury-tag'),
              think(
                'He squared one off for me without being asked and without looking up: tail under, loop left, flat as a stamp.',
                '“That’s your people’s knot,” he said, and went back to his stamping, and it took me four days to work out that he meant it kindly.',
              ),
            ],
            [think('Tail under, loop left. I have started doing it that way myself.')],
          ),
        ],
      },
      exit('to-hall', 'Back to the entrance hall', at(0.0, 0.4, 0.08, 0.5), 'entrance-hall', {
        cursor: 'walk-back',
      }),
      exit('to-long-registry', 'Into the Long Registry', at(0.88, 0.2, 0.12, 0.4), 'long-registry', {
        cursor: 'walk-right',
      }),
      exit('to-post-room', 'The post room', at(0.42, 0.14, 0.1, 0.18), 'post-room', {
        cursor: 'walk',
      }),
      exit('to-duplicating', 'The duplicating room', at(0.53, 0.14, 0.1, 0.18), 'duplicating-room', {
        cursor: 'walk',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'long-registry': {
    id: 'long-registry',
    name: 'The Long Registry',
    subtitle: 'Six hundred feet of shelving',
    background: './art/scenes/long-registry.webp',
    weather: 'dust',
    ambience: 'quiet-library',
    layers: [
      {
        id: 'lot4',
        src: './art/scenes/long-registry-lot4.webp',
        visibleIf: inAct(3),
      },
    ],
    onFirstEnter: [
      think(
        'Six hundred feet of it, top-lit, with the far end in blue shadow and the dust standing in every clerestory shaft.',
        'A hundred and eighty-seven years of a coast, in oxblood and bottle-green buckram, five weeks from a pulper.',
      ),
    ],
    hotspots: [
      {
        id: 'register-notices-1974',
        label: 'Register of Notices Issued, 1974',
        shape: at(0.3, 0.46, 0.16, 0.2),
        cursor: 'look',
        huntable: true,
        onInteract: [
          when(
            knows('clue-scorched-carbon'),
            [
              tell(
                '74/117 — 2.8.74 — Buoyage, Sowens South Cardinal — issued.',
                '74/118 — 12.8.74 — Pilotage dues, revised scale — issued.',
                '74/120 — 3.9.74 — Cadran Point, fog signal, temporary — issued.',
              ),
              clue('clue-issued-register'),
              think(
                'One hundred and seventeen. One hundred and eighteen. One hundred and twenty.',
                'No 74/119. No cancellation entry, no minute, no ruled line, no explanation, in a register that has not missed a number since 1855.',
                'A warning was written, given a number, run off two hundred and fourteen times — and then it was not issued, and nobody wrote down that it was not issued, and somebody was still trying to burn it at twenty past one on Tuesday morning.',
              ),
              advanceTo(2),
            ],
            [
              think(
                'Every notice this Authority has ever issued, numbered by year, in one hand per decade.',
                'Nothing to look for yet. You do not page a register hoping. You page it with a number.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'inquiry-transcripts',
        label: 'Bound Rossport Inquiry transcripts',
        shape: at(0.5, 0.44, 0.16, 0.2),
        cursor: 'look',
        onInteract: [
          clue('clue-sallow-1975-transcript'),
          tell(
            'DAY 9. Sir Roderick Balgowan: Was the light exhibited on the night of the third of November?',
            'Mr Sallow: The light was not discontinued.',
            'Sir Roderick Balgowan: Thank you. We come to the buoyage.',
          ),
          think(
            'Not discontinued. That is an administrative answer to a question about a physical fact, and it is not a lie, and nobody in that room turned a hair.',
            'He was asked whether a lamp was burning and he answered about a schedule, and then they went on to the buoyage, and a dead pilot has been paying for the difference for twenty-four years.',
          ),
        ],
      },
      {
        id: 'ministry-circulars',
        label: 'Ministry staff circulars',
        shape: at(0.68, 0.44, 0.14, 0.2),
        cursor: 'look',
        visibleIf: inAct(2),
        onInteract: [
          tell(
            'DISSOLUTION LIAISON: officers appointed. Miss K. Fenn. Mr D. Rowe. Mrs P. Achurch. Mr T. Bellis.',
          ),
          think(
            'Four names. Four. He is not on it, and he has a laser-printed identity card in a building where everything else is letterpress or a rubber stamp.',
            'He is lying about exactly one thing, and I do not yet know whether it matters.',
          ),
        ],
      },
      {
        id: 'quinquennial-notice',
        label: 'Quinquennial Review notice, 22 July 1974',
        shape: at(0.16, 0.5, 0.13, 0.18),
        cursor: 'take',
        onInteract: [
          when(
            lacks('quinquennial-review-notice'),
            [
              take('quinquennial-review-notice'),
              clue('clue-ministry-review'),
              tell(
                'MINISTRY OF TRANSPORT, 22 July 1974. Notice of quinquennial review of pilotage authorities.',
                'An authority found upon review to be without an effective Warden shall be abolished, its officers dismissed and its records dispersed.',
              ),
              think(
                'Twenty-second of July 1974. Twenty days before a man had a haemorrhage at that desk upstairs.',
                'Half a motive, sitting in a bound file on an open shelf, where it has been for twenty-four years.',
              ),
            ],
            [think('Two foolscap sheets and a franking mark. Nobody has ever asked for it before.')],
          ),
        ],
      },
      {
        id: 'works-file',
        label: 'Works orders file',
        shape: at(0.78, 0.5, 0.14, 0.18),
        cursor: 'look',
        onInteract: [
          when(
            lacks('works-order-75188'),
            [
              take('works-order-75188'),
              clue('clue-works-order-75188'),
              tell(
                'W/O 75/188. June 1975. North undercroft: seal chamber, damp. Nine courses, cement, Portland surround made good.',
                'Authorised: A. FERRIER. In the corner, in 2H pencil: p.p.',
              ),
              think(
                'June 1975. The wreck was November 1974 and the Inquiry reported in the March.',
                'That is not damp. Damp is a reason you give. That is a decision, and it is the last p.p. anybody ever wrote in this building.',
              ),
            ],
            [think('Buff folders, treasury-tagged, endorsed on the inside edge like a Christian.')],
          ),
        ],
      },
      {
        id: 'lot4-stencils',
        label: 'Shelving stencilled LOT 4',
        shape: at(0.04, 0.36, 0.12, 0.4),
        cursor: 'look',
        onInteract: [
          when(
            inAct(3),
            [
              think(
                'Bays 41 to 58 have gone since Thursday. Stencilled, crated, and stacked in the yard under polythene.',
                'Anything in a LOT 4 crate cannot be requisitioned, cannot be produced, and cannot be cited. The building is deleting my evidence at eleven pounds a skip.',
              ),
            ],
            [
              think(
                'Fresh black stencil on old timber: LOT 4. Sandbach’s men are numbering the shelves for the crates before the crates arrive.',
              ),
            ],
          ),
        ],
      },
      exit('to-counter', 'Back to the counter', at(0.0, 0.42, 0.09, 0.48), 'registry-counter', {
        cursor: 'walk-back',
      }),
      {
        id: 'strongroom-door',
        label: 'The strongroom door',
        shape: at(0.86, 0.36, 0.14, 0.38),
        cursor: 'puzzle',
        visibleIf: inAct(2),
        onInteract: [
          when(
            solved('puz-three-movements'),
            [
              clue('clue-order-book-closings'),
              think(
                'Ordinary day, close 17.30. Saturday, close 12.30 to Monday 08.45. And the interval last set, out of the Order Book for the fourteenth of September 1998: strongroom wound, closed 17.00, to open 08.00.',
                'Somebody wound this door at five o’clock on the evening a man died in this building, which is a thing the door itself remembers and nobody else thought to ask it.',
              ),
              goto('strongroom'),
            ],
            [
              when(
                any(has('commission-s41'), has('strongroom-key')),
                [
                  think(
                    'There is no keyhole. There is a spoked handle, a cast instruction plate and three brass movements behind a glazed plate, and they have to be told the truth about what hours this building keeps.',
                  ),
                  puzzle('puz-three-movements'),
                ],
                [
                  think(
                    'Eleven inches of steel and a Chubb three-movement timelock, and I have no key and no business behind it yet.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      exit('to-undercroft', 'Down to the undercroft', at(0.24, 0.8, 0.16, 0.2), 'undercroft', {
        cursor: 'walk',
        visibleIf: inAct(2),
      }),
      exit('to-reading-room', 'Through to the reading room', at(0.62, 0.72, 0.16, 0.22), 'reading-room', {
        cursor: 'walk',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'reading-room': {
    id: 'reading-room',
    name: 'The Reading Room',
    subtitle: "Green lamps and Wren's table",
    background: './art/scenes/reading-room.webp',
    weather: 'none',
    ambience: 'quiet-library',
    layers: [
      {
        id: 'night',
        src: './art/scenes/reading-room-night.webp',
        visibleIf: flagged('reading-room-night'),
        animate: 'none',
      },
    ],
    onFirstEnter: [
      think(
        'Waxed oak, green glass, a delivery hatch in the panelling and rain running down two tall sashes.',
        'They have put the coroner’s file on the table for me already, squared to the edge, with a fresh blotter under it.',
      ),
    ],
    hotspots: [
      {
        id: 'coroners-file',
        label: "Coroner's file: Cormac Sallow",
        shape: at(0.34, 0.6, 0.24, 0.2),
        cursor: 'look',
        huntable: true,
        onInteract: [
          when(lacks('sallow-letter'), [take('sallow-letter')]),
          when(all(inAct(2), lacks('coroner-exhibit-4')), [take('coroner-exhibit-4')]),
          clue('clue-accident-report'),
          tell(
            'ACCIDENT REPORT. Typed 16.50, 14 September 1998.',
            'At approximately 15.55 Mr C. Sallow, 79, retired, was found at the foot of the muniment gallery north bay. Ambulance called 16.06. Life pronounced extinct 16.20.',
            'Signed: Sabine Ferrier-Kyne, Warden.',
          ),
          think(
            'Typed on the Imperial 66. Docketed on the outside third, upside down to the tag.',
            'And signed in her own name, which I read this morning as an administrator doing her duty, because that is exactly what it looks like.',
          ),
          when(
            knows('clue-switchboard-log'),
            [
              think(
                'Found at approximately 15.55. Ambulance at 16.06. And the lividity in the pathologist’s notes gives eleven minutes on that floor before anybody lifted a telephone.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'iveson-slip',
        label: 'Request slip stapled inside the back cover',
        shape: at(0.6, 0.62, 0.14, 0.14),
        cursor: 'look',
        onInteract: [
          clue('clue-iveson-request-slip'),
          tell('2.10.98 — DS M. IVESON, Rossport — file requested — REFERRED: no further action.'),
          think(
            'A serving detective sergeant pulled this file on her own initiative three weeks ago and was told there was nothing in it.',
            'She was told that by somebody. The slip does not say who, and the slip is not going to.',
          ),
        ],
      },
      {
        id: 'delivery-hatch',
        label: 'The delivery hatch',
        shape: at(0.78, 0.36, 0.16, 0.2),
        cursor: 'use',
        onInteract: [
          sound('latch'),
          when(
            all(inAct(4), lacks('commission-minute')),
            [
              take('commission-minute'),
              clue('clue-commission-minute'),
              think(
                'My own commission file, requisitioned for a procedural reason that has nothing to do with any of this.',
                'And in it, the Conservancy’s minute of appointment, which records that Sallow’s letter of 11 September was received on 1 October and that Halkett nominated me on the 3rd — nine days before she broke her hip.',
                'She was never going to come herself. She let me believe the hip.',
              ),
            ],
            [
              when(
                inAct(2),
                [
                  clue('clue-substituted-slips'),
                  tell(
                    'Slip 2271: series 14/B box 4, Oil and Stores, Nine Bells 1974. DELIVERED: 14/A box 4, Oil and Stores, Cadran Point.',
                    'Slip 2283: Despatch Book 1970–79. DELIVERED: NOT TRACED — see W/O 89/2.',
                  ),
                  think(
                    'One character. B for A. In a building of sixty thousand cards that is a Tuesday, not a conspiracy.',
                    'I have logged both stubs in the casebook out of habit, and I am not going to think about them again for two days.',
                  ),
                ],
                [
                  think(
                    'A brass-framed hatch two feet square. You put the slip up the tube and forty minutes later the box arrives here, and the whole of my authority in this building comes down to that hatch opening.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: 'wrens-table',
        label: "Wren's table and casebook",
        shape: at(0.1, 0.62, 0.22, 0.24),
        cursor: 'look',
        onInteract: [
          when(lacks('casebook'), [take('casebook')]),
          when(all(inAct(3), solved('puz-deakin-authentication'), lacks('adverse-report')), [
            take('adverse-report'),
            think(
              'Written in the same words I would have used if it had passed. Two pages, five steps, one finding.',
              'The letter cannot have existed on the fourth of March 1975, and I am the person who has to say so, and the post goes at four.',
            ),
          ]),
          when(
            inAct(5),
            [
              when(lacks('case-file'), [take('case-file')]),
              think(
                'Eight links, forty-one supporting documents, and a citation column that cannot be left blank.',
                'Everything I was told goes in no column at all.',
              ),
            ],
            [
              think(
                'Assertion on the left, source on the right, and a rule down the middle in 2H pencil.',
                'If the right-hand box is empty the left-hand box is a claim, and a claim is not a document.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'banker-lamps',
        label: "Green banker's lamps",
        shape: at(0.56, 0.42, 0.16, 0.14),
        cursor: 'use',
        onInteract: [
          sound('click-soft'),
          when(
            flagged('reading-room-night'),
            [set('reading-room-night', false), think('Overheads back on. Ordinary daylight work.')],
            [
              set('reading-room-night'),
              think(
                'Overheads off, three green lamps on, and the room drops away into the dark past the third one.',
                'You cannot rake a sheet with light in a room that is already full of it. Everything I am about to do to a piece of paper needs this.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'gazetteer-shelf',
        label: 'The reference shelf',
        shape: at(0.02, 0.34, 0.12, 0.28),
        cursor: 'take',
        onInteract: [
          when(
            lacks('postmark-gazetteer'),
            [
              take('postmark-gazetteer'),
              think(
                'The Post Office gazetteer of sorting offices, every office in the country with the date it opened and the date it stopped striking.',
                'It weighs about four pounds and it has settled more arguments than any court in this country.',
              ),
            ],
            [think('Kelly’s, Bradshaw, the gazetteer, and a 1974 Admiralty tide table with the spine gone.')],
          ),
        ],
      },
      {
        id: 'docket-fold',
        label: 'Folders on the returns trolley',
        shape: at(0.66, 0.72, 0.18, 0.18),
        cursor: 'look',
        onInteract: [
          think(
            'Nineteen folders waiting to go back. Eighteen endorsed on the inside edge, right way up, in three different hands.',
            'One endorsed on the outside third, upside down to the tag, so you have to turn the whole file over to read the front of it.',
            'It is not a signature. It is better than a signature, because nobody has ever once thought of it as one.',
          ),
        ],
      },
      exit('to-hall', 'Out to the entrance hall', at(0.0, 0.36, 0.08, 0.5), 'entrance-hall', {
        cursor: 'walk-left',
      }),
      exit('to-long-registry', 'Through to the Long Registry', at(0.9, 0.6, 0.1, 0.32), 'long-registry', {
        cursor: 'walk-right',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'post-room': {
    id: 'post-room',
    name: 'The Post Room',
    subtitle: 'Zinc, canvas and a franking meter',
    background: './art/scenes/post-room.webp',
    weather: 'none',
    ambience: 'engine-hum',
    onFirstEnter: [
      think(
        'Zinc bench, canvas sacks on an iron rack, and a green enamelled machine with a chrome handle that has counted every penny of this Authority’s postage since 1961.',
        'The most incriminating object in any building is never the safe. It is the postage register.',
      ),
    ],
    hotspots: [
      {
        id: 'franking-meter',
        label: 'Pitney Postmaster franking meter',
        shape: at(0.36, 0.46, 0.26, 0.26),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            unsolved('puz-postmasters-register'),
            [
              think(
                'Opening this under warrant is lawful for me and a GPO offence for everybody else in this building, which is a strange thing to be nineteen and allowed to do.',
                'Descending credit in one window, ascending impressions in the other, and the day’s post book to set against them.',
              ),
              puzzle('puz-postmasters-register'),
            ],
            [
              clue('clue-franking-meter'),
              when(
                inAct(5),
                [
                  when(all(has('notice-74-119-retyped'), lacks('notice-74-119-issued')), [
                    take('notice-74-119-issued'),
                    sound('chime'),
                    think(
                      'One impression. Fourpence, struck from the old die under the descending register, on the first envelope of two hundred and fourteen.',
                      'Schedule D, number one: the Keeper, Nine Bells Beacon, per relief boatman, Cardew Post Office.',
                      'Twenty-four years, two months and eighteen days late.',
                    ),
                  ]),
                ],
                [
                  think(
                    'Two registers and a book, and one of the three is wrong, and it will never be the registers.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: 'post-book',
        label: 'Post book',
        shape: at(0.14, 0.54, 0.18, 0.18),
        cursor: 'look',
        onInteract: [
          when(
            all(inAct(3), has('despatch-book')),
            [
              clue('clue-franking-shortfall'),
              tell(
                'Recharge 2 August 1974: register £40 0s 0d. Recharge 4 September 1974: register £11 4s 8d.',
                '16 August: Notices to Mariners, despatch — £3 11s 0d.',
              ),
              think(
                'Three pounds eleven shillings exactly. Eight hundred and fifty-two pence. Two hundred and thirteen impressions at fourpence.',
                'The docket says two hundred and fourteen. Schedule D says two hundred and fourteen. The meter says two hundred and thirteen.',
                'Fourpence. That is the whole of it. Fourpence, and thirty-one people.',
              ),
            ],
            [
              think(
                'Sixteen entries a day, cast in the margin, initialled EC. The neatest book in the building and the least interesting, which is why it is going to be the most useful.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'address-plates',
        label: 'Address-plate cabinet',
        shape: at(0.66, 0.5, 0.2, 0.22),
        cursor: 'look',
        onInteract: [
          when(lacks('schedule-d-plates'), [take('schedule-d-plates')]),
          clue('clue-schedule-d'),
          tell(
            'SCHEDULE D — NOTICES TO MARINERS — 214 ADDRESSEES IN STATUTORY PRECEDENCE.',
            'No. 1: THE KEEPER, NINE BELLS BEACON, per relief boatman, c/o Cardew Post Office, tel. Cardew 4471.',
          ),
          think(
            'Two hundred and fourteen brass plates in precedence order, and the man on the rock is number one, because whoever wrote this schedule in 1889 understood exactly who a notice to mariners is for.',
          ),
        ],
      },
      {
        id: 'meter-card-book',
        label: 'Meter Card Book',
        shape: at(0.06, 0.36, 0.13, 0.16),
        cursor: 'take',
        onInteract: [
          when(
            lacks('meter-card-book'),
            [
              take('meter-card-book'),
              think(
                'Every recharge since 1961, dated, with both register readings and the postmaster’s initials.',
                'It turns a postage meter into a serial witness. Nobody has ever asked it a question.',
              ),
            ],
            [think('Rule 6: the die is to be tested upon a scrap each morning and the impression carried to the card.')],
          ),
        ],
      },
      {
        id: 'old-die',
        label: 'The superseded fourpenny die',
        shape: at(0.28, 0.72, 0.13, 0.14),
        cursor: 'take',
        onInteract: [
          when(
            lacks('fourpenny-die'),
            [
              take('fourpenny-die'),
              think(
                'Rubber and brass, in a drawer since decimalisation, because Enid Charnock has never thrown away anything that might one day be asked for.',
                'Fourpence. Still crisp. Still able to strike.',
              ),
            ],
            [think('Wrapped in tissue in the side pocket of my bag. It has one job left.')],
          ),
        ],
      },
      {
        id: 'sack-rack',
        label: 'Mail sacks and the collection rack',
        shape: at(0.86, 0.3, 0.13, 0.3),
        cursor: 'look',
        onInteract: [
          think(
            'Bench, meter, sack, rack, van, Rossport. Six steps, and the third one is a canvas bag on a hook that anybody in this building can walk past.',
            'An envelope does not have to be destroyed. It only has to be not put in the sack.',
          ),
        ],
      },
      exit('to-counter', 'Back to the registry counter', at(0.0, 0.4, 0.08, 0.48), 'registry-counter', {
        cursor: 'walk-back',
      }),
      exit('to-duplicating', 'Through to the duplicating room', at(0.9, 0.6, 0.1, 0.3), 'duplicating-room', {
        cursor: 'walk-right',
      }),
      exit('to-courtyard', 'The courtyard door', at(0.46, 0.2, 0.14, 0.24), 'courtyard-and-site-hut', {
        cursor: 'walk',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'duplicating-room': {
    id: 'duplicating-room',
    name: 'The Duplicating Room',
    subtitle: 'The Reprax 12 and the microfilm reader',
    background: './art/scenes/duplicating-room.webp',
    weather: 'none',
    ambience: 'engine-hum',
    grade: 'saturate(0.82) hue-rotate(-6deg)',
    onFirstEnter: [
      think(
        'Solvent, ink and a fluorescent batten with a flicker in it. The only room in the building painted green on purpose.',
        'A machine with a counter on it is a witness that has never once been asked to remember anything.',
      ),
    ],
    hotspots: [
      {
        id: 'reprax',
        label: 'Reprax 12 duplicator',
        shape: at(0.28, 0.42, 0.3, 0.32),
        cursor: 'use',
        huntable: true,
        onInteract: [
          sound('click-brass'),
          when(
            all(inAct(5), has('notice-74-119-retyped')),
            [
              think(
                'Two hundred and fourteen turns of the handle, and the counter going over exactly two hundred and fourteen, and the smell of the ink is the same smell it had in 1974.',
              ),
            ],
            [
              think(
                'Crank, drum, feed tray, delivery tray, and a small brass counter at the end of the cylinder reading 268,041.',
                'It advances whether or not the operator writes the job in the book, and it has done since 1961, and nobody has ever thought of that as evidence.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'duplicating-book-1974',
        label: 'Duplicating Book, 15 August 1974',
        shape: at(0.64, 0.5, 0.16, 0.18),
        cursor: 'look',
        onInteract: [
          clue('clue-reprax-1974'),
          tell(
            '15.8.74 — counter opening 41,882 — closing 42,319 — jobs logged: circulars 200, dues notices 23.',
          ),
          think(
            'Four hundred and thirty-seven impressions against two hundred and twenty-three logged.',
            'Two hundred and fourteen copies, run on the fifteenth of August 1974, of a document that does not exist in any register in this building.',
          ),
        ],
      },
      {
        id: 'duplicating-book-1998',
        label: 'Duplicating Book, 14 September 1998',
        shape: at(0.8, 0.5, 0.14, 0.18),
        cursor: 'look',
        visibleIf: inAct(4),
        onInteract: [
          clue('clue-reprax-1998'),
          tell('14.9.98 — counter opening 267,946 — closing 267,987 — jobs logged: minutes 12.'),
          think(
            'Forty-one against twelve. Twenty-nine unlogged impressions in a room whose keeper was on the 08.15 ferry.',
            'Twenty-six of them are in her Board working file, correctly foliated. The other three I have not found and probably never will.',
          ),
        ],
      },
      {
        id: 'microfilm-reader',
        label: 'Microfilm reader',
        shape: at(0.06, 0.34, 0.18, 0.28),
        cursor: 'use',
        onInteract: [
          tell('MICROFILM ACCESSION REGISTER: FILMED 1994 — SERIES 1/A, 2/C, 9/E.'),
          think(
            'Three series filmed in 1994 and 14/B not among them, which means every sheet of 14/B exists precisely once, on paper, in a strongroom with water coming under the door.',
            'When it comes to it, that is the whole rule: save what does not exist anywhere else.',
          ),
        ],
      },
      {
        id: 'ink-drums',
        label: 'Drum ink and stencil skins',
        shape: at(0.62, 0.72, 0.18, 0.16),
        cursor: 'look',
        onInteract: [
          think(
            'Four tins, four formulations, and a change of supplier in 1979 you can see with the naked eye — the older ink is violet-black and sits on the fibre, the newer one is flat and sinks in.',
            'Which means a copy can be dated to within a few years by nothing but the way it wetted the paper.',
          ),
        ],
      },
      {
        id: 'waste-bin',
        label: 'Spoil bin',
        shape: at(0.2, 0.72, 0.16, 0.18),
        cursor: 'take',
        visibleIf: inAct(4),
        onInteract: [
          when(
            lacks('spoil-sheet'),
            [
              take('spoil-sheet'),
              think(
                'Misfeeds, double-feeds and skewed sheets, nobody’s job to empty since the strip-out started.',
                'And one sheet that went through twice: the reverse of it carries the offset of something that was fed the right way up, and that something is not in box 17 any more.',
              ),
            ],
            [think('Half a hundredweight of spoiled foolscap that nobody thought worth burning.')],
          ),
        ],
      },
      exit('to-counter', 'Back to the registry counter', at(0.0, 0.42, 0.08, 0.46), 'registry-counter', {
        cursor: 'walk-back',
      }),
      exit('to-post-room', 'Through to the post room', at(0.9, 0.44, 0.1, 0.36), 'post-room', {
        cursor: 'walk-right',
      }),
    ],
  },
};
