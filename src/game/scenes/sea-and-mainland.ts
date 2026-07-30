/**
 * The Ardent, Rossport and Cardew.
 *
 * Everything on the far side of the water from Pilotage House: the cutter that
 * carries Wren in and, in Act IV, out to the rock; the mainland toehold with
 * the call box that is the game's whole hint system; the police station her
 * case has to be strong enough to stand in; the slipway; the drowned village
 * street; and a rented kitchen with three thousand stolen documents in it.
 */

import type { Scene, SceneId } from '@/engine/types';
import {
  advanceTo,
  all,
  any,
  at,
  clue,
  exit,
  goto,
  has,
  inAct,
  knows,
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
  untilAct,
  when,
} from './util';

export const seaAndMainlandScenes: Record<SceneId, Scene> = {
  // -------------------------------------------------------------------------
  'the-ardent': {
    id: 'the-ardent',
    name: 'The Ardent',
    subtitle: 'Pilot cutter, Ivory Sound',
    background: './art/scenes/the-ardent.webp',
    weather: 'rain',
    ambience: 'sea-swell',
    grade: 'saturate(0.88) contrast(1.04)',
    layers: [
      {
        id: 'gale',
        src: './art/scenes/the-ardent-storm.webp',
        visibleIf: inAct(4),
        animate: 'drift',
      },
    ],
    onFirstEnter: [
      think(
        'Twenty minutes out of Rossport and the cabin smells of diesel, wet wool and salt.',
        'Spray got into the satchel somewhere off the harbour mouth. Leaves two and three of my own commission have gone over hard, like a biscuit.',
        'Nobody can open a door on Brannock Head with a document they cannot read. Not even me.',
      ),
    ],
    hotspots: [
      {
        id: 'satchel',
        label: "Wren's soaked satchel",
        shape: at(0.3, 0.55, 0.29, 0.25),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            unsolved('puz-fused-commission'),
            [
              think(
                'Section 41 of the Coastal Services Act, three leaves and a seal, and two of the leaves have welded themselves together.',
                'Damp blotter under. Membrane over. Then nothing at all for as long as it takes.',
              ),
              puzzle('puz-fused-commission'),
            ],
            [
              take('commission-s41'),
              clue('clue-fused-commission'),
              think(
                'Legible. The seal, the schedule of series, and Halkett’s countersignature in her small upright hand.',
                'Certify by the third of November or the whole archive is deemed valueless and goes to the pulper on the fourth. Nine days.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'spatula-kit',
        label: 'Conservation roll: spatula, membrane, blotters',
        shape: at(0.08, 0.6, 0.2, 0.19),
        cursor: 'take',
        huntable: true,
        onInteract: [
          when(
            lacks('conservation-kit'),
            [
              take('conservation-kit'),
              take('casebook'),
              think(
                'Bone spatula, Gore-Tex sheet, six blotters, a hygrometer with a brass needle, and card 3 in the lid: the sheet tells you when, you do not tell the sheet.',
                'And the casebook. Wire-bound, ruled in pencil, citation column down the right. Everything I can prove goes in the left. Everything I can prove it with goes in the right.',
              ),
            ],
            [
              think(
                'Everything back in its loops, the way Halkett taught me. A kit you have to hunt through is a kit you stop using.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'lee-rail',
        label: 'The lee rail',
        shape: at(0.67, 0.5, 0.26, 0.36),
        cursor: 'look',
        visibleIf: inAct(2),
        onInteract: [
          when(
            inAct(4),
            [
              think(
                'Twice on the way out. Hands white on the rail, cap gone, and Rita not saying one word about it, which is the kindest thing anyone has done for me all week.',
                'One. The log is in the oil store. Two. The oil store is on the rock. Three. There is no other way to it.',
              ),
            ],
            [
              think(
                'I am not frightened of the boat. I am frightened of the water, which is a different thing and a stupider one, and I have been sick over this rail in front of a woman who has never been sick in her life.',
                'The beacon comes and goes behind the swell. A hundred and twelve feet of granite with nothing lit on top of it.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'binocular-case',
        label: 'Brass-bound glasses in the locker',
        shape: at(0.04, 0.28, 0.15, 0.2),
        cursor: 'use',
        visibleIf: inAct(2),
        onInteract: [
          when(lacks('binocular-glasses'), [take('binocular-glasses')]),
          think(
            'Four hundred yards. Focus wheel stiff with salt, and the swell putting the whole tower up and down through the field of view.',
            'The gallery door at the top is standing open. Wide open, swinging.',
            'Rita says nobody goes out to that rock in the off season. Somebody’s door disagrees with her.',
          ),
        ],
      },
      {
        id: 'radio-set',
        label: 'The set on its shelf',
        shape: at(0.05, 0.08, 0.17, 0.16),
        cursor: 'use',
        visibleIf: inAct(5),
        onInteract: [
          sound('click-brass'),
          say(
            'DS Iveson',
            'Four hours, was it. On a rock. No caution, no tape, no second officer, and you nineteen.',
            'Then it’s worth nothing, Miss Adare, and crying down my radio won’t make it worth more. Everything gets cited or everything gets struck.',
            'Go and do your job. I’ll have the referral form ready when you land.',
          ),
          think('Nothing I was told. Only what I can hold up to a window.'),
        ],
      },
      exit('to-rossport', 'Rossport quay', at(0.0, 0.4, 0.1, 0.52), 'rossport-quay', {
        cursor: 'walk-left',
        before: [think('Ten minutes on the engine, in against the tyres, and a ladder up the wall.')],
      }),
      exit('to-slipway', 'The Brannock slipway', at(0.9, 0.4, 0.1, 0.52), 'slipway-and-ritas-shed', {
        cursor: 'walk-right',
      }),
      exit('to-beacon', 'Out to the Nine Bells', at(0.6, 0.13, 0.26, 0.25), 'beacon-landing', {
        cursor: 'walk',
        visibleIf: inAct(4),
        enabledIf: all(inAct(4), has('beacon-padlock-key')),
        blockedEffects: [
          say(
            'Rita Tain',
            'I’ll put you alongside that landing in this and you’ll not get through the door, and then we’ve both done it for nothing.',
            'Keeper’s padlock. Third hook in your entrance hall, nine mile that way. Fetch it.',
          ),
        ],
        before: [
          when(lacks('dry-bag'), [take('dry-bag')]),
          think(
            'One. It is nine miles. Two. The gale is rising, not dropping. Three. The log has been in that oil store since 1974 and the sea does not care that I need it by Tuesday.',
          ),
        ],
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'rossport-quay': {
    id: 'rossport-quay',
    name: 'Rossport Quay',
    subtitle: 'The ferry slip and the call box',
    background: './art/scenes/rossport-quay.webp',
    weather: 'rain',
    ambience: 'harbour',
    onFirstEnter: [
      think(
        'Sodium light, wet setts, and one telephone kiosk with a light in it.',
        'This is the only place on this coast where I can ask anybody anything.',
      ),
    ],
    hotspots: [
      {
        id: 'call-box',
        label: 'GPO call box',
        shape: at(0.4, 0.24, 0.21, 0.56),
        cursor: 'talk',
        huntable: true,
        onInteract: [
          when(
            has('ten-pence-pieces'),
            [speakTo('phyllida-halkett')],
            [
              think(
                'Four pence for the first three minutes and she talks in paragraphs. I need change before I lift that receiver.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'ferry-office',
        label: 'Ferry office booking book',
        shape: at(0.63, 0.42, 0.2, 0.22),
        cursor: 'look',
        onInteract: [
          when(
            inAct(4),
            [
              tell(
                'Rossport–Brannock foot passengers, Monday 14 September 1998.',
                'H. PIKE — out 08.15 — ret. 17.40. Paid cash. Ticket 4471 series B.',
              ),
              take('ferry-booking-extract'),
              clue('clue-ferry-booking-book'),
              think(
                'Pike was on the water at nine in the morning on the day Cormac Sallow died, and back at twenty to six.',
                'So the registry counter was worked by somebody else that morning, and there is exactly one person in that building senior enough to do it without asking anybody.',
              ),
            ],
            [
              think(
                'Two sailings a day and a booking book kept in biro since the spring. The clerk lets me look because I asked in a way that let her say no.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'tide-board',
        label: 'Causeway tide board',
        shape: at(0.08, 0.34, 0.15, 0.24),
        cursor: 'look',
        onInteract: [
          when(
            inAct(4),
            [
              tell('CAUSEWAY CLOSED. SPRING TIDE AND GALE WARNING. DO NOT ATTEMPT.'),
              think(
                'Six feet over the crown of it, and the board has been turned to CLOSED by somebody who then went home. Nothing crosses to Cardew on foot until this blows out.',
              ),
            ],
            [
              think(
                'Low water 06.14 and 18.42. Chalked up each morning by the harbourmaster and rubbed out each night.',
                'The causeway is open about five hours in twelve. Everything I do over there has a clock on it.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'phone-money',
        label: 'Pocketful of ten-pence pieces',
        shape: at(0.24, 0.62, 0.13, 0.14),
        cursor: 'take',
        onInteract: [
          when(
            lacks('ten-pence-pieces'),
            [
              take('ten-pence-pieces'),
              think(
                'Changed a pound note in the ferry office. Eight ten-pence pieces and a look.',
                'Halkett has never in her life finished a sentence inside three minutes.',
              ),
            ],
            [think('Enough for two proper calls, or one call with a procedure in it.')],
          ),
        ],
      },
      {
        id: 'pelagia-memorial',
        label: 'Cast-iron memorial plate',
        shape: at(0.05, 0.58, 0.22, 0.24),
        cursor: 'look',
        huntable: true,
        onInteract: [
          tell(
            'IN MEMORY OF THE THIRTY-ONE LOST IN THE M.V. PELAGIA UPON THE NINE BELLS REEF, 3rd NOVEMBER 1974.',
            'ERECTED BY PUBLIC SUBSCRIPTION.',
          ),
          when(lacks('pelagia-manifest'), [take('pelagia-manifest')]),
          think(
            'Salt has eaten the letters back into the iron. You have to read it with your fingers as much as your eyes.',
            'Thirty-one names, and TAIN, E., PILOT set slightly apart at the foot, as though the founder had been given the order late and did not want to argue about it.',
            'The ferry office has the sailing manifest in a frame. I have asked for the copy and I am going to want it.',
          ),
        ],
      },
      {
        id: 'enid-bench',
        label: 'The bench by the ferry ramp',
        shape: at(0.63, 0.65, 0.24, 0.2),
        cursor: 'talk',
        visibleIf: inAct(4),
        onInteract: [
          when(lacks('cash-book-1974'), [take('cash-book-1974')]),
          when(
            lacks('sundries-memo'),
            [
              say(
                'Enid Charnock',
                'I’m on the 08.15 and I shan’t be coming back, and you needn’t look at me like that.',
                'It was inside the back cover the whole time. Folded in four. I have had it under my hand four hundred times.',
              ),
              take('sundries-memo'),
              clue('clue-sundries-memo'),
              tell(
                'WARDEN’S OFFICE TO CASHIER, 6 NOVEMBER 1974. The Nine Bells oil column is to be carried to Sundry Adjustments (Lights) pending refit.',
                'A. FERRIER. And, in 2H pencil, two millimetres high in the corner: p.p.',
              ),
              think(
                'Three days after the wreck, somebody tidied the hole where the oil should have been into a column nobody reads.',
              ),
            ],
            [speakTo('enid-charnock')],
          ),
        ],
      },
      exit('to-ardent', 'Down to the Ardent', at(0.86, 0.72, 0.14, 0.24), 'the-ardent', {
        cursor: 'walk-right',
      }),
      exit('to-police', 'Up to the police station', at(0.0, 0.36, 0.08, 0.5), 'rossport-police', {
        cursor: 'walk-left',
        visibleIf: inAct(3),
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'rossport-police': {
    id: 'rossport-police',
    name: 'Rossport Police Station',
    subtitle: 'Interview Room 2',
    background: './art/scenes/rossport-police.webp',
    weather: 'none',
    ambience: 'clock-room',
    grade: 'saturate(0.78) brightness(1.04) hue-rotate(6deg)',
    onFirstEnter: [
      think(
        'Breeze block painted magnolia, a tape deck with two slots, and a clock that is ninety seconds fast.',
        'Two officers for four hundred square miles. Whatever I bring in here has to stand up on its own, because nobody in this building has time to hold it up for me.',
      ),
    ],
    hotspots: [
      {
        id: 'iveson',
        label: 'DS Marren Iveson',
        shape: at(0.34, 0.2, 0.3, 0.48),
        cursor: 'talk',
        huntable: true,
        onInteract: [speakTo('marren-iveson')],
      },
      {
        id: 'custody-record',
        label: 'Custody record, 31 October, 17.15',
        shape: at(0.05, 0.36, 0.19, 0.2),
        cursor: 'look',
        visibleIf: inAct(3),
        onInteract: [
          tell(
            'TAIN, Marguerite. DOB 4.6.49. Arrested 17.15 on suspicion of forgery and attempting to pervert the course of justice.',
            'Grounds: report of a forensic examination by the appraiser appointed under s.41, received 16.05 this date.',
          ),
          think(
            'That is my report, in a clerk’s handwriting, in the reasons column of somebody’s arrest.',
            'I would write it again the same way. I would like that to be a comfort and it is not.',
          ),
        ],
      },
      {
        id: 'referral-form',
        label: 'Homicide referral form',
        shape: at(0.28, 0.68, 0.28, 0.16),
        cursor: 'use',
        visibleIf: inAct(5),
        onInteract: [
          when(lacks('referral-form'), [take('referral-form')]),
          think(
            'A grab. A folder taken hold of at both ends. A rail recorded loose on the second of September and made good off the books on the fifteenth.',
            'Eleven minutes before the telephone call. Twenty-nine impressions on the Reprax. A relabelled box.',
            'If I write murder, Pargeter has it apart in four minutes and everything after it goes with it. If I write what the paper says, it stands.',
          ),
        ],
      },
      {
        id: 'exhibits-schedule',
        label: 'Schedule of exhibits',
        shape: at(0.6, 0.66, 0.26, 0.18),
        cursor: 'use',
        enabledIf: has('casebook'),
        blockedEffects: [think('Not without the casebook. The citations are the exhibit.')],
        onInteract: [
          say(
            'DS Iveson',
            'Accession number, custody, and who had it between. Every line.',
            'That’s an inference, that is. Bring me an object.',
          ),
          think(
            'She says it the way other people say good morning, and she is right every time she says it.',
          ),
        ],
      },
      {
        id: 'noticeboard',
        label: 'Station noticeboard',
        shape: at(0.68, 0.16, 0.26, 0.3),
        cursor: 'look',
        onInteract: [
          tell(
            'COASTGUARD BULLETIN. Southwesterly severe gale 9, veering west, storm 10 later. Causeways and low-lying coast roads liable to closure. Telephone subscribers in Cardew, Brannock and Ivory advised of possible interruption.',
          ),
          think(
            'Possible interruption. Somebody in an office in Rossport typed that on Thursday and it is going to cost me the telephone, the police and the road.',
          ),
        ],
      },
      exit('to-quay', 'Back down to the quay', at(0.0, 0.4, 0.09, 0.5), 'rossport-quay', {
        cursor: 'walk-back',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'slipway-and-ritas-shed': {
    id: 'slipway-and-ritas-shed',
    name: 'The Slipway',
    subtitle: "Rita's shed and the head of the causeway",
    background: './art/scenes/slipway-and-ritas-shed.webp',
    weather: 'none',
    ambience: 'harbour',
    layers: [
      {
        id: 'causeway-flood',
        src: './art/scenes/slipway-and-ritas-shed-causeway-flood.webp',
        visibleIf: inAct(4),
        animate: 'drift',
      },
    ],
    onFirstEnter: [
      think(
        'Weed to the ankle on the concrete, an engine in pieces on a sack, and a shed that smells of tar, two-stroke and old rope.',
        'Everything on this headland that actually works is down here.',
      ),
    ],
    hotspots: [
      {
        id: 'ardent-mooring',
        label: 'The Ardent on her mooring',
        shape: at(0.3, 0.34, 0.24, 0.2),
        cursor: 'walk',
        enabledIf: any(untilAct(2), inAct(4)),
        blockedEffects: [
          say(
            'Rita Tain',
            'In that? Sixty mile of southwesterly straight up the Sound and a lee shore all the way home. No.',
            'Ask me again when it’s round to the west, or ask somebody who doesn’t know better.',
          ),
        ],
        onInteract: [
          when(all(inAct(4), lacks('dry-bag')), [take('dry-bag')]),
          goto('the-ardent'),
        ],
      },
      {
        id: 'rita',
        label: 'Rita Tain, working on the engine',
        shape: at(0.55, 0.44, 0.22, 0.34),
        cursor: 'talk',
        huntable: true,
        onInteract: [speakTo('rita-tain')],
      },
      {
        id: 'sallow-boxes',
        label: "Three unopened boxes of Cormac Sallow's effects",
        shape: at(0.72, 0.5, 0.19, 0.22),
        cursor: 'take',
        visibleIf: inAct(3),
        onInteract: [
          when(
            lacks('sallow-r755'),
            [
              say(
                'Rita Tain',
                'I cleared his rooms after the funeral and I never opened them. He tried to tell me something in August and I was too angry to sit still for it.',
                'Go on, then. You’re the one that reads things.',
              ),
              tell(
                'OIL REQUISITION R.755. Nine Bells Beacon. 200 gallons paraffin, urgent.',
                'Stamped across the face: REQUISITION NOT SANCTIONED — REFER WINTER REFIT. Initialled in pencil, and beside the initials, p.p.',
              ),
              take('sallow-r755'),
              clue('clue-sallow-r755'),
              think(
                'A Lamp Superintendent kept his own file copy of a refusal for twenty-four years and then wrote to a national conservancy asking for a stranger.',
                'That is not a grievance. That is a man who knew exactly what he had and knew exactly who he could not give it to.',
              ),
            ],
            [
              think(
                'Boot polish, a shaving mirror, forty years of Lamp Superintendent’s pocket books, and the one refusal he kept where he could reach it.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'fog-signal-book',
        label: 'Fog-signal service book on a nail',
        shape: at(0.86, 0.34, 0.12, 0.2),
        cursor: 'look',
        onInteract: [
          tell(
            'FOG SIGNAL, NINE BELLS. Quarterly service. 1991 — M.T. 1992 — M.T. 1993 — M.T. … September 1998 — M.T., 07.30–15.00, diaphone rebuilt, both compressors run.',
          ),
          think(
            'Every quarter since 1991 in her own initials, on a nail, in a shed she let me stand in.',
            'She goes out to that rock all year round, which makes one thing she told me untrue and one thing she needed to be true: on the fourteenth of September she was nine miles out with a diaphone in bits.',
          ),
        ],
      },
      {
        id: 'davit-scar',
        label: 'The broken davit',
        shape: at(0.13, 0.28, 0.14, 0.24),
        cursor: 'look',
        onInteract: [
          think(
            'Sheared at the bolt and never replaced, only lashed. The paint on the break is 1988 by the colour of it.',
            'She has a white scar through the left eyebrow the same shape as that edge, and she has never once mentioned it, and I am not going to be the one who does.',
          ),
        ],
      },
      exit('causeway-head', 'Head of the causeway', at(0.02, 0.52, 0.16, 0.3), 'cardew-village', {
        cursor: 'walk-left',
        visibleIf: inAct(3),
        enabledIf: untilAct(3),
        blockedEffects: [
          think(
            'Six feet of black water over the crown and the marker posts leaning. Not on foot, not tonight, not ever again this week.',
          ),
        ],
        before: [
          think('Low water. Forty minutes across the tumbled concrete with the weed sucking at it.'),
        ],
      }),
      exit('cliff-steps', 'Up to the cliff path', at(0.88, 0.06, 0.12, 0.3), 'cliff-path-churchyard', {
        cursor: 'walk-right',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'cardew-village': {
    id: 'cardew-village',
    name: 'Cardew Village',
    subtitle: 'One wet street and a post office',
    background: './art/scenes/cardew-village.webp',
    weather: 'heavy-rain',
    ambience: 'heavy-storm',
    layers: [
      {
        id: 'pole-down',
        src: './art/scenes/cardew-village-pole-down.webp',
        visibleIf: inAct(4),
      },
    ],
    onFirstEnter: [
      think(
        'Nine cottages, a shut post office, a pub and a call box, and the rain coming down the street in sheets.',
        'Forty yards. That is the distance from that kiosk to the door of the man who should have been on the rock.',
      ),
    ],
    // Backstop for the Act III turn: the reconciliation is solved up the hill,
    // and the player has to come back down this street afterwards.
    onEnter: [when(all(inAct(3), solved('puz-reconciliation')), [advanceTo(4)])],
    hotspots: [
      {
        id: 'call-box-4471',
        label: 'The call box, Cardew 4471',
        shape: at(0.11, 0.42, 0.16, 0.4),
        cursor: 'look',
        huntable: true,
        onInteract: [
          when(
            knows('clue-switchboard-log'),
            [
              think(
                'Twenty-two forty-one. Four minutes. No reply.',
                'I have stood in here with the door shut and counted it out, and four minutes of ringing is a very long time to stand in a box with your hand on a receiver knowing where he drinks.',
                'She did not ring the pub. The pub is thirty yards further on and it is in the same directory.',
              ),
            ],
            [
              think(
                'Cardew 4471, painted on the enamel above the dial. A public box outside a post office that closed in 1972, on a street with nine houses in it.',
                'Somebody, somewhere, has written this number down for a reason.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'post-office',
        label: 'Cardew sorting office counter',
        shape: at(0.42, 0.36, 0.22, 0.28),
        cursor: 'look',
        onInteract: [
          tell(
            'Notice pasted inside the glass, gone amber: THIS OFFICE WILL CLOSE FOR ALL SORTING PURPOSES ON 30th SEPTEMBER 1972. MAILS TO BE TENDERED AT ROSSPORT.',
          ),
          set('cardew-frank-checked'),
          think(
            'The die is still in the drawer behind the grille, because nobody has ever come for it. Last struck the thirtieth of September 1972.',
            'Which means no envelope franked at Cardew can have been posted in 1975, and I am going to have to say so out loud to a woman who will never forgive me for it.',
          ),
        ],
      },
      {
        id: 'garage-fuel-book',
        label: 'Garage fuel book',
        shape: at(0.68, 0.5, 0.18, 0.2),
        cursor: 'look',
        visibleIf: inAct(4),
        onInteract: [
          tell('14.9.98 — H. PIKE — 4 gall. — 18.20 — acct.'),
          think(
            'Twenty past six in the evening, nine miles from the headland, buying petrol for a van full of empty boxes.',
            'He would rather be a murder suspect for six weeks than tell anybody where he was, because where he was is a rented kitchen with three thousand documents in it.',
          ),
        ],
      },
      {
        id: 'ship-inn',
        label: 'The Ship Inn',
        shape: at(0.75, 0.24, 0.2, 0.26),
        cursor: 'look',
        onInteract: [
          think(
            'Two rooms and a coal fire. The landlord’s father kept it in 1974 and the slate for that November is still in a drawer, because nobody in a village throws away money owed.',
            'Cass Verge was in the back room from nine o’clock. He was in the back room at twenty to eleven. He was in the back room at four minutes past eleven, when the Pelagia went onto the reef nine miles out with a hundred and eighteen people aboard.',
          ),
        ],
      },
      {
        id: 'telephone-pole',
        label: 'The pole at the Cardew turn',
        shape: at(0.88, 0.04, 0.12, 0.44),
        cursor: 'look',
        visibleIf: inAct(4),
        onInteract: [
          sound('thunder'),
          shake(0.4),
          set('line-down'),
          think(
            'Snapped four feet up and lying across the wall with the wires in the hedge. The gale had it about an hour ago.',
            'One. No telephone to Rossport. Two. No telephone to Halkett. Three. No telephone to the police.',
            'Four. There is an Aldis lamp under a tarpaulin on the roof of Pilotage House and a signal station four miles across the water at Rossport, and I do not know the code.',
          ),
        ],
      },
      exit('hill-road', 'The hill road to Pike’s cottage', at(0.3, 0.14, 0.16, 0.24), 'pikes-cottage', {
        cursor: 'walk',
        visibleIf: inAct(3),
        before: [
          when(
            inAct(4),
            [think('There is a light over the hill that is not a window and not a headlamp.')],
            [
              think(
                'Up past the chapel, a Bedford van with the back doors open, and a rented cottage with the curtains shut at four in the afternoon.',
              ),
            ],
          ),
        ],
      }),
      exit('to-causeway', 'Back to the causeway', at(0.0, 0.56, 0.1, 0.34), 'slipway-and-ritas-shed', {
        cursor: 'walk-back',
        enabledIf: untilAct(3),
        blockedEffects: [
          think('The causeway is six feet under and the road round is forty miles. Not tonight.'),
        ],
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'pikes-cottage': {
    id: 'pikes-cottage',
    name: "Pike's Cottage, Cardew",
    subtitle: 'Three thousand documents in a rented kitchen',
    background: './art/scenes/pikes-cottage.webp',
    weather: 'none',
    ambience: 'rain-window',
    layers: [
      {
        id: 'burnt',
        src: './art/scenes/pikes-cottage-burnt.webp',
        visibleIf: inAct(5),
      },
    ],
    onFirstEnter: [
      think(
        'Bundles to the picture rail. Tape, string, and a label on every one in a chief clerk’s hand.',
        'It is the best-kept archive I have seen since I got off the boat, and every single item in it is stolen.',
      ),
    ],
    onEnter: [
      when(all(inAct(3), solved('puz-reconciliation')), [advanceTo(4)]),
    ],
    hotspots: [
      {
        id: 'kitchen-table',
        label: 'The kitchen table under the bare bulb',
        shape: at(0.28, 0.56, 0.4, 0.3),
        cursor: 'puzzle',
        huntable: true,
        visibleIf: untilAct(4),
        onInteract: [
          when(
            unsolved('puz-reconciliation'),
            [
              when(lacks('reconciliation-form'), [take('reconciliation-form')]),
              think(
                'Three books that have never been on the same table, because they were kept in three rooms by three people who each did their job correctly.',
                'Dues collected. Wages paid. Oil drawn. Week by week from the first of July. Do not skip to the end; the end is where you make things up.',
              ),
              puzzle('puz-reconciliation'),
            ],
            [
              clue('clue-reconciliation'),
              think(
                'Ten complete dues weeks. One thousand one hundred and eighty-two vessels. Four thousand one hundred and eighty pounds four shillings, for a light that was not burning.',
                'And two hundred pounds four shillings in wages, over eleven weeks, to a keeper who was not there.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'oil-requisition-book',
        label: 'Oil Requisition Book, Nine Bells 1966–1980',
        shape: at(0.06, 0.48, 0.18, 0.2),
        cursor: 'take',
        visibleIf: untilAct(4),
        onInteract: [
          when(
            lacks('oil-requisition-book'),
            [
              take('oil-requisition-book'),
              clue('clue-oil-requisition-book'),
              tell(
                'R.741, 16 August 1974. R.748, 9 September 1974. R.755, 7 October 1974.',
                'Each stamped REQUISITION NOT SANCTIONED — REFER WINTER REFIT. Each initialled. Each with two millimetres of 2H pencil beside the initials: p.p.',
              ),
              think(
                'Three refusals in eight weeks for a lighthouse with ninety gallons in the store. Nobody refuses oil to a lighthouse. You refuse a paint order. You do not refuse oil.',
              ),
            ],
            [think('Buckram, string ties, and forty years of a fuel account in one hand.')],
          ),
        ],
      },
      {
        id: 'despatch-book',
        label: 'Despatch Book 1970–79 on the dresser',
        shape: at(0.74, 0.34, 0.18, 0.24),
        cursor: 'take',
        visibleIf: untilAct(4),
        onInteract: [
          when(
            lacks('despatch-book'),
            [
              take('despatch-book'),
              clue('clue-despatch-docket'),
              tell(
                'Docket, 16 August 1974. Notices to Mariners for despatch: 74/117, 74/118, 74/119, 74/120.',
                '74/119 is ruled through in 2H pencil, once, cleanly, with a straight edge. Initialled in the margin: p.p.',
                'Foot of the docket, in the same pencil: 214 @ 4d — £3 11s 4d.',
              ),
              think(
                'Somebody ruled a warning out of a despatch list with a ruler. Not torn out. Not burned. Ruled through and initialled, because that is how it is done properly.',
              ),
            ],
            [think('The one book in this house that Pike says he never read, and he is telling the truth.')],
          ),
        ],
      },
      {
        id: 'lights-stores-box',
        label: 'Box marked LIGHTS: STORES 1966–80',
        shape: at(0.05, 0.72, 0.18, 0.18),
        cursor: 'take',
        visibleIf: untilAct(4),
        onInteract: [
          when(
            lacks('lamp-report-15aug'),
            [
              take('lamp-report-15aug'),
              clue('clue-lamp-report-15aug'),
              tell(
                'LAMP SUPERINTENDENT’S REPORT, 15 August 1974. C. SALLOW.',
                'No. 2 vaporiser cracked at the jet on inspection of the 9th inst. Reserve oil ninety gallons. In my opinion the light cannot be relied upon beyond the end of the month.',
              ),
              think(
                'He said it in writing on the fifteenth of August, in a report with a number on it, and it has been in a cardboard box in a rented kitchen for thirteen years because it was filed under Lights and Halvard Pike is a Pilotage man.',
              ),
            ],
            [think('He carried it out of the building in 1985 and never once opened the lid.')],
          ),
        ],
      },
      {
        id: 'tide-table-catalogue',
        label: 'Catalogue on the backs of tide-table covers',
        shape: at(0.72, 0.6, 0.2, 0.2),
        cursor: 'look',
        visibleIf: untilAct(4),
        onInteract: [
          think(
            'Forty years of theft, indexed. Shelf-mark, date removed, condition, and a column headed WHY, which is filled in on every line.',
            'Circular 12/85. Circular 12/85. Circular 12/85. The Ministry ordered the Lights records destroyed on transfer and he put them in a van instead.',
            'The Board will call this a chain-of-custody attack on half my exhibits. They will be right, and without it there would be no exhibits at all.',
          ),
        ],
      },
      {
        id: 'pike',
        label: 'Halvard Pike',
        shape: at(0.45, 0.26, 0.2, 0.34),
        cursor: 'talk',
        visibleIf: untilAct(4),
        onInteract: [speakTo('halvard-pike')],
      },
      {
        id: 'paraffin-heater',
        label: 'The paraffin heater',
        shape: at(0.2, 0.7, 0.14, 0.16),
        cursor: 'look',
        visibleIf: untilAct(4),
        onInteract: [
          think(
            'Wick untrimmed, tank filled to the neck, and a bundle of 1958 pilotage licences eighteen inches from the grille.',
            'I am not going to say anything about it, and I am going to think about it every time I walk out of this room.',
          ),
        ],
      },
      {
        id: 'burnt-shell',
        label: 'What is left of the kitchen',
        shape: at(0.24, 0.44, 0.46, 0.42),
        cursor: 'look',
        visibleIf: inAct(5),
        onInteract: [
          think(
            'Slates down, the dresser standing, and the table with four inches of black water on it.',
            'Four bundles out through the scullery window and five left where they were. I know which five. I will know which five for the rest of my life.',
            'He asked me, in the ambulance, whether I had got the wreck registers. I had. He said good, and went back to sleep.',
          ),
        ],
      },
      exit('to-village', 'Down the hill road', at(0.0, 0.62, 0.1, 0.32), 'cardew-village', {
        cursor: 'walk-back',
      }),
    ],
  },
};
