/**
 * Brannock Head, out of doors.
 *
 * The cliff path is the spine of the map and the game's weather gauge: every
 * act it looks worse, and in Act V it is where the light is seen from. The
 * courtyard is the crime scene of Act I, the lamp room is Rita's kingdom, and
 * the roof is where a nineteen-year-old signals four miles of black water
 * because the gale has taken the telephone.
 */

import type { Scene, SceneId } from '@/engine/types';
import {
  at,
  clue,
  exit,
  flagged,
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
  tell,
  think,
  unsolved,
  untilAct,
  when,
} from './util';

export const headlandScenes: Record<SceneId, Scene> = {
  // -------------------------------------------------------------------------
  'cliff-path-churchyard': {
    id: 'cliff-path-churchyard',
    name: "The Cliff Path and St Bride's",
    subtitle: 'Thirty-one slate markers along a drystone wall',
    background: './art/scenes/cliff-path-churchyard.webp',
    weather: 'none',
    ambience: 'wind-moor',
    layers: [
      {
        id: 'storm',
        src: './art/scenes/cliff-path-churchyard-storm.webp',
        visibleIf: inAct(4, 4),
        animate: 'drift',
      },
      {
        id: 'beacon-lit',
        src: './art/scenes/cliff-path-churchyard-beacon-lit.webp',
        visibleIf: solved('puz-the-optic'),
        blend: 'screen',
        animate: 'pulse',
      },
    ],
    onFirstEnter: [
      think(
        'The wind comes over the wall in one continuous push and the grass all lies the same way, like hair.',
        'Thirty-one slates. I counted them walking up, because counting is what I do instead of looking away.',
      ),
    ],
    hotspots: [
      {
        id: 'thirty-one-slates',
        label: 'Thirty-one slate markers',
        shape: at(0.36, 0.42, 0.22, 0.2),
        cursor: 'look',
        huntable: true,
        onInteract: [
          tell(
            'HALLORAN, B., 41. HALLORAN, T., 9. KESTELL, MARY, 63. ODGERS, W., 22. VERRAN, A., 17. …',
            'Eleven days of November 1974, cut by the same hand, in the same slate, from the same quarry, at the same price.',
          ),
          when(
            knows('clue-kestrel-mandate'),
            [
              think(
                'Halloran. Kestell. Odgers. Verran. I have read all of these initials this week in a bank mandate, in a column headed monthly, index-linked.',
                'Thirty of them are on this wall. The thirty-first is alive and mending an engine at the slipway.',
              ),
            ],
            [
              think(
                'Nobody has a family plot here. They were buried in the order they came ashore, which is not an order anybody chose.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'tain-marker',
        label: 'The marker with no dates',
        shape: at(0.18, 0.46, 0.17, 0.38),
        cursor: 'look',
        onInteract: [
          tell('EMRYS TAIN. PILOT.'),
          think(
            'Set eighteen inches out from the row and turned very slightly away from it, which is either the mason or the parish and I know which one I think it is.',
            'No dates. No text. Somebody paid for two words and would not pay for more, and his daughter has spent twenty-four years and every penny she owns on the rest of the sentence.',
          ),
        ],
      },
      {
        id: 'sallow-grave',
        label: 'Fresh turf, September 1998',
        shape: at(0.52, 0.56, 0.16, 0.2),
        cursor: 'look',
        onInteract: [
          think(
            'Six weeks in. The turf has taken at the edges and sunk an inch in the middle, and the flowers have gone over in their cellophane with the price still on it.',
            'CORMAC SALLOW, 1919–1998, LAMP SUPERINTENDENT. He wrote a letter on the eleventh of September asking for a stranger, and the stranger is me, and I am four weeks too late to ask him a single question.',
          ),
        ],
      },
      {
        id: 'headland-view',
        label: 'The headland edge',
        shape: at(0.66, 0.3, 0.32, 0.24),
        cursor: 'look',
        onInteract: [
          when(
            solved('puz-the-optic'),
            [
              think(
                'Nine miles out, in the dark, on the anniversary: one. Two. Three. And then sixteen seconds of nothing at all.',
                'Fl(3) W 20s. Nobody on this coast needs it explained to them.',
              ),
            ],
            [
              when(
                inAct(4),
                [
                  think(
                    'Storm ten. The spray is coming over the top of the cliff and landing on the churchyard grass, sixty feet up.',
                    'The rock is out there somewhere behind all that white and I am going to have to go to it.',
                  ),
                ],
                [
                  think(
                    'Nine miles, and on a still grey day you can just make it out: a black upright thing on a reef with nothing on top of it.',
                    'It has been dark since the twenty-fourth of August 1974 and there is not one document in that building which says so.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: 'lychgate',
        label: 'The lychgate and burial register',
        shape: at(0.08, 0.1, 0.14, 0.26),
        cursor: 'look',
        onInteract: [
          tell(
            'Register of Burials, St Bride’s. 6 Nov 1974 … 7 Nov … 8 Nov … 11 Nov … 16 Nov 1974.',
            'Thirty-one interments in eleven days, in a curate’s hand that starts copperplate and ends in a scrawl with the ink pressed through the paper.',
          ),
          think(
            'You can see him getting tired. By the ninth of November he has stopped writing the ages in.',
          ),
        ],
      },
      exit('path-to-house', 'The path to Pilotage House', at(0.44, 0.18, 0.14, 0.18), 'entrance-hall', {
        cursor: 'walk',
      }),
      exit('side-gate', 'The courtyard side gate', at(0.58, 0.2, 0.1, 0.18), 'courtyard-and-site-hut', {
        cursor: 'walk',
        enabledIf: untilAct(3),
        blockedEffects: [
          think('Chained, and a scaffold board wired across it. Round by the front, then, in this.'),
        ],
      }),
      exit('down-to-slipway', 'Down to the slipway', at(0.0, 0.7, 0.12, 0.3), 'slipway-and-ritas-shed', {
        cursor: 'walk-left',
      }),
      exit('along-headland', 'Along the headland to Brannock House', at(0.86, 0.5, 0.14, 0.24), 'brannock-house', {
        cursor: 'walk-right',
        visibleIf: inAct(3),
      }),
      exit('coastguard-row', 'Coastguard Row', at(0.86, 0.72, 0.14, 0.22), 'ottolines-cottage', {
        cursor: 'walk-right',
        visibleIf: inAct(4),
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'brannock-house': {
    id: 'brannock-house',
    name: 'Brannock House',
    subtitle: 'The old sickroom',
    background: './art/scenes/brannock-house.webp',
    weather: 'none',
    ambience: 'rain-window',
    grade: 'saturate(0.86)',
    onFirstEnter: [
      think(
        'The Warden’s residence, and this was the room they put him in, because it is on the first floor and the window looks at the sea.',
        'Now it holds forty litres of magnolia emulsion and a folded invalid chair under a sheet.',
      ),
    ],
    hotspots: [
      {
        id: 'nurse-ledger',
        label: "Nurse Kilbride's visit ledger, 1974",
        shape: at(0.59, 0.7, 0.13, 0.13),
        cursor: 'take',
        huntable: true,
        onInteract: [
          when(
            lacks('nurse-kilbride-ledger'),
            [
              take('nurse-kilbride-ledger'),
              clue('clue-nurse-ledger'),
              tell(
                '12.8.74 — Brannock Hse — pt. hemiplegic R side, no speech, cannot hold pen, wife present. Bed bath. Dr Munn attending.',
                '14.8.74 — no change. 19.8.74 — no change. 2.9.74 — no change, pt. distressed p.m.',
              ),
              think(
                'A district nurse wrote cannot hold pen in a ledger on the twelfth of August 1974 because that is the sort of thing you write down about a patient.',
                'And for the next ninety-nine days that man signed forty-one documents.',
              ),
            ],
            [
              think(
                'It was in a box of household bills with a bundle of coal receipts on top of it, four feet from a skip.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'bed-outline',
        label: 'The unfaded rectangle on the wallpaper',
        shape: at(0.2, 0.28, 0.28, 0.3),
        cursor: 'look',
        onInteract: [
          think(
            'Six foot three by three foot, bright rose against twenty years of faded rose, with four small dents in the boards at the corners.',
            'A bed stood there for two years and two months. You do not get a mark like that in a fortnight, and you do not get it at all if the man in it went back to work.',
          ),
        ],
      },
      {
        id: 'paint-store',
        label: "Contractor's paint and dust sheets",
        shape: at(0.74, 0.55, 0.25, 0.4),
        cursor: 'look',
        onInteract: [
          think(
            'Sandbach’s men have been storing emulsion in a dead Warden’s sickroom since September, and the only reason that ledger still exists is that the box was heavy and the skip was down two flights.',
            'Three independent proofs of incapacity, and one of them survived because nobody could be bothered to carry it downstairs.',
          ),
        ],
      },
      {
        id: 'commode-chair',
        label: 'Invalid chair under a sheet',
        shape: at(0.11, 0.52, 0.09, 0.36),
        cursor: 'look',
        onInteract: [
          think(
            'Wicker back, cane seat gone through, a strap for the right arm and none for the left.',
            'Hemiplegic, right side. They strapped the side that could not hold itself up, and the side that could was the one that would have held the pen.',
          ),
        ],
      },
      {
        id: 'medical-file-box',
        label: 'Box of household bills',
        shape: at(0.36, 0.66, 0.22, 0.2),
        cursor: 'look',
        onInteract: [
          when(
            has('munn-mileage-claims'),
            [
              clue('clue-locum-mileage'),
              think(
                'Munn’s mileage claims and Kilbride’s ledger, laid side by side on a paint tin.',
                'Fourteen miles, twice weekly, first claimed for the twelfth of August. First nursing visit, the twelfth of August. Two people paid by two different budgets wrote down the same date without ever discussing it.',
                'That is not a claim any more. That is a fact.',
              ),
            ],
            [
              think(
                'Coal, milk, a chimney sweep, and a district nurse’s ledger somebody used as a stiffener.',
                'I need Munn’s mileage claims out of Accounts before this is worth anything. One source is a claim. Two that never met are a fact.',
              ),
            ],
          ),
        ],
      },
      exit('down-and-out', 'Back to the cliff path', at(0.0, 0.6, 0.11, 0.36), 'cliff-path-churchyard', {
        cursor: 'walk-back',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'ottolines-cottage': {
    id: 'ottolines-cottage',
    name: "Ottoline's Cottage",
    subtitle: '4 Coastguard Row',
    background: './art/scenes/ottolines-cottage.webp',
    weather: 'none',
    ambience: 'fire-crackle',
    grade: 'saturate(1.06)',
    enterIf: inAct(4),
    onFirstEnter: [
      think(
        'A fire, a fringed lamp, and a cup of tea put into my hands before I had my coat off.',
        'This is the warmest room I have been in for nine days and I have come here to take it apart.',
      ),
    ],
    hotspots: [
      {
        id: 'biscuit-tin',
        label: 'The biscuit tin on the dresser',
        shape: at(0.52, 0.32, 0.09, 0.09),
        cursor: 'take',
        huntable: true,
        onInteract: [
          // Guarded on the tin, not the letter. Ottoline's Act IV tree can hand
          // over the deferment letter in conversation, and keying this on the
          // letter meant that doing so first closed the only route to the tin
          // itself. `giveItem` already no-ops for anything held, so granting
          // all three here is safe whichever way round the player gets there.
          when(
            lacks('biscuit-tin'),
            [
              say(
                'Ottoline Verge',
                'It’s in the tin, dear. It has been in the tin since the August. Fetch it down, I can’t reach the dresser now.',
              ),
              take('biscuit-tin'),
              take('deferment-letter'),
              clue('clue-deferment-letter'),
              tell(
                'WARDEN’S OFFICE, 18 August 1974. To Mr C. Verge, relief keeper.',
                'Your autumn residence at the Nine Bells is deferred until further notice. Your wages will continue to be paid at the full rate. You will not discuss this instruction.',
                'A. FERRIER. And in the corner, two millimetres of 2H pencil: p.p.',
              ),
              think(
                'Wages to continue, and you will not discuss this. Two clauses, and the second one bought twenty-four years.',
              ),
            ],
            [think('An Osborne’s Assorted tin from about 1970, with a rubber band round it.')],
          ),
        ],
      },
      {
        id: 'ottoline',
        label: 'Ottoline Verge',
        shape: at(0.86, 0.64, 0.14, 0.34),
        cursor: 'talk',
        onInteract: [speakTo('ottoline-verge')],
      },
      {
        id: 'wedding-photograph',
        label: 'Photograph on the mantelpiece, 1968',
        shape: at(0.36, 0.03, 0.06, 0.25),
        cursor: 'look',
        onInteract: [
          think(
            'Cass Verge in keeper’s uniform outside a registry office, squinting, with his cap in his hand and his hair flattened by it.',
            'Eleven weeks of wages for a man who was not on the rock, and then seven years of him in the back room of the Ship Inn, and then a stone in the row at St Bride’s with dates on it.',
          ),
        ],
      },
      {
        id: 'naval-college-letter',
        label: 'Letter from Ilberry naval college',
        shape: at(0.58, 0.52, 0.16, 0.14),
        cursor: 'look',
        onInteract: [
          tell(
            'Dear Mrs Verge, I am pleased to inform you that your grandson Emlyn has been placed second in his year …',
          ),
          think(
            'Propped against the clock where she can see it from the chair. Second in his year, and the fees paid by a standing order she has never once queried.',
            'She kept quiet twenty-four years longer than she needed to, and this is the reason, and it is sitting on the mantelpiece in an envelope she has opened and refolded until the crease is furry.',
          ),
        ],
      },
      {
        id: 'knitting-chair',
        label: 'The chair by the range',
        shape: at(0.78, 0.32, 0.15, 0.3),
        cursor: 'look',
        onInteract: [
          think(
            'A cardigan over the back, a handkerchief folded into four on the arm, and a rubber thimble on the ledge.',
            'The same three objects, in the same three positions, as her chair in the Rolls Room. Eight hundred yards away and identical, which means she was never at work and never at home; she was only ever exactly here.',
          ),
        ],
      },
      exit('out-to-row', 'Out onto Coastguard Row', at(0.0, 0.62, 0.1, 0.34), 'cliff-path-churchyard', {
        cursor: 'walk-back',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'courtyard-and-site-hut': {
    id: 'courtyard-and-site-hut',
    name: 'The Courtyard',
    subtitle: 'Incinerator and site hut',
    background: './art/scenes/courtyard-and-site-hut.webp',
    weather: 'heavy-rain',
    ambience: 'heavy-storm',
    layers: [
      {
        id: 'strip-out',
        src: './art/scenes/courtyard-and-site-hut-strip-out.webp',
        visibleIf: inAct(3),
      },
    ],
    onFirstEnter: [
      think(
        'Twenty past one in the morning, a coat over my nightdress, and the courtyard empty.',
        'Somebody has been burning paper in the rain, which is the single most incompetent way to destroy a document there is.',
      ),
    ],
    hotspots: [
      {
        id: 'incinerator',
        label: "The incinerator's iron mouth",
        shape: at(0.24, 0.44, 0.26, 0.34),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            unsolved('puz-ash-grate'),
            [
              when(lacks('ash-fragments'), [take('ash-fragments')]),
              think(
                'Cold water. Nothing warm, nothing quick. It has already been on fire once.',
                'Float them off the brick one at a time and get them upstairs between blotters before the morning dries them onto the iron.',
              ),
              puzzle('puz-ash-grate'),
            ],
            [
              think(
                'Raked out, floated off and carried up. Whatever was in this grate is on my bench now, and whoever put it here is still in this building.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'site-diary',
        label: "Sandbach's site diary in the hut",
        shape: at(0.68, 0.42, 0.2, 0.2),
        cursor: 'look',
        onInteract: [
          when(
            inAct(4),
            [
              when(lacks('site-diary'), [take('site-diary')]),
              clue('clue-site-diary-rail'),
              tell(
                'Item 41, 2 Sept: chimney damper removed to incinerator, flue to be relined.',
                'Item 63, 15 Sept: gallery rail nth bay made good at Warden’s personal instruction. Out of programme. No order no. Not billed.',
              ),
              think(
                'The morning after a man went over that rail, it was quietly repaired by a contractor who was not asked to invoice for it.',
                'This is the one daily record in this building that she does not control, and it is kept by a man who is stealing brass, which is exactly why it is honest.',
              ),
            ],
            [
              clue('clue-incinerator-damper'),
              tell('Item 41, 2 September: chimney damper removed to incinerator, flue to be relined.'),
              think(
                'So the flue has not drawn since the second of September, and the rain comes straight down the open head onto the grate.',
                'Anybody who has burned anything in that thing in the last eight weeks has burned it badly, and has no idea.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'strip-out-programme',
        label: 'Strip-out programme pinned to the hut wall',
        shape: at(0.68, 0.62, 0.2, 0.18),
        cursor: 'look',
        onInteract: [
          tell(
            'W/C 26 OCT: undercroft, north bays, LOT 4. 30 OCT: chart loft, survey racks. 31 OCT: rolls room, card index — SKIP. 2 NOV: strongroom, clear to floor.',
          ),
          think(
            'Skip, against the card index. Sixty thousand cards in four hundred drawers, and the word is skip.',
            'He is not doing it to hide anything. He is doing it because a skip costs eleven pounds and a crate costs sixty, and that is how archives actually die.',
          ),
        ],
      },
      {
        id: 'sandbach',
        label: 'Ivo Sandbach',
        shape: at(0.5, 0.38, 0.11, 0.34),
        cursor: 'talk',
        onInteract: [speakTo('ivo-sandbach')],
      },
      {
        id: 'scaffold-lift',
        label: 'Scaffold deck and crowbar',
        shape: at(0.62, 0.4, 0.06, 0.33),
        cursor: 'take',
        onInteract: [
          when(
            lacks('crowbar'),
            [
              take('crowbar'),
              take('hooded-torch'),
              think(
                'A four-foot wrecking bar and a hooded inspection torch off the deck, both of which belong to a man I am about to accuse of something.',
                'I will put them back. I will write down that I took them, and when.',
              ),
            ],
            [
              think(
                'The deck runs up past the second-floor windows to the leads. If the internal stair gets boarded, this is the way to the roof.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'ash-grate',
        label: 'The ash grate, 30 October',
        shape: at(0.3, 0.72, 0.2, 0.16),
        cursor: 'look',
        visibleIf: inAct(3),
        onInteract: [
          when(
            lacks('cash-book-1974'),
            [
              say(
                'Enid Charnock',
                'It won’t take. I’ve been at it forty minutes and it won’t take.',
                'I only ever did what I was told, and I have the paper to prove it, and that is the worst part.',
              ),
              take('cash-book-1974'),
              clue('clue-sundries-column'),
              think(
                'Sixty-three years old, in a coat over her nightdress, feeding a cash book into a fire in the rain at ten to eleven at night.',
                'She gave it to me with both hands and then would not say another word for two days.',
              ),
            ],
            [
              think(
                'Wet ash, and the corner of a buckram binding that would not catch. Nothing burns in this yard. Nothing has since the second of September.',
              ),
            ],
          ),
        ],
      },
      exit('to-hall', 'In at the back door', at(0.42, 0.16, 0.12, 0.2), 'entrance-hall', {
        cursor: 'walk',
      }),
      exit('to-cliff', 'Out through the side gate', at(0.9, 0.24, 0.1, 0.3), 'cliff-path-churchyard', {
        cursor: 'walk-right',
      }),
      exit('to-undercroft', 'Down the area steps', at(0.14, 0.76, 0.14, 0.2), 'undercroft', {
        cursor: 'walk',
        visibleIf: inAct(2),
      }),
      exit('to-lamp-room', 'The lamp room', at(0.56, 0.2, 0.1, 0.18), 'lamp-room', {
        cursor: 'walk',
        visibleIf: inAct(2),
      }),
      exit('to-post-room', 'The post room passage', at(0.34, 0.2, 0.08, 0.18), 'post-room', {
        cursor: 'walk',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'lamp-room': {
    id: 'lamp-room',
    name: 'The Lamp Room',
    subtitle: 'Dismounted optics and a crate for Antwerp',
    background: './art/scenes/lamp-room.webp',
    weather: 'none',
    ambience: 'wind-moor',
    enterIf: inAct(2),
    onFirstEnter: [
      think(
        'A metre of prismatic glass in a timber cradle, throwing bits of spectrum onto a granite floor from one dusty window.',
        'It is the only colour in this building and it is coming out of a machine nobody has switched on since 1974.',
      ),
    ],
    hotspots: [
      {
        id: 'deakin-letter',
        label: "Rita's campaign file",
        shape: at(0.64, 0.42, 0.13, 0.16),
        cursor: 'take',
        huntable: true,
        onInteract: [
          when(
            lacks('deakin-letter'),
            [
              say(
                'Rita Tain',
                'There. 4 March 1975. Crewman off the Pelagia, wrote it to my mother and she never showed a soul.',
                'The light was out. They all knew. They were told to keep their mouths shut. Now what are you going to do about it?',
              ),
              take('deakin-letter'),
              clue('clue-deakin-letter'),
              think(
                'It says everything I have started to believe, in one page, signed, dated, and posted.',
                'Which is why I have to take it apart before I can cite it, and she is standing right there.',
              ),
            ],
            [
              think(
                'Nine years of pamphlets, four refusals of legal aid, and a defamation writ from a retired assessor, all in one box file with a rubber band round it.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'adler-locker',
        label: "Rita's locker",
        shape: at(0.17, 0.35, 0.09, 0.28),
        cursor: 'look',
        visibleIf: inAct(3),
        onInteract: [
          set('adler-found'),
          tell('An Adler Gabriele portable, black case, nylon ribbon, under two oilskins and a bag of shackles.'),
          think(
            'Nylon ribbon. Sharp-edged strike, no fibrous halo.',
            'The Deakin letter has a sharp-edged strike and no fibrous halo, and nylon was not sold for this machine until 1979, and the letter is dated 1975.',
            'I did not need this. I had the watermark and the frank. I have it anyway, and I will write it down, because leaving out the third one because it hurts is exactly the thing I keep telling everybody not to do.',
          ),
        ],
      },
      {
        id: 'dismounted-optics',
        label: 'Dismounted Fresnel panels',
        shape: at(0.42, 0.2, 0.2, 0.5),
        cursor: 'look',
        onInteract: [
          think(
            'Schedule of condition says eight panels in six crates. There are six panels in six crates.',
            'Prismatic crown glass, ground in 1908, and you can put your eye to it and watch a grey window turn into a spectrum.',
          ),
        ],
      },
      {
        id: 'sandbach-crate',
        label: 'Packing crate addressed to Antwerp',
        shape: at(0.78, 0.56, 0.21, 0.36),
        cursor: 'look',
        visibleIf: inAct(3),
        onInteract: [
          when(
            inAct(5),
            [
              when(lacks('fresnel-panel'), [take('fresnel-panel')]),
              say(
                'Ivo Sandbach',
                'Bought it back off the agent at four this morning. Cash. Don’t ask me what with.',
                'It’s wrapped in a fleece in the back of the van. Take it and don’t make a thing of it.',
              ),
              think(
                'Fourteen thousand pounds he has not got, for a piece of glass that pays him nothing, so that a lighthouse he is dismantling can be lit once.',
                'It is the only decent thing he does in nine days and it is enough.',
              ),
            ],
            [
              tell(
                'Two Fresnel panels, the Ardent’s spare binnacle, and a hundred and forty kilos of dismounted brass. Consigned: DE KEYSER & ZN, ANTWERPEN.',
              ),
              think(
                'Two in the morning, a hooded torch and a crowbar, and I have him in the right room on the right night.',
                'He is stealing brass. He is guilty of exactly what he looks guilty of, at about thirty thousand pounds, and of nothing else in this building whatsoever, and it is going to take me eighteen hours to understand that.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'superintendents-frame',
        label: "The Lamp Superintendents' frame",
        shape: at(0.75, 0.02, 0.11, 0.24),
        cursor: 'look',
        onInteract: [
          think(
            'Nine small oval photographs in one frame, and the last one painted rather than photographed, 1979, against a dark ground.',
            'C. SALLOW, LAMP SUPERINTENDENT 1958–1984. Patient, faintly amused, and waiting for me to catch up.',
          ),
        ],
      },
      {
        id: 'sector-plates',
        label: 'Brass occulting sector plates',
        shape: at(0.42, 0.72, 0.16, 0.16),
        cursor: 'take',
        visibleIf: inAct(5),
        onInteract: [
          when(
            lacks('sector-plates'),
            [
              take('sector-plates'),
              think(
                'Three brass plates, curved, slotted, and machined in 1908 to be set round a drum by hand.',
                'This is what a light’s character physically is. Not a number in a book. Three pieces of brass at nought, thirty-six and seventy-two degrees.',
              ),
            ],
            [think('Wrapped in a duster in the bottom of my bag, with the dividers.')],
          ),
        ],
      },
      exit('to-courtyard', 'Out into the courtyard', at(0.0, 0.56, 0.1, 0.4), 'courtyard-and-site-hut', {
        cursor: 'walk-back',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'pilotage-roof': {
    id: 'pilotage-roof',
    name: 'The Roof and Signal Mast',
    subtitle: 'Lead walk behind the parapet',
    background: './art/scenes/pilotage-roof.webp',
    weather: 'heavy-rain',
    ambience: 'heavy-storm',
    enterIf: inAct(4),
    layers: [
      {
        id: 'beam',
        src: './art/scenes/pilotage-roof-beam.webp',
        visibleIf: flagged('aldis-signalled'),
        blend: 'screen',
        animate: 'flicker',
      },
    ],
    onFirstEnter: [
      think(
        'Storm ten across a lead walk eighteen inches wide, and the rain going past horizontally in the floodlight from the yard.',
        'One. The line is down. Two. There is no ferry. Three. The causeway is under six feet of water.',
        'Four. Rossport signal station is four miles that way and somebody is sitting in it.',
      ),
    ],
    hotspots: [
      {
        id: 'aldis-lamp',
        label: 'Aldis lamp under a tarpaulin',
        shape: at(0.64, 0.49, 0.13, 0.29),
        cursor: 'use',
        huntable: true,
        enabledIf: has('signal-book'),
        blockedEffects: [
          think('I do not know the code. Not one letter of it. The Signal Book first, and no guessing.'),
        ],
        onInteract: [
          when(lacks('aldis-lamp'), [take('aldis-lamp')]),
          sound('click-brass'),
          think(
            'Trigger shutter, brass barrel, and a filament that has not been lit since about 1969.',
            'Dot dot dash. Dash dot dot. Slower. Slower than feels sensible, because a man four miles away is reading it through rain on a window.',
          ),
          tell(
            'Four miles across black water, a small yellow light answers: dash dot dash. K. Go ahead.',
          ),
          set('aldis-signalled'),
          think(
            'PILOTAGE HOUSE TO ROSSPORT. LINE DOWN. INFORM POLICE. APPRAISER SAFE. REQUIRE BOAT AT FIRST LIGHT.',
            'Eleven minutes to send forty characters, and I got the F wrong twice, and it does not matter, because he read it back.',
          ),
        ],
      },
      {
        id: 'signal-book',
        label: 'The Signal Book',
        shape: at(0.655, 0.79, 0.13, 0.15),
        cursor: 'take',
        onInteract: [
          when(
            lacks('signal-book'),
            [
              take('signal-book'),
              think(
                'International Code, 1969 edition, in a tin box wired to the mast foot, dry inside.',
                'Somebody bolted this here when the mast went up and nobody has opened it since, and tonight it is the most useful object on this headland.',
              ),
            ],
            [think('Held open against my chest with the pages going over in the wind, one letter at a time.')],
          ),
        ],
      },
      {
        id: 'signal-mast',
        label: 'The signal mast and halyards',
        shape: at(0.66, 0.0, 0.11, 0.45),
        cursor: 'use',
        onInteract: [
          sound('latch'),
          think(
            'A black canvas cone, point down, run up to the crosstrees on a halyard that tries to take the skin off my hands.',
            'Southwesterly gale. Anybody on this coast who can see this roof now knows the causeway is shut, which is the entire content of a hundred and eighty-seven years of this Authority in one piece of canvas.',
          ),
        ],
      },
      {
        id: 'parapet-view',
        label: 'The parapet',
        shape: at(0.22, 0.62, 0.27, 0.28),
        cursor: 'look',
        onInteract: [
          think(
            'The whole map from above: the courtyard with the hut light on, the churchyard wall, the causeway gone entirely, and nine miles of black nothing where the beacon is.',
            'From up here you can see that this building was put on this headland to watch the sea, and that at some point in the last hundred years it turned round and started watching its own paperwork instead.',
          ),
        ],
      },
      {
        id: 'lead-flashing',
        label: 'Lifted lead flashing',
        shape: at(0.53, 0.8, 0.12, 0.17),
        cursor: 'look',
        onInteract: [
          think(
            'Lifted along nine feet of the valley gutter and never dressed back down, and directly below it, two floors down, is the Long Registry clerestory.',
            'That is where the rain has been getting in all along. No conspiracy. No hand. Just a building dying quietly on its own account while everybody in it argues about who signed what in 1974.',
          ),
        ],
      },
      exit('roof-hatch', 'Down the hatch to the chart loft', at(0.02, 0.72, 0.16, 0.24), 'chart-loft', {
        cursor: 'walk-back',
      }),
    ],
  },
};
