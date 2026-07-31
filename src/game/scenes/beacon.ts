/**
 * The Nine Bells Beacon.
 *
 * A hundred and twelve feet of granite on a reef nine miles offshore, held
 * back from the player until Act IV and then paid for in body rather than in
 * file: the jump, the cold oil store, eleven hours in a service room with the
 * only other person who knows, and at first light the one thing in the whole
 * game that is not evidence.
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
  lacks,
  puzzle,
  say,
  set,
  shake,
  solved,
  sound,
  speakTo,
  take,
  tell,
  think,
  unsolved,
  when,
} from './util';

export const beaconScenes: Record<SceneId, Scene> = {
  // -------------------------------------------------------------------------
  'beacon-landing': {
    id: 'beacon-landing',
    name: 'The Nine Bells',
    subtitle: 'Landing stage and doorway',
    background: './art/scenes/beacon-landing.webp',
    weather: 'heavy-rain',
    ambience: 'sea-swell',
    enterIf: inAct(4),
    onFirstEnter: [
      think(
        'It is bigger than it has any right to be. From four hundred yards it was a black upright thing. From the gunwale it goes up out of the water and keeps going.',
        'The swell comes up the plinth and drains white off the rock, and then does it again, and there is no ground anywhere.',
      ),
    ],
    hotspots: [
      {
        id: 'jump',
        label: 'The landing, on the rise',
        shape: at(0.42, 0.62, 0.22, 0.24),
        cursor: 'walk',
        huntable: true,
        enabledIf: has('beacon-padlock-key'),
        blockedEffects: [
          think('Not without the key. Getting onto that rock without it would be a stunt, and a stunt is not a document.'),
        ],
        onInteract: [
          say(
            'Rita Tain',
            'On the rise. Not the top, the rise. When she lifts, you go, and you do not look at the water.',
            'If you miss it I will get you back in, and it will not be tidy.',
          ),
          shake(0.7),
          think(
            'Four feet of lift and about a second and a half of it.',
            'One. Left hand to the rung. Two. Right foot to the ledge. Three. Do not think about the gap closing.',
          ),
          sound('footstep-stone'),
          think('Kelp, iron and wet granite under both hands, and the boat falling away behind me.'),
          goto('beacon-oil-store'),
        ],
      },
      {
        id: 'gallery-door',
        label: 'The gallery door far above',
        shape: at(0.38, 0.0, 0.16, 0.1),
        cursor: 'look',
        onInteract: [
          think(
            'From directly beneath, the reason it stands open is not sinister at all: a bronze hasp corroded through and twenty-four years of weather taking the door off its latch.',
            'I wanted it to mean something. It means a hinge, and it means Rita was wrong about who goes out here, and that is all it will ever mean.',
          ),
        ],
      },
      {
        id: 'entrance-door',
        label: 'The bronze entrance door',
        shape: at(0.55, 0.09, 0.1, 0.22),
        cursor: 'use',
        onInteract: [
          when(
            has('beacon-padlock-key'),
            [
              sound('lock-click'),
              set('beacon-open'),
              think(
                'A keeper’s padlock, closed in 1974 by somebody who expected to come back in the spring, and a key that has hung on the third hook nine miles away ever since.',
                'It goes in stiff, and turns, and the shackle comes out with a crust of green on it.',
              ),
            ],
            [
              sound('lock-refuse'),
              think(
                'A keeper’s padlock, bronze, with twenty-four winters of green grown into the shackle.',
                'It has seized shut, not open. Without its key this is nine feet of granite and a door I could stand at until the tide takes me.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'reef',
        label: 'The Nine Bells reef',
        shape: at(0.06, 0.6, 0.24, 0.24),
        cursor: 'look',
        onInteract: [
          think(
            'Nine of them, and at this state of tide you can see four, black and streaming, with the swell standing up over the rest.',
            'Named on a chart since 1834. At four minutes past eleven on the third of November 1974 a hundred and eighteen people came onto this at eight and a half knots, steering for a light that was nine miles south-south-east of where they thought it was.',
          ),
        ],
      },
      {
        id: 'dry-bag',
        label: "Rita's dry bag",
        shape: at(0.65, 0.78, 0.12, 0.13),
        cursor: 'use',
        onInteract: [
          when(lacks('dry-bag'), [take('dry-bag')]),
          say(
            'Rita Tain',
            'What goes in the bag comes off the rock. What doesn’t, doesn’t. Don’t be clever about it.',
          ),
          think(
            'A rubber sack with a roll-top and two straps, and it will hold one ledger and nothing else worth having.',
            'Everything I am about to find has to fit in that, or stay here.',
          ),
        ],
      },
      exit('back-aboard', 'Back aboard the Ardent', at(0.8, 0.86, 0.19, 0.14), 'the-ardent', {
        cursor: 'walk-back',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'beacon-oil-store': {
    id: 'beacon-oil-store',
    name: 'The Nine Bells — Oil Store',
    subtitle: 'Cold paraffin, twenty-four years unbreathed',
    background: './art/scenes/beacon-oil-store.webp',
    weather: 'dust',
    ambience: 'silence',
    enterIf: inAct(4),
    grade: 'saturate(0.7)',
    onFirstEnter: [
      think(
        'The sea is enormous and about four feet away through nine feet of granite, and inside here it is completely, unreasonably still.',
        'It smells of cold paraffin. Not burnt. Cold. Nobody has opened this door since 1974.',
      ),
    ],
    hotspots: [
      {
        id: 'keepers-log',
        label: "The keeper's log in its rack",
        shape: at(0.44, 0.25, 0.19, 0.14),
        cursor: 'take',
        huntable: true,
        onInteract: [
          when(
            lacks('keepers-log'),
            [
              take('keepers-log'),
              clue('clue-keepers-log'),
              tell(
                '24.8.74, 22.10. Wind SW 4. No. 2 vapor. cracked. Oil out. Light down.',
                'Nothing more to be done here.',
              ),
              think(
                'The last line anybody wrote on this rock, in pencil, in a ruled log, at ten past ten at night on a Saturday.',
                'It is not in the Authority’s custody. It has never been in the Authority’s custody. It is the one record of this whole business that no hand in Pilotage House has ever been able to touch, and I have got it in a dry bag.',
              ),
            ],
            [think('Oak rack, brass thumbscrew, and a ledger with the salt gone into the boards.')],
          ),
        ],
      },
      {
        id: 'log-reverse',
        label: 'The back of the last page',
        shape: at(0.64, 0.25, 0.1, 0.14),
        cursor: 'look',
        enabledIf: has('keepers-log'),
        blockedEffects: [think('The log first.')],
        onInteract: [
          tell('tea — boot polish — b/day card for Nan'),
          think(
            'In pencil, on the back of the last page anybody ever wrote in this tower.',
            'I have been reading this man as a link in a chain of proof for nine days. He wanted a birthday card for somebody called Nan.',
          ),
        ],
      },
      {
        id: 'oil-drums',
        label: 'Empty paraffin drums',
        shape: at(0.29, 0.53, 0.47, 0.22),
        cursor: 'look',
        onInteract: [
          think(
            'Eleven drums, and you can tell empty from full at four feet by the sound your knuckle makes.',
            'All eleven. The last delivery tally chalked on the wall behind them reads 90 GALL. REMG. 9.8.74, and there is nothing after it, because there was never anything after it.',
          ),
        ],
      },
      {
        id: 'vaporiser',
        label: 'The cracked No. 2 vaporiser',
        shape: at(0.44, 0.41, 0.09, 0.11),
        cursor: 'look',
        onInteract: [
          think(
            'On a shelf, on a folded sack, where somebody put it down meaning to deal with it on the next relief.',
            'A hairline crack at the jet, about eleven millimetres, and a bloom of soot round it.',
            'This is the mechanical fault named on page two of a notice that was never sent, and it has been lying on this shelf, in the dark, being exactly what the notice said it was, for twenty-four years.',
          ),
        ],
      },
      {
        id: 'stores-tally',
        label: 'Stores tally board',
        shape: at(0.77, 0.43, 0.07, 0.36),
        cursor: 'look',
        onInteract: [
          when(
            has('oil-requisition-book'),
            [
              think(
                'Chalk figures on slate, kept by a keeper for himself, against a buckram requisition book kept ashore by a chief clerk’s enemies.',
                'R.741 refused. R.748 refused. R.755 refused. Nought drawn, nought received, nought remaining, in a hand that had no idea anybody would ever check.',
                'Two records in two custodies nine miles apart, agreeing to the gallon. That is what authentication actually looks like.',
              ),
            ],
            [
              think(
                'Slate, chalk, and a rag on a nail. Drawn, received, remaining, ruled up by hand.',
                'It is worth nothing at all until I can set it against the requisition book, and the requisition book is in a kitchen at Cardew.',
              ),
            ],
          ),
        ],
      },
      exit('out-to-landing', 'Out to the landing', at(0.06, 0.22, 0.12, 0.68), 'beacon-landing', {
        cursor: 'walk-back',
        enabledIf: any(flagged('sea-closed', false), inAct(5)),
        blockedEffects: [
          think(
            'The sea has got up past the point where the Ardent can lie off, and Rita has gone for Cardew with the log in the dry bag.',
            'There is no way off this rock until it drops. There is a stove upstairs and eleven hours of dark.',
          ),
        ],
        before: [
          when(inAct(5), [
            think(
              'Flat calm by seven, which is the sea all over, and the Ardent standing off the landing with Rita on the tiller pretending she has not been awake all night.',
            ),
          ]),
        ],
      }),
      exit('stair-up', 'The stair to the service room', at(0.85, 0.54, 0.15, 0.44), 'beacon-service-room', {
        cursor: 'walk-right',
        before: [
          when(all(has('keepers-log'), flagged('sea-closed', false)), [
            set('sea-closed'),
            sound('thunder'),
            say(
              'Rita Tain',
              'I can’t hold her off it. I’m away for Cardew with your book and I’ll come back for the pair of you when it drops.',
              'There’s a stove. Light it.',
            ),
            think('The pair of us. I had not understood, until she said it, that Sabine was on the stair behind me.'),
          ]),
        ],
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'beacon-service-room': {
    id: 'beacon-service-room',
    name: 'The Nine Bells — Service Room',
    subtitle: 'Eleven hours',
    background: './art/scenes/beacon-service-room.webp',
    weather: 'none',
    ambience: 'sea-swell',
    enterIf: inAct(4),
    onFirstEnter: [
      think(
        'A circular whitewashed room ten feet across, a built-in bunk with a folded blanket on it, a shelf of enamel mugs, and the sea hitting the granite in slow enormous thuds you feel in your teeth.',
        'And a fifty-eight-year-old Warden sitting on the end of the bunk with a thermos and a satchel, being perfectly polite.',
      ),
    ],
    onEnter: [when(all(inAct(4), has('keepers-log')), [advanceTo(5)])],
    hotspots: [
      {
        id: 'stove',
        label: 'The paraffin stove',
        shape: at(0.4, 0.6, 0.22, 0.24),
        cursor: 'use',
        huntable: true,
        onInteract: [
          when(
            flagged('stove-lit'),
            [
              think(
                'Blue ring, amber edge, and the whole room moving very slightly in the light of it.',
                'It is the only warm thing within nine miles and it is going to burn for about eleven hours, which is exactly as long as we have got.',
              ),
            ],
            [
              sound('match-strike'),
              set('stove-lit'),
              think(
                'Prick the nipple, pump it thirty, warm the vaporiser, and then a blue ring and a smell like the inside of a lamp room.',
                'She watched me do it and did not offer to help, which I think was manners rather than anything else.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'sabine-confession',
        label: 'Sabine Ferrier-Kyne',
        shape: at(0.26, 0.5, 0.11, 0.34),
        cursor: 'talk',
        enabledIf: flagged('stove-lit'),
        blockedEffects: [
          think('Not in the cold and not in the dark. The stove first. Whatever else this is, it is going to take hours.'),
        ],
        onInteract: [speakTo('sabine-ferrier-kyne')],
      },
      {
        id: 'kestrel-satchel',
        label: 'The satchel and the Kestrel Bequest',
        shape: at(0.28, 0.85, 0.14, 0.12),
        cursor: 'look',
        visibleIf: inAct(5),
        onInteract: [
          when(
            lacks('kestrel-mandate'),
            [
              say(
                'Sabine Ferrier-Kyne',
                'You may as well have it now. You would have it by Thursday anyway, and I would rather you had it from me.',
              ),
              take('kestrel-mandate'),
              clue('clue-kestrel-mandate'),
              tell(
                'THE KESTREL BEQUEST. Trust deed, 4 April 1977. Bank mandate: thirty-one index-linked standing orders, monthly.',
                'Beneficiary initials: B.H. — T.H. — M.K. — W.O. — A.V. — … — M. TAIN.',
              ),
              think(
                'Thirty of these initials are on a wall in a churchyard at St Bride’s. I read them on my first afternoon in the rain.',
                'The thirty-first is alive, and has spent twenty-one years of it on pamphlets and legal opinions and photocopying, trying to prove what the woman paying it did.',
                'The trust deed does not name the settlor. Nobody living knows except the two of us, and the Board does not need it.',
              ),
            ],
            [think('An old leather satchel with a school name inked inside the flap, and twenty-one years of somebody’s conscience in it.')],
          ),
        ],
      },
      {
        id: 'bunk',
        label: "The keeper's bunk",
        shape: at(0.1, 0.4, 0.15, 0.28),
        cursor: 'look',
        onInteract: [
          think(
            'A curved wooden berth with a blanket folded in three at the foot and the pillow squared, made up in the summer of 1974 by a man who expected to sleep in it in September.',
            'Nobody has sat on it since. I am not going to be the first.',
          ),
        ],
      },
      {
        id: 'radio',
        label: 'The radio set',
        shape: at(0.14, 0.18, 0.18, 0.18),
        cursor: 'use',
        visibleIf: inAct(5),
        onInteract: [
          sound('click-brass'),
          say(
            'DS Iveson',
            'Unrecorded, uncautioned, uncorroborated, and to one nineteen-year-old on a rock. It is worth precisely nothing and you know it is.',
            'So stop crying, get your file in order, and bring me an object.',
          ),
          think(
            'Four hours. She told me all of it, in order, with dates, without one word of excuse, and at seven o’clock in the morning it turns out to be worth nothing at all.',
            'Which is right. I would have argued it was right, in a classroom, a fortnight ago.',
          ),
        ],
      },
      exit('stair-down', 'Down to the oil store', at(0.02, 0.66, 0.12, 0.3), 'beacon-oil-store', {
        cursor: 'walk-back',
      }),
      exit('stair-up', 'The stair to the lantern', at(0.86, 0.06, 0.14, 0.38), 'beacon-lantern-room', {
        cursor: 'walk-right',
        visibleIf: inAct(5),
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'beacon-lantern-room': {
    id: 'beacon-lantern-room',
    name: 'The Nine Bells — Lantern Room',
    subtitle: 'First light, 3 November',
    background: './art/scenes/beacon-lantern-room.webp',
    weather: 'none',
    ambience: 'wind-moor',
    enterIf: inAct(5),
    layers: [
      {
        id: 'optic-lit',
        src: './art/scenes/beacon-lantern-room-optic-lit.webp',
        visibleIf: solved('puz-the-optic'),
        blend: 'screen',
        animate: 'pulse',
      },
    ],
    onFirstEnter: [
      think(
        'Inside the optic. A drum of prismatic glass a fathom across, and the sun coming up through it in hundreds of separate blades of white and colour across the brass.',
        'The gale blew itself out at about four. It is the third of November and it is going to be a beautiful day.',
      ),
    ],
    hotspots: [
      {
        id: 'optic',
        label: 'The clockwork Fresnel optic',
        shape: at(0.02, 0.02, 0.4, 0.42),
        cursor: 'puzzle',
        huntable: true,
        enabledIf: all(has('sector-plates'), has('fresnel-panel')),
        blockedEffects: [
          think('It is incomplete. One panel short and no sector plates, and a light with a hole in it shows the wrong character to everybody who sees it.'),
        ],
        onInteract: [
          when(
            unsolved('puz-the-optic'),
            [
              think(
                'Three flashes in twenty seconds. Not fifteen. Fifteen is Cadran Point, nine miles south-south-east, and it has never once been wrong in eighty-seven years.',
                'One revolution in twenty seconds. Eighteen degrees the second. Nought, thirty-six and seventy-two.',
              ),
              puzzle('puz-the-optic'),
            ],
            [
              think(
                'Wound, set, and the escapement release at 23.04.',
                'That is not evidence. There is no citation for it and no column in the casebook it goes in, and it is the only thing I have done here that is entirely mine.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'returned-panel',
        label: 'The panel wrapped in a fleece',
        shape: at(0.44, 0.8, 0.16, 0.16),
        cursor: 'use',
        onInteract: [
          when(
            has('fresnel-panel'),
            [
              think(
                'Unwrapped on the floor plates: crown glass, ground in 1908, with a shipping agent’s chalk mark still on the edge and a fleece from the back of a van round it.',
                'He said nothing about the money and nothing about his daughters and nothing about the firm. He said: don’t make a thing of it.',
              ),
            ],
            [
              think(
                'One bay of the frame is empty, and it is going to stay empty unless a man who is stealing brass decides to buy a piece of it back.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'weight-shaft',
        label: 'The falling weight and shaft',
        shape: at(0.18, 0.56, 0.2, 0.4),
        cursor: 'use',
        onInteract: [
          sound('lock-click'),
          think(
            'A hundredweight on a chain, down a shaft that runs the whole spine of the tower, and a crank that takes about four hundred turns.',
            'My arms give out at three hundred and ten and I sit on the floor plate for a minute and then finish it.',
            'It is the last physical thing anybody asks of me in nine days and it is by a long way the easiest.',
          ),
        ],
      },
      {
        id: 'gallery-door',
        label: 'The gallery door',
        shape: at(0.9, 0.06, 0.1, 0.42),
        cursor: 'look',
        onInteract: [
          think(
            'Out onto the gallery rail, a hundred and twelve feet up, in a cold blue morning with the whole coast laid out and not one person on it.',
            'Brannock Head. The churchyard. Cardew under a smear of smoke. Rossport. The causeway coming up out of the water like a spine.',
            'I am not frightened of the water from up here, which is unfair, and I am going to be frightened of it again in about an hour on the way down.',
          ),
        ],
      },
      {
        id: 'lamp-log-slate',
        label: 'The lighting-up slate',
        shape: at(0.66, 0.74, 0.2, 0.16),
        cursor: 'look',
        onInteract: [
          when(
            solved('puz-the-optic'),
            [
              think(
                'Columns ruled in chalk in 1974 — DATE, LIT, EXTINGUISHED, WIND — and nothing under them.',
                'I have written the date on the next line down. 3.11.98. Nothing else, because nothing else is true yet.',
                'It is not evidence. It is the only thing in this whole business that is not, and I am not going to explain it to anybody.',
              ),
            ],
            [
              think(
                'Ruled in chalk, twenty-four years ago, by somebody who expected to fill it in that evening.',
                'The last entry is the twenty-fourth of August 1974, and then eleven empty lines, and then the bottom of the slate.',
              ),
            ],
          ),
        ],
      },
      exit('stair-down', 'Down to the service room', at(0.02, 0.72, 0.16, 0.26), 'beacon-service-room', {
        cursor: 'walk-back',
      }),
    ],
  },
};
