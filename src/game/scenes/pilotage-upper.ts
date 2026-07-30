/**
 * Pilotage House: the first floor and the roof space.
 *
 * The offices where the four typewriters live, the card index that is more
 * honest than the archive it describes, the bench Wren commandeers, the light
 * table where the world doubles, the gallery a man went over, and the room
 * where all of it has to survive Mr Pargeter.
 */

import type { Scene, SceneId } from '@/engine/types';
import {
  all,
  any,
  at,
  clue,
  doneTask,
  exit,
  flagged,
  has,
  inAct,
  knows,
  lacks,
  not,
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
  when,
} from './util';

export const pilotageUpperScenes: Record<SceneId, Scene> = {
  // -------------------------------------------------------------------------
  'rolls-room': {
    id: 'rolls-room',
    name: 'The Rolls Room',
    subtitle: 'Four hundred drawers, sixty thousand cards',
    background: './art/scenes/rolls-room.webp',
    weather: 'none',
    ambience: 'clock-room',
    grade: 'saturate(1.05)',
    layers: [
      {
        id: 'boxed',
        src: './art/scenes/rolls-room-boxed.webp',
        visibleIf: inAct(4),
      },
    ],
    onFirstEnter: [
      think(
        'A wall of small oak drawers to the ceiling, every one with a brass label holder, and the whole thing glittering like a wet street.',
        'Sixty thousand cards. Somebody has dusted the brass this week.',
      ),
    ],
    hotspots: [
      {
        id: 'drawers-214-216',
        label: 'Card index drawers 214–216',
        shape: at(0.3, 0.4, 0.24, 0.2),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            unsolved('puz-forty-seven-cards'),
            [
              think(
                'Weeding a file is an afternoon. Weeding an index is a fortnight, so nobody ever does the index.',
                'Sort by the object, not the words. Stock, ribbon, typeface. The words are what somebody wanted me to read.',
              ),
              puzzle('puz-forty-seven-cards'),
            ],
            [
              clue('clue-index-gap'),
              think(
                'Forty-seven cards on white wove stock not made before 1987, every one typed on the Underwood standing four feet from Mrs Verge’s chair.',
                'Seven accession numbers that exist as cards and do not exist as paper. That is not an error. That is an event, and I have its shopping list.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'underwood',
        label: 'Underwood 5, 1928',
        shape: at(0.62, 0.52, 0.16, 0.18),
        cursor: 'use',
        onInteract: [
          when(lacks('specimen-sheets'), [take('specimen-sheets')]),
          set('specimen-underwood'),
          sound('typewriter'),
          think(
            'Specimen line, card 7, twice.',
            'Lower-case e riding three tenths of a millimetre above the baseline on every strike, and a 3 that wanders left. Machine two.',
          ),
        ],
      },
      {
        id: 'drawer-388',
        label: 'Drawer 388',
        shape: at(0.16, 0.34, 0.12, 0.14),
        cursor: 'look',
        onInteract: [
          think(
            'A kettle, a tin of arrowroot biscuits, a folded tea towel and a pair of sheepskin slippers, in a drawer of a national record.',
            'She was so pleased to show me that I laughed, and she laughed, and I have not been able to make myself write it in the condition survey.',
          ),
        ],
      },
      {
        id: 'ottoline-desk',
        label: 'Ottoline Verge at her desk',
        shape: at(0.72, 0.34, 0.2, 0.36),
        cursor: 'talk',
        onInteract: [speakTo('ottoline-verge')],
      },
      {
        id: 'card-stock-samples',
        label: "Manufacturer's card stock samples",
        shape: at(0.06, 0.5, 0.14, 0.16),
        cursor: 'look',
        onInteract: [
          tell(
            'WIGGINS TEAPE, INDEX BOARD. Buff ribbed laid, disc. 1974. White smooth wove, first delivery March 1987.',
          ),
          think(
            'You can feel it before you can see it: the laid has a tooth to it and the wove is dead flat under the thumb.',
            'Nothing in these drawers should be on wove. Every card in here was typed before 1974 and stock does not travel backwards in time.',
          ),
        ],
      },
      {
        id: 'rolls-returns',
        label: 'Rolls returns, 1974',
        shape: at(0.44, 0.62, 0.18, 0.16),
        cursor: 'look',
        onInteract: [
          tell('Q1 1974 — O.V. Q2 1974 — O.V. Q3 1974 — O.V. Q4 1974 — O.V.'),
          think(
            'She told me twice, kindly, that she was in Accounts in those days and had nothing to do with the Rolls.',
            'Her initials are on all four quarters of 1974, in her own hand, in a book she files herself.',
          ),
        ],
      },
      exit('to-stair', 'Out to the landing', at(0.0, 0.4, 0.08, 0.5), 'great-stair', {
        cursor: 'walk-back',
      }),
      exit('to-muniment', 'Through to the muniment gallery', at(0.9, 0.3, 0.1, 0.4), 'muniment-gallery', {
        cursor: 'walk-right',
        visibleIf: inAct(2),
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'wardens-office': {
    id: 'wardens-office',
    name: "The Warden's Office",
    subtitle: 'Oxblood leather and an Imperial 66',
    background: './art/scenes/wardens-office.webp',
    weather: 'none',
    ambience: 'clock-room',
    onFirstEnter: [
      think(
        'Everything on this desk is square to everything else. The pencil is parallel to the blotter. The cup is on the coaster.',
        'She stood up when I came in, which nobody else in this building has done, and she has given me a key to every room in it.',
      ),
    ],
    hotspots: [
      {
        id: 'specimen-bundle',
        label: 'The specimen bundle: nine documents of 1974',
        shape: at(0.3, 0.56, 0.24, 0.2),
        cursor: 'look',
        huntable: true,
        onInteract: [
          say(
            'Sabine Ferrier-Kyne',
            'Our house style, Miss Adare, so that you can see it before you start dating things at me. 1974, which I imagine is the year you will care about.',
            'Take as long as you like. Nothing in this building is in a hurry except the contractors.',
          ),
          clue('clue-pp-specimen-bundle'),
          tell(
            'Nine documents. Nine signatures: A. FERRIER, A. FERRIER, A. FERRIER …',
            'And in the lower left corner of every one, in 2H pencil, two millimetres high: p.p.',
          ),
          think(
            'Beautiful clean foolscap, all of it, and the same hand throughout, and the pencil notation exactly where Mrs Verge told me it goes.',
            'House style. That is the answer, handed to me in the first thirty minutes, by somebody who is quite certain I will file it under housekeeping.',
          ),
        ],
      },
      {
        id: 'imperial-66',
        label: 'Imperial 66, 1961',
        shape: at(0.56, 0.5, 0.2, 0.2),
        cursor: 'use',
        onInteract: [
          when(lacks('specimen-sheets'), [take('specimen-sheets')]),
          set('specimen-imperial'),
          sound('typewriter'),
          when(
            all(inAct(5), lacks('notice-74-119-retyped')),
            [
              take('notice-74-119-retyped'),
              think(
                'MARINERS ARE ADVISED THAT THE LIGHT EXHIBITED FROM THE NINE BELLS BEACON MAY NOT BE RELIED UPON UNTIL FURTHER NOTICE.',
                'Retyped from a scorched carbon on the machine that struck it the first time, with the a still filling and the comma still riding high.',
                'It is the same machine, in the same room, and I would rather it had not been, and it is right that it is.',
              ),
            ],
            [
              think(
                'Specimen line, card 7, twice.',
                'The lower-case a has filled solid with ink and wax. The comma prints four tenths high. The y has lost its descender. Machine one, and the worst-injured of the four.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'sabine',
        label: 'Sabine Ferrier-Kyne',
        shape: at(0.08, 0.24, 0.2, 0.5),
        cursor: 'talk',
        onInteract: [speakTo('sabine-ferrier-kyne')],
      },
      {
        id: 'in-tray',
        label: 'The in-tray and countersignature pigeonhole',
        shape: at(0.76, 0.5, 0.16, 0.16),
        cursor: 'look',
        onInteract: [
          when(
            knows('clue-substituted-slips'),
            [
              think(
                'Nine slips in nine days, and every one of them sat in this pigeonhole for somewhere between forty minutes and four hours before the box moved.',
                'She read what I was asking for before I was allowed to have it, and she never once said no. Four of them came back wrong instead.',
              ),
            ],
            [
              think(
                'Docketed folders standing on edge, all the same way up, and a pigeonhole marked FOR COUNTERSIGNATURE with three slips in it.',
                'Standing Order 7. It is on the back of every form I have filled in since Monday.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'w-o-89-2',
        label: 'Policy file: Memorandum W/O 89/2',
        shape: at(0.66, 0.68, 0.16, 0.16),
        cursor: 'take',
        visibleIf: inAct(2),
        onInteract: [
          when(
            lacks('memo-wo-89-2'),
            [
              take('memo-wo-89-2'),
              clue('clue-w-o-89-2'),
              tell(
                'W/O 89/2. Series 14/B: reboxing on account of mould, 1989. Schedule attached.',
                'Box 17: 23 items. Signed: S. Ferrier-Kyne, Deputy Warden.',
              ),
              think(
                'Signed openly, in her own name, with a schedule attached listing twenty-three items in box 17.',
                'There are seventeen in it. She has written down, and filed, and indexed, the exact measure of what she took out, because she is an archivist and she cannot help it.',
              ),
            ],
            [think('Buckram policy file, tagged, endorsed on the outside third, upside down to the tag.')],
          ),
        ],
      },
      {
        id: 'board-working-file',
        label: 'Board of Dissolution working file',
        shape: at(0.44, 0.7, 0.18, 0.16),
        cursor: 'look',
        visibleIf: inAct(4),
        onInteract: [
          when(
            lacks('board-working-file'),
            [
              take('board-working-file'),
              clue('clue-board-working-file'),
              tell(
                'Twenty-six Reprax copies of the contents of series 14/B box 17. Foliated 1–26 in pencil, top right. Docketed on the outside third, upside down to the tag.',
              ),
              think(
                'Four of these are copies of documents that are not in box 17 any more.',
                'She copied the evidence, removed the originals, and filed the copies correctly, because destroying a record is the one thing she has never in her life been able to make herself do.',
                'And she docketed it the Ministry way, which no thief could impose on another man’s file, and which one old man complained to me about on my first morning.',
              ),
            ],
            [think('Foliated, indexed, and complete. It is beautiful work and it will hang her.')],
          ),
        ],
      },
      {
        id: 'ribbon-well',
        label: 'The ribbon well and platen knob',
        shape: at(0.58, 0.42, 0.12, 0.1),
        cursor: 'look',
        visibleIf: inAct(2),
        onInteract: [
          when(
            knows('clue-dust-jar-6'),
            [
              think(
                'French chalk, beeswax and a salt bloom, in the ribbon well of a machine two floors and one corridor away from the north bay of the muniment gallery.',
                'Nothing else in this building has that mixture in it. It comes off that floor, on shoes and on a skirt hem, and it came in here on the fourteenth of September.',
              ),
            ],
            [
              think(
                'Grey felt of dust in the well under the spools, undisturbed, and something pale and waxy in it.',
                'I have a jar and a spatula and no idea yet what I am comparing it to.',
              ),
            ],
          ),
        ],
      },
      exit('to-stair', 'Out to the landing', at(0.0, 0.7, 0.1, 0.3), 'great-stair', {
        cursor: 'walk-back',
      }),
      exit('to-board-room', 'The board room door', at(0.9, 0.28, 0.1, 0.4), 'board-room', {
        cursor: 'walk-right',
        visibleIf: inAct(4),
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'accounts-office': {
    id: 'accounts-office',
    name: 'The Accounts Office',
    subtitle: 'Ledgers, a cash tin and the ribbon shelf',
    background: './art/scenes/accounts-office.webp',
    weather: 'none',
    ambience: 'quiet-library',
    onFirstEnter: [
      think(
        'Two enormous ledgers open on a sloped desk, a wall of small identical boxes behind, and a woman who checks the Warden’s door every ninety seconds without knowing she is doing it.',
        'Nothing here has been thrown away since 1962, and that is going to turn out to matter more than anything anybody says to me.',
      ),
    ],
    hotspots: [
      {
        id: 'liabilities-schedule',
        label: 'Schedule of Outstanding Liabilities',
        shape: at(0.3, 0.52, 0.22, 0.2),
        cursor: 'look',
        huntable: true,
        onInteract: [
          when(lacks('liabilities-schedule'), [take('liabilities-schedule')]),
          clue('clue-liabilities-item14'),
          tell(
            'Item 14. Superannuation — FERRIER-KYNE, S. — reckonable service claimed from 1959 — £2,140 4s arrears in dispute.',
          ),
          when(
            inAct(4),
            [
              think(
                'Reckonable service from 1959, asserted under her own signature, in a pension squabble I crossed off in my first hour.',
                'It is the only document in a hundred and eighty-seven years of this Authority in which she asks to be counted, and it is the answer to the only question the Board is going to ask me.',
              ),
            ],
            [
              think(
                'A pension squabble. Clear it, initial it, move on; it is the dullest statutory duty I have.',
                'Nineteen fifty-nine, though. That is fifteen years before anything I care about, and it is a claim, not a record.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'cash-books',
        label: 'Cash books and the Sundry Adjustments column',
        shape: at(0.08, 0.46, 0.2, 0.22),
        cursor: 'look',
        onInteract: [
          when(
            all(inAct(4), lacks('petty-cash-voucher')),
            [
              take('petty-cash-voucher'),
              clue('clue-petty-cash-voucher'),
              tell(
                'PETTY CASH, 16.8.74. Taxi, Cardew and return, 7s 6d. Signed for: S.F. Approved: E.C.',
              ),
              think(
                'Seven and six for a taxi to Cardew and back on the sixteenth of August 1974, drawn by S.F. and approved by the cashier.',
                'The sixteenth of August is the day the notice was ruled out of the despatch docket, and Cardew is where the man who should have been on that rock lived.',
              ),
            ],
            [
              clue('clue-sundries-column'),
              tell(
                'Sundry Adjustments (Lights). Ruled in by hand, 31 December 1974. £4,180 4s 0d.',
                'Carried forward. Carried forward. Carried forward. Carried forward …',
              ),
              think(
                'Ninety-six quarters. The same figure, carried forward, in six different hands, for twenty-four years.',
                'Nobody queried it because everybody who could have queried it inherited it from somebody who had not queried it either.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'ribbon-shelf',
        label: 'Rule 4 shelf: two hundred and forty used ribbon spools',
        shape: at(0.56, 0.3, 0.28, 0.26),
        cursor: 'puzzle',
        visibleIf: inAct(2),
        onInteract: [
          when(
            inAct(4),
            [
              when(
                unsolved('puz-september-spool'),
                [
                  when(lacks('ribbon-spool-september'), [take('ribbon-spool-september')]),
                  tell('IMPERIAL 66 — W.O. — fitted 2.9.98 — returned 21.9.98.'),
                  think(
                    'A fabric ribbon remembers everything typed on it, once, in order, backwards.',
                    'Mirror it, reverse it, and wind it under the glass slowly, and do not skip.',
                  ),
                  puzzle('puz-september-spool'),
                ],
                [
                  clue('clue-ribbon-spool'),
                  think(
                    'No splice. No eyelet. No colour break.',
                    '“I know what you mean to send. Please do not send it. There is nothing in it that can help anybody now. S.” — the twelfth of September — running unbroken into the accident report of the fourteenth.',
                    'She has denied knowing what he intended, in writing, three times, and a stationery economy instituted in 1968 has been holding the proof on a shelf ever since.',
                  ),
                ],
              ),
            ],
            [
              tell('RULE 4: NO NEW RIBBON TO BE ISSUED UNTIL THE USED SPOOL IS RETURNED. E.C., 1968.'),
              think(
                'Two hundred and forty spools, each in its own box, each with a pasted docket: machine, fitted, returned.',
                'It is the pettiest thing I have ever seen in a public office and I would like to shake her hand.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'remington',
        label: 'Remington Noiseless, 1938',
        shape: at(0.34, 0.68, 0.16, 0.16),
        cursor: 'use',
        onInteract: [
          when(lacks('specimen-sheets'), [take('specimen-sheets')]),
          set('specimen-remington'),
          sound('typewriter'),
          think(
            'Specimen line, card 7, twice.',
            'A heavy g from a bent typebar, striking left of centre, and every capital dropping two tenths below the line. Machine four.',
          ),
        ],
      },
      {
        id: 'gpo-account',
        label: 'Telephone file: GPO itemised trunk account, Q4 1974',
        shape: at(0.86, 0.5, 0.13, 0.2),
        cursor: 'take',
        visibleIf: inAct(4),
        onInteract: [
          when(
            lacks('gpo-trunk-account'),
            [
              take('gpo-trunk-account'),
              clue('clue-gpo-account'),
              tell('3.11.74 — CARDEW — 22.41 — 4 min — 1s 9d. Initialled: EC.'),
              think(
                'The plug-log is their own book and the Board will say so.',
                'This is not their book. This is a record kept by strangers, for money, about which nobody in this building had a vote, and it says the same thing to the minute.',
              ),
            ],
            [think('Q4 1974, itemised, checked against the internal log in Enid’s hand, and paid.')],
          ),
        ],
      },
      {
        id: 'munn-claims',
        label: 'Medical attendance file',
        shape: at(0.68, 0.62, 0.16, 0.18),
        cursor: 'take',
        visibleIf: inAct(3),
        onInteract: [
          when(
            lacks('munn-mileage-claims'),
            [
              take('munn-mileage-claims'),
              tell(
                'Dr T. Munn, locum. Brannock House, 14 miles, twice weekly. First claim: w/e 17 August 1974, visits 12.8 and 15.8.',
              ),
              think(
                'An expense claim that documents a man’s collapse, filed under Medical Attendance, paid in full, and never read by anybody since the day it was paid.',
                'The Authority reimbursed the mileage of the doctor who was attending the Warden it was telling the Ministry was at his desk.',
              ),
            ],
            [think('Buff folder, thirty-one claims, all initialled EC and all paid within the fortnight.')],
          ),
        ],
      },
      {
        id: 'enid',
        label: 'Enid Charnock',
        shape: at(0.14, 0.24, 0.18, 0.4),
        cursor: 'talk',
        onInteract: [speakTo('enid-charnock')],
      },
      exit('to-stair', 'Out to the landing', at(0.0, 0.66, 0.09, 0.34), 'great-stair', {
        cursor: 'walk-back',
      }),
      exit('to-switchboard', 'The switchboard room', at(0.42, 0.16, 0.12, 0.22), 'switchboard-room', {
        cursor: 'walk',
        visibleIf: inAct(2),
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'switchboard-room': {
    id: 'switchboard-room',
    name: 'The Switchboard Room',
    subtitle: 'Twelve lines and forty-five years of logs',
    background: './art/scenes/switchboard-room.webp',
    weather: 'none',
    ambience: 'engine-hum',
    enterIf: inAct(2),
    onFirstEnter: [
      think(
        'Bakelite, brass and a dozen braided cords on weighted pulleys, and a smell of hot dust that has not changed since 1946.',
        'Everything that happened in this building on the night of the third of November 1974 went through these twelve holes.',
      ),
    ],
    hotspots: [
      {
        id: 'plug-board',
        label: 'Twelve-line plug board',
        shape: at(0.3, 0.24, 0.4, 0.44),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            inAct(4),
            [
              when(
                unsolved('puz-switchboard'),
                [
                  think(
                    'The log gives me cords and minutes. The board gives me who. Both, or neither.',
                  ),
                  puzzle('puz-switchboard'),
                ],
                [
                  clue('clue-switchboard-log'),
                  think(
                    'Twenty-two thirty-four in, trunk 3, Rossport coastguard to extension 2, six minutes.',
                    'Twenty-two forty-one out, extension 2 to Cardew 4471, four minutes, no reply.',
                    'Twenty-three oh four, the Pelagia strikes. Twenty-three oh six, twenty-three eleven, twenty-three nineteen: the coastguard, the harbourmaster, Rossport.',
                    'Somebody sat in an empty office on a Sunday night and rang a call box for four minutes, twenty-three minutes too late, and then put the receiver down and did nothing else for twenty-two minutes.',
                  ),
                ],
              ),
            ],
            [
              think(
                'Six cord pairs, twelve jacks, and a lamp field with three shutters stuck down.',
                'It has not been patched since 1991 and it will still work, because there is nothing in it that can go wrong except a spring.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'call-logs',
        label: 'Call-log books 1946–1991',
        shape: at(0.06, 0.44, 0.18, 0.22),
        cursor: 'look',
        onInteract: [
          think(
            'Cord number, time, duration, initials. No names, because the night clerk was nineteen and paid to be quick.',
            'The hand changes with the roster: a round schoolboy hand runs 1973 to 1976 — D. Kyte, who left for the merchant navy in 1977 and has been dead since 1985, which would be very convenient for somebody if the log were the only record.',
          ),
        ],
      },
      {
        id: 'extension-list',
        label: 'Extension list under glass',
        shape: at(0.74, 0.38, 0.18, 0.16),
        cursor: 'look',
        onInteract: [
          tell('1 REGISTRY. 2 WARDEN. 3 ACCOUNTS. 4 ROLLS. 5 LAMP RM. 6 GATE. 7 STRONGROOM.'),
          think(
            'Extension 2 is the Warden’s office, and it has been extension 2 since the board was installed.',
            'On a Sunday night in November 1974, somebody was sitting in it.',
          ),
        ],
      },
      {
        id: 'directory-1974',
        label: '1974 telephone directory',
        shape: at(0.76, 0.6, 0.16, 0.18),
        cursor: 'look',
        onInteract: [
          tell(
            'CARDEW 4471 — public call box, P.O., Cardew. Pencilled in the margin: for the relief boatman.',
          ),
          think(
            'Not a house. Not the pub. A box on a pavement, forty yards from a front door, which is the only way anybody had of reaching the Nine Bells relief keeper in 1974.',
            'Which means whoever dialled it knew exactly what they were dialling and exactly how long it takes a man to hear it and come out.',
          ),
        ],
      },
      {
        id: 'night-roster',
        label: 'Night-duty roster',
        shape: at(0.08, 0.66, 0.18, 0.16),
        cursor: 'look',
        onInteract: [
          tell('Sun 3 Nov 1974 — board unattended after 18.00 — calls to be taken at extension in use.'),
          think(
            'Unattended. So there was no operator to see the cords go in, and no operator to see who put them there.',
            'Which is the only reason any of this needs reconstructing at all.',
          ),
        ],
      },
      {
        id: 'headset',
        label: "Operator's headset",
        shape: at(0.36, 0.72, 0.18, 0.16),
        cursor: 'use',
        onInteract: [
          sound('click-brass'),
          when(
            knows('clue-switchboard-log'),
            [
              tell(
                'Relay clicks. A shutter drops. And then a ringing tone, and a ringing tone, and a ringing tone, for four minutes.',
              ),
              think(
                'I let it run the whole four minutes with the headset on, because I wanted to know what it is like to stand there and choose not to put the receiver down.',
                'It is a very long time. It is much longer than you would think.',
              ),
            ],
            [
              think(
                'Ebonite earpieces and a cloth-covered lead, and the whole thing smells of somebody else’s hair oil from twenty years ago.',
              ),
            ],
          ),
        ],
      },
      exit('to-accounts', 'Back to the accounts office', at(0.0, 0.5, 0.09, 0.44), 'accounts-office', {
        cursor: 'walk-back',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'binding-room': {
    id: 'binding-room',
    name: "The Binding Room",
    subtitle: "Wren's bench",
    background: './art/scenes/binding-room.webp',
    weather: 'none',
    ambience: 'attic-creak',
    onFirstEnter: [
      think(
        'A disused bindery under a north roof light: a scarred beech bench, an iron nipping press under a sheet, and nobody else’s footprints in the dust.',
        'I asked whether I might use it and Mrs Verge said nobody has been up here since 1979, dear, help yourself, and that is the entire negotiation by which I got a laboratory.',
      ),
    ],
    hotspots: [
      {
        id: 'casebook',
        label: 'The casebook',
        shape: at(0.28, 0.62, 0.22, 0.2),
        cursor: 'look',
        huntable: true,
        onInteract: [
          when(lacks('casebook'), [take('casebook')]),
          when(all(inAct(2), solved('puz-forty-seven-cards'), lacks('want-list')), [
            take('want-list'),
            think(
              'Seven accession numbers on one page, ruled and headed WANT LIST, and every one of them a document that exists as a card and does not exist as paper.',
              '14/B/17/02. 14/B/17/05. 14/B/17/11. 14/B/17/16. 14/B/17/19. 14/B/17/23. 14/B/4/07.',
            ),
          ]),
          when(all(inAct(3), lacks('fibre-loupe')), [
            take('fibre-loupe'),
            take('paper-gazetteer'),
            take('beta-radiograph-sheets'),
            think(
              'Loupe at forty power, the Conservancy paper-stock gazetteer, and the beta-radiograph reference sheets out of the bottom of the kit.',
              'Five steps. Do all five. Doing four is how you get the answer you came in with.',
            ),
          ]),
          think(
            'Assertion, source, accession number. Twenty-two pages so far and eleven of the right-hand boxes are empty.',
            'Empty right-hand box, empty assertion. That is not modesty, that is the rule.',
          ),
        ],
      },
      {
        id: 'specimen-album',
        label: 'Typewriter specimen sheets',
        shape: at(0.54, 0.56, 0.2, 0.2),
        cursor: 'puzzle',
        onInteract: [
          when(
            inAct(4),
            [
              clue('clue-a-curve-applied'),
              think(
                'Plot the a. 1961, clean. 1966, a shadow in the counter. 1974, half filled. 1989, three-quarters. 1998, solid as a full stop.',
                'The refusals of 1974 sit on the curve where 1974 belongs. The accident report sits at full occlusion. The new label on box 17 sits at full occlusion.',
                'Same machine, same room, twenty-four years apart, and the machine will say so under oath and cannot be cross-examined.',
              ),
            ],
            [
              when(
                unsolved('puz-typewriter-survey'),
                [
                  when(lacks('specimen-album'), [take('specimen-album')]),
                  think(
                    'Four machines, four sets of injuries, mounted and dated on one album page.',
                    'You characterise, then you compare, then you date. Compare first and you will convince yourself of something.',
                  ),
                  puzzle('puz-typewriter-survey'),
                ],
                [
                  clue('clue-typewriter-specimens'),
                  think(
                    'Four albums, four machines, and a fifth sheet with no label on it that belongs to the Imperial 66 in the Warden’s office.',
                  ),
                ],
              ),
            ],
          ),
        ],
      },
      {
        id: 'drying-blotters',
        label: 'Fragments drying between blotters',
        shape: at(0.08, 0.5, 0.2, 0.24),
        cursor: 'puzzle',
        enabledIf: has('ash-fragments'),
        blockedEffects: [
          think('Nothing on the blotters yet. There is a grate in the courtyard with something in it.'),
        ],
        onInteract: [
          when(
            unsolved('puz-ash-grate'),
            [
              think(
                'Fourteen fragments, floated flat, char side up, in a grid on white blotting paper.',
                'Turn them by the edges. The blackest edge was the outside edge, because paper curls toward a fire.',
              ),
              puzzle('puz-ash-grate'),
            ],
            [
              when(lacks('notice-74-119-carbon'), [take('notice-74-119-carbon')]),
              clue('clue-scorched-carbon'),
              when(all(has('flimsy-page-two'), lacks('notice-74-119')), [
                take('notice-74-119'),
                think(
                  'Page one out of a wet grate in a courtyard and page two out of a japanned box in a vault, laid side by side under glass twenty yards and twenty-four years apart.',
                  'The ribbon impression runs on across the join without a stumble. Same machine, same measure, same tired ribbon, same afternoon.',
                ),
              ]),
              tell(
                'NOTICE TO MARINERS 74/119. Drafted 15 August 1974.',
                'MARINERS ARE ADVISED THAT THE LIGHT EXHIBITED FROM THE NINE BELLS BEACON MAY NOT BE RELIED UPON UNTIL FURTHER NOTICE.',
              ),
              think(
                'A carbon, not a top copy. Somebody burned the file copy and kept nothing, and the flue would not draw because a scaffolder took the damper out on the second of September.',
                'It has a number. Every number issued in this country since 1855 is in a register, and that register is four hundred feet away in the Long Registry.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'raking-lamp',
        label: 'Raking light lamp and shaving mirror',
        shape: at(0.62, 0.34, 0.16, 0.18),
        cursor: 'use',
        onInteract: [
          when(lacks('shaving-mirror'), [take('shaving-mirror')]),
          think(
            'Bring the lamp down to fifteen degrees off the sheet and the surface stops being white and starts being a landscape.',
            'Watermarks, erased pencil, the ghost of a signature written on the sheet above. Everything anybody ever pressed into this paper is still in it.',
          ),
        ],
      },
      {
        id: 'deakin-bench',
        label: 'The Deakin letter, laid out under glass',
        shape: at(0.33, 0.42, 0.2, 0.16),
        cursor: 'puzzle',
        huntable: true,
        visibleIf: inAct(3),
        enabledIf: has('deakin-letter'),
        blockedEffects: [
          think(
            'Clean glass, a weighted tape measure and five stamps in a row, and nothing on the bench to put under them.',
            'The sheet is still in Rita’s campaign file in the lamp room, because she has not yet decided whether I am the sort of person you hand a thing like that to.',
          ),
        ],
        onInteract: [
          when(
            unsolved('puz-deakin-authentication'),
            [
              // The kit normally comes off the casebook on the first Act III
              // visit; grant it here too so arriving at the bench first can
              // never leave her holding a document and no way to test it.
              when(lacks('fibre-loupe'), [
                take('fibre-loupe'),
                take('paper-gazetteer'),
                take('beta-radiograph-sheets'),
              ]),
              sound('paper-rustle'),
              think(
                'One sheet of white bond, creased in four, with a pasted envelope corner and a signature in blue biro that has pressed a groove into the back of the paper.',
                'It says the beacon was dark. It says they were told to say nothing. It says, in four sentences, the exact thing I have spent four days assembling out of ledgers and dust, and it says it in a way no Board could strike.',
                'Which is precisely why it goes under the lamp before it goes anywhere near a citation column. Raking light, chain lines, fibre at forty power, the frank, the ribbon. Five steps. Do all five.',
                'Doing four is how you get the answer you came in with.',
              ),
              puzzle('puz-deakin-authentication'),
            ],
            [
              clue('clue-deakin-letter'),
              think(
                'ARDWELL BOND, first manufactured June 1981. A Cardew frank on an office that struck its last item on the thirtieth of September 1972.',
                'Two independent tells, either of which is fatal on its own, on a sheet dated the fourth of March 1975.',
                'It sits under the glass where I left it, and it is still the most persuasive thing in this building, and it is still not true, and both of those go on being the case at the same time.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'dust-jars',
        label: 'Dust reference jars',
        shape: at(0.78, 0.56, 0.16, 0.18),
        cursor: 'look',
        onInteract: [
          when(
            all(has('dust-jar-6'), has('coroner-exhibit-4')),
            [
              when(lacks('dust-comparison'), [take('dust-comparison')]),
              clue('clue-dust-jar-6'),
              think(
                'Jar 6, gallery north bay: French chalk, beeswax, and a salt bloom off the granite.',
                'Coroner’s exhibit 4, taken off the deceased’s jacket: French chalk, beeswax, salt bloom.',
                'That mixture occurs in exactly one room in this building, and it is the room with the loose rail in it, and it is also in the ribbon well of a typewriter two floors away.',
              ),
            ],
            [
              think(
                'Eleven jars, labelled in pencil, one per room. It takes ten minutes a room and everybody who has watched me do it has decided I am a fanatic.',
                'I need jar 6 off the gallery floor and the coroner’s exhibit before either is worth anything.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'nipping-press',
        label: 'The nipping press and sewing frame',
        shape: at(0.06, 0.24, 0.18, 0.24),
        cursor: 'use',
        onInteract: [
          sound('lock-click'),
          think(
            'Cast iron, a two-inch screw, and a platen you can bring down to within a hair.',
            'A hundred years of somebody’s trade, disused since 1979, and it is the best flattening press I have ever had my hands on.',
          ),
        ],
      },
      exit('to-chart-loft', 'Through to the chart loft', at(0.88, 0.24, 0.12, 0.5), 'chart-loft', {
        cursor: 'walk-right',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'chart-loft': {
    id: 'chart-loft',
    name: 'The Chart Loft',
    subtitle: 'A lit table under the roof timbers',
    background: './art/scenes/chart-loft.webp',
    weather: 'none',
    ambience: 'attic-creak',
    onFirstEnter: [
      think(
        'A glass table lit from underneath, and the whole loft turned into a lantern with the roof trusses uplit like ribs.',
        'Three surveys of the same water, and no two of them agree.',
      ),
    ],
    hotspots: [
      {
        id: 'light-table',
        label: 'The light table',
        shape: at(0.24, 0.5, 0.4, 0.3),
        cursor: 'puzzle',
        huntable: true,
        onInteract: [
          when(
            inAct(3),
            [
              when(
                unsolved('puz-chart-loft'),
                [
                  think(
                    'You do not register a survey by eye and you do not register it on the coastline. You register it on the marks the surveyor put there for the purpose.',
                    'Brannock trig pillar, St Bride’s tower, the Sowens beacon. Three marks, three sheets.',
                  ),
                  puzzle('puz-chart-loft'),
                ],
                [
                  clue('clue-light-characteristic'),
                  clue('clue-chart-overlays'),
                  think(
                    'Registered on the trig marks, the Inquiry’s reconstructed track lies three hundred and forty yards east of where the finding puts her, and dead on the line a competent pilot would steer.',
                    'And on the 1948 sheet, under the north end of the undercroft, a chamber twenty feet by twelve that appears on no plan after 1975.',
                  ),
                ],
              ),
            ],
            [
              think(
                'Three transparencies, slightly out of register, glowing from beneath. 1948, the 1974 buoyage revision, and 1998.',
                'Not yet. I have nothing to ask them yet.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'admiralty-list',
        label: 'Admiralty List of Lights, 1974',
        shape: at(0.7, 0.44, 0.16, 0.18),
        cursor: 'take',
        onInteract: [
          when(lacks('admiralty-list-1974'), [take('admiralty-list-1974')]),
          tell(
            'IVORY SOUND. Nine Bells Beacon — Fl(3) W 20s — 112ft — 16M.',
            'Cadran Point — Fl(3) W 15s — 91ft — 14M. 9 miles SSE of the foregoing.',
          ),
          think(
            'Three flashes either way. The only difference between them is five seconds, and nobody in 1975 asked a frightened nineteen-year-old to count.',
          ),
        ],
      },
      {
        id: 'feaver-deposition',
        label: 'Deposition of Norah Feaver, 1975',
        shape: at(0.7, 0.64, 0.16, 0.16),
        cursor: 'look',
        onInteract: [
          tell(
            'Q. And you are quite sure you saw the light? A. We could see it perfectly well, sir. Three flashes. We all saw it.',
          ),
          when(
            knows('clue-light-characteristic'),
            [
              when(lacks('feaver-timing-note'), [
                take('feaver-timing-note'),
                take('light-characteristic-note'),
              ]),
              think(
                'She counted it out for me on her kitchen clock in Wolverhampton, twenty-four years later, without hesitating: one, two, three, and then fifteen.',
                'Fifteen. Cadran Point. She has told the exact truth in public since 1975 and it has been used to hang a dead man, because nobody asked her the second question.',
              ),
            ],
            [
              think(
                'The strongest evidence in the case against everything I believe, and it is honest. That is what makes it dangerous.',
                'Three flashes is not a light. Three flashes and a period is a light.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'survey-drawer',
        label: 'The survey drawer',
        shape: at(0.06, 0.56, 0.16, 0.2),
        cursor: 'take',
        // Two separate objects in one drawer, so they are taken separately.
        // Keying the tide tables on `lacks('approach-surveys')` meant that a
        // player who solved the light-table puzzle first — which hands over the
        // approach surveys as its own reward — could never lift the tide tables
        // at all, and the tables are half of the marigraph combination.
        onInteract: [
          when(
            any(lacks('approach-surveys'), lacks('tide-tables-1974')),
            [
              when(lacks('approach-surveys'), [take('approach-surveys')]),
              when(lacks('tide-tables-1974'), [take('tide-tables-1974')]),
              think(
                'Rolled sheets by date in a rack that Sandbach’s programme strikes on the thirtieth, and the 1974 tide tables underneath them with the spine gone.',
                'If I leave these in this room until Friday they will be in a crate in the yard marked LOT 4 and I will not see them again.',
              ),
            ],
            [think('Empty rack, chalk numbers, and a rectangle in the dust where the rolls were.')],
          ),
        ],
      },
      {
        id: 'dividers',
        label: 'Dividers and parallel rule',
        shape: at(0.4, 0.8, 0.14, 0.13),
        cursor: 'take',
        onInteract: [
          when(
            lacks('dividers'),
            [
              take('dividers'),
              think(
                'Brass dividers with the points still sharp, and a parallel rule that walks across a chart like a slow animal.',
                'You step off a pilot’s line with these. Two hundred yards at a time, in the dark, in a sixty-mile southwesterly, from memory. That is what a pilot was.',
              ),
            ],
            [think('Stepped off across the Sowens: four hundred yards clear at 4.2 metres. He was exactly where he should have been.')],
          ),
        ],
      },
      {
        id: 'pp-sort-bench',
        label: 'The sorting bench',
        shape: at(0.66, 0.76, 0.24, 0.18),
        cursor: 'puzzle',
        visibleIf: inAct(4),
        onInteract: [
          when(
            unsolved('puz-per-procurationem'),
            [
              when(lacks('forty-eight-signatures'), [take('forty-eight-signatures')]),
              think(
                'Forty-eight documents signed A. FERRIER, out of four custodies that have never been in the same room: the strongroom, a rented kitchen at Cardew, Enid’s ledgers and a biscuit tin.',
                'No one custodian could have faked the set. Bottom left corner, two millimetres, every single one, and no assuming.',
              ),
              puzzle('puz-per-procurationem'),
            ],
            [
              clue('clue-pp-sort'),
              think(
                'Forty-one and seven.',
                'Seven genuine, shaky, unmistakably a man’s hand: the second, fifth, seventh, ninth and tenth of August, and the eighteenth and twenty-sixth of November.',
                'Forty-one per procurationem, every one dated between the eleventh of August and the third of November 1974. Ninety-nine days.',
                'Nothing was forged. Nothing at all was forged. That is the whole horror of it.',
              ),
            ],
          ),
        ],
      },
      exit('to-stair', 'Down to the landing', at(0.0, 0.62, 0.1, 0.36), 'great-stair', {
        cursor: 'walk-back',
      }),
      exit('to-binding-room', 'Through to the binding room', at(0.9, 0.3, 0.1, 0.36), 'binding-room', {
        cursor: 'walk-right',
      }),
      exit('to-roof', 'The roof hatch', at(0.44, 0.02, 0.16, 0.12), 'pilotage-roof', {
        cursor: 'walk',
        visibleIf: inAct(4),
        enabledIf: flagged('line-down'),
        blockedEffects: [
          think('A hatch, a bolt and a ladder. No reason to be on a roof in this weather. Not yet.'),
        ],
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'muniment-gallery': {
    id: 'muniment-gallery',
    name: 'The Muniment Gallery',
    subtitle: 'North bay, behind the map presses',
    background: './art/scenes/muniment-gallery.webp',
    weather: 'none',
    ambience: 'quiet-library',
    enterIf: inAct(2),
    layers: [
      {
        id: 'dark',
        src: './art/scenes/muniment-gallery-dark.webp',
        visibleIf: not(flagged('gallery-lit')),
      },
    ],
    onFirstEnter: [
      think(
        'Iron underfoot that rings, a twenty-two-foot drop on the other side of a slim balustrade, and a dead-end bay behind two map presses with no sightline from anywhere.',
        'Nobody has been up here in six weeks. You can tell by the floor.',
      ),
    ],
    hotspots: [
      {
        id: 'time-switch',
        label: 'Gallery time-switch',
        shape: at(0.06, 0.4, 0.12, 0.16),
        cursor: 'use',
        onInteract: [
          sound('click-brass'),
          set('gallery-lit'),
          when(
            inAct(4),
            [
              clue('clue-gallery-timeswitch'),
              think(
                'Twenty minutes a winding, counted by the switch and charged to Lights in the Fuel and Light Book.',
                'Eleven windings on the fourteenth of September 1998. Two hundred and twenty minutes of light, for a visit the accident report puts at under an hour.',
                'Somebody stood up here for eighty-eight minutes and then went on standing here afterwards, in the light, with the switch running down and being wound again.',
              ),
            ],
            [
              think(
                'Twenty minutes a winding and then it clunks off and you are in the dark on an iron walkway over a drop.',
                'It counts its own windings, because in 1911 somebody wanted to know who was burning the Authority’s electricity.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'spectacles',
        label: 'Folded spectacles on an open ledger',
        shape: at(0.44, 0.5, 0.16, 0.14),
        cursor: 'look',
        huntable: true,
        enabledIf: flagged('gallery-lit'),
        blockedEffects: [think('Not in the dark. The switch is at the head of the gallery.')],
        onInteract: [
          clue('clue-spectacles'),
          think(
            'Wire-rimmed, folded, and set down square on the open ledger with the arms closed.',
            'A man reading does not fold his spectacles. A man who has stopped reading because somebody has come to talk to him does.',
            'I am not going to touch them. I am going to photograph them from four positions and note the dust round them, which is undisturbed, and has been for six weeks.',
          ),
        ],
      },
      {
        id: 'baluster-3',
        label: 'The north bay rail, baluster 3',
        shape: at(0.66, 0.56, 0.14, 0.24),
        cursor: 'look',
        onInteract: [
          when(
            knows('clue-site-diary-rail'),
            [
              think(
                'Recorded loose on the second of September. Made good on the fifteenth at the Warden’s personal instruction, out of programme, no order number, not billed.',
                'The day after. Not the week after, not on the next works order. The day after, quietly, by a contractor who was asked not to invoice for it.',
              ),
            ],
            [
              think(
                'The third baluster is cleaner than its neighbours and the paint on its foot has no dust in the brush marks.',
                'That is new work. Weeks old, not years, in a building where nothing has been repaired since 1991 except what the demolition programme touches.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'dust-sample',
        label: 'Floor dust, north bay',
        shape: at(0.36, 0.74, 0.2, 0.16),
        cursor: 'take',
        enabledIf: flagged('gallery-lit'),
        blockedEffects: [think('I am not sampling a floor by feel. Light first.')],
        onInteract: [
          when(
            lacks('dust-jar-6'),
            [
              take('dust-jar-6'),
              think(
                'French chalk off the map presses, beeswax off the reading slope, and a salt bloom that comes through the granite on this wall and nowhere else.',
                'Jar 6. Labelled, dated, initialled, sealed with tape across the lid, because a sample without a label is a story.',
              ),
            ],
            [think('Sealed, labelled and in the bag. Jar 6, north bay, taken 28 October.')],
          ),
        ],
      },
      {
        id: 'map-presses',
        label: 'The map presses',
        shape: at(0.14, 0.5, 0.2, 0.3),
        cursor: 'look',
        onInteract: [
          think(
            'Two tall presses standing proud of the wall, and a dead corner behind them about four feet by six.',
            'You cannot see into it from the stair, from the hall below, from the landing or from the doorway. I have checked all four.',
            'Which is exactly why two people would come up here to have a conversation, and exactly why nobody heard it.',
          ),
        ],
      },
      {
        id: 'order-book',
        label: "Warden's Order Book 1972–1976",
        shape: at(0.5, 0.62, 0.16, 0.16),
        cursor: 'puzzle',
        visibleIf: inAct(4),
        enabledIf: flagged('gallery-lit'),
        blockedEffects: [think('Raking light needs light. The switch, then the mirror.')],
        onInteract: [
          when(lacks('order-book-1972-76'), [take('order-book-1972-76')]),
          when(
            unsolved('puz-per-procurationem'),
            [
              think(
                'The leaves for the eleventh of August to the third of November have been taken out at the gutter with a razor, cleanly, by somebody unhurried.',
                'But ink lies against the facing page for fifteen years, and it leaves an offset, and an offset reads backwards in a shaving mirror under a raking lamp.',
              ),
              puzzle('puz-per-procurationem'),
            ],
            [
              clue('clue-order-book-offsets'),
              tell(
                'Recovered from the offset, 18 August 1974: relief keeper’s autumn residence deferred, wages to continue.',
                'Recovered from the offset, 16 August 1974: R.741 not sanctioned, refer winter refit.',
                'Recovered from the offset, 9 September 1974: R.748 not sanctioned. Wages to be continued as before.',
              ),
              think(
                'Read backwards, in a shaving mirror, off the ghost of ink that pressed into a facing page for fifteen years.',
                'They razored the leaves out in 1989 and left the offsets, because nobody in the world knows that offsets exist except people who mend books.',
              ),
            ],
          ),
        ],
      },
      exit('to-stair', 'Out to the landing', at(0.0, 0.66, 0.1, 0.34), 'great-stair', {
        cursor: 'walk-back',
      }),
      exit('to-rolls-room', 'Through to the rolls room', at(0.88, 0.26, 0.12, 0.4), 'rolls-room', {
        cursor: 'walk-right',
      }),
    ],
  },

  // -------------------------------------------------------------------------
  'board-room': {
    id: 'board-room',
    name: 'The Board Room',
    subtitle: 'The Charter of 1811 in a glazed case',
    background: './art/scenes/board-room.webp',
    weather: 'none',
    ambience: 'clock-room',
    enterIf: inAct(4),
    layers: [
      {
        id: 'overcast',
        src: './art/scenes/board-room-overcast.webp',
        visibleIf: inAct(4, 4),
      },
    ],
    onFirstEnter: [
      think(
        'Forty feet of French-polished mahogany, three carved chairs, and a vellum charter in a case on the end wall with a wax seal the size of a saucer.',
        'This is the room where it will either stand or be struck, and there is nowhere in it to hide a single thing I cannot cite.',
      ),
    ],
    hotspots: [
      {
        id: 'charter-case',
        label: 'The Charter of 1811, Article 9',
        shape: at(0.42, 0.28, 0.2, 0.24),
        cursor: 'look',
        huntable: true,
        onInteract: [
          when(lacks('charter-1811'), [take('charter-1811')]),
          clue('clue-charter-art9'),
          tell(
            'ART. IX. The said office of Warden shall be holden by a man of full age, being a subject of this Realm.',
          ),
          think(
            'Never amended. A hundred and eighty-seven years, and nobody has ever needed to amend it, because nobody was ever going to test it.',
            'It is the contempt and the alibi in the same clause: it told her she could not be Warden, and then it made it impossible for anyone to prove she had been.',
          ),
        ],
      },
      {
        id: 'case-file',
        label: 'The case file',
        shape: at(0.28, 0.62, 0.24, 0.18),
        cursor: 'puzzle',
        visibleIf: inAct(5),
        enabledIf: has('case-file'),
        blockedEffects: [
          think('Not without the file. Eight links, forty-one supporting documents, and every citation ruled in.'),
        ],
        onInteract: [
          when(
            unsolved('puz-board-of-dissolution'),
            [
              think(
                'Presence. Means and opportunity. Consciousness of guilt. Identity. Prior knowledge. Signature. The hand has a name. Motive and predicate.',
                'Nothing I was told. Nothing anybody confessed on a rock. Only what I can hold up to a window.',
              ),
              puzzle('puz-board-of-dissolution'),
            ],
            [
              think(
                'It stood. Most of it stood.',
                'And she took her own minutes throughout, in a small upright hand, with a 2H pencil behind her ear, and did not interrupt once.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'board-table',
        label: 'The Board of Dissolution',
        shape: at(0.56, 0.44, 0.3, 0.2),
        cursor: 'look',
        onInteract: [
          when(
            inAct(5),
            [
              say(
                'Mr Pargeter',
                'Miss Adare. The finding of the Rossport Inquiry carries a statutory presumption of correctness. You are nineteen. Which of those two facts would you like to begin with?',
              ),
              think(
                'One. He is doing his job. Two. His job is to strike anything I cannot cite. Three. If he strikes it, it deserved to be struck.',
              ),
            ],
            [
              think(
                'Mrs Ellary Voss in the chair, Captain Dunnet as assessor, and Mr Pargeter for the Ministry, on the third at two o’clock.',
                'Three place cards, three blotters, three carafes, set out a week early by somebody who sets things out a week early.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'transcript',
        label: 'The transcript',
        shape: at(0.12, 0.62, 0.16, 0.16),
        cursor: 'look',
        visibleIf: inAct(5),
        onInteract: [
          when(
            solved('puz-board-of-dissolution'),
            [
              think(
                'It prints with the gaps in it. Every assertion I could not tie to a document is ruled through in red, in front of me, out loud, and the ruled lines are in the record for good.',
                'It is not a punishment. It is a measurement. I would rather have the measurement.',
              ),
            ],
            [
              think(
                'Blank foolscap and a shorthand writer’s machine, and a red pencil laid across the top of the pad.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'window-seat',
        label: 'The south window',
        shape: at(0.02, 0.26, 0.12, 0.42),
        cursor: 'look',
        onInteract: [
          when(
            solved('puz-the-optic'),
            [
              think(
                'Twenty-three oh four. Nine miles out, in the dark: one, two, three, and then twenty seconds of nothing, and then again.',
                'Nobody in this room says anything for a long time. Mrs Voss stands up. Captain Dunnet takes his glasses off.',
                'Twenty-four years and seventy-one days after it went out.',
              ),
            ],
            [
              think(
                'Hard low November sun coming in in three window-shaped bars, with the dust turning over in them.',
                'From this chair, at night, in 1974, you could see the Nine Bells. Anybody sitting here on the third of November would have seen there was nothing there.',
              ),
            ],
          ),
        ],
      },
      {
        id: 'certificate',
        label: 'The section 41 certificate',
        shape: at(0.62, 0.66, 0.2, 0.16),
        cursor: 'use',
        visibleIf: inAct(5),
        onInteract: [
          when(
            lacks('s41-certificate'),
            [
              take('s41-certificate'),
              set('certificate-signed'),
              doneTask('certify'),
              sound('chime'),
              think(
                'Series 1/A, 2/C, 9/E and 14/B, certified as of enduring public value under section 41(4), signed W. ADARE, appraiser, and dated the third of November 1998.',
                'Whatever else stands or falls today, that piece of paper is the difference between an archive and four hundred tons of pulp on Wednesday morning.',
                'The record outlives everybody. That is the only reason any of this was ever findable.',
              ),
            ],
            [think('Signed, sealed, countersigned and posted. It is out of my hands and into the file, which is where things survive.')],
          ),
        ],
      },
      exit('to-stair', 'Out to the landing', at(0.0, 0.7, 0.1, 0.3), 'great-stair', {
        cursor: 'walk-back',
      }),
      exit('to-wardens-office', "Through to the Warden's office", at(0.88, 0.56, 0.12, 0.3), 'wardens-office', {
        cursor: 'walk-right',
      }),
    ],
  },
};
