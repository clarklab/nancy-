/**
 * The sixteen mechanisms.
 *
 * A `PuzzleDefinition` is the *contract* around a minigame, not the minigame:
 * the framing the bench shows when it opens, the three escalating nudges the
 * lamp gives out, and what the world owes the player for finishing. The
 * interactive part lives in `src/puzzles/**` and registers itself under the
 * same id; if it is missing, the host still shows the premise and the hints,
 * and `allowSkipAfterMs` still lets the player through.
 *
 * Two authoring rules hold everywhere below.
 *
 * 1. HINTS ARE DIEGETIC AND OPINIONLESS. The first is Wren telling herself how
 *    the job is done. The second is an object in the room that is already open
 *    at the right page. The third is somebody with more experience explaining
 *    *procedure* — never the answer, and in Halkett's case never the case.
 *
 * 2. `onSolve` GRANTS THE MECHANISM'S OWN PRODUCT AND NOTHING ELSE. Reading a
 *    document is a scene beat and belongs to the room; what falls out of the
 *    bench belongs here. `giveItem` and `giveClue` are idempotent, so a room
 *    that hands the same object over on the next click is a harmless echo
 *    rather than a duplicate — which matters, because a player who solves a
 *    puzzle and then walks away must not lose the thing they solved it for.
 *
 * `allowSkipAfterMs` is an accessibility promise and is set on every mechanism
 * that can genuinely stall a careful player. It is deliberately absent from
 * the five that cannot: the three Act I teaching exercises, the optic (which
 * is not evidence and cannot be failed), and the Board, where skipping would
 * mean skipping the ending.
 */

import type { Condition, Effect, PuzzleDefinition, PuzzleId } from '@/engine/types';

/** Five minutes of honest effort before the bench offers a way out. */
const SKIP = 300_000;

// ---------------------------------------------------------------------------
// Local authoring helpers
//
// Deliberately duplicated from the scene helpers rather than imported: a
// puzzle's reward must not stop compiling because a room-authoring
// convenience was renamed in a file this one does not own.
// ---------------------------------------------------------------------------

const think = (...text: string[]): Effect => ({ kind: 'think', text });
const tell = (...text: string[]): Effect => ({ kind: 'narrate', text });
const say = (speaker: string, ...text: string[]): Effect => ({ kind: 'narrate', text, speaker });
const clue = (c: string): Effect => ({ kind: 'giveClue', clue: c });
const item = (i: string): Effect => ({ kind: 'giveItem', item: i });
const set = (flag: string, value = true): Effect => ({ kind: 'setFlag', flag, value });
const sound = (s: string): Effect => ({ kind: 'playSound', sound: s });
const cinematic = (id: string): Effect => ({ kind: 'cinematic', id });
const knows = (c: string): Condition => ({ kind: 'hasClue', clue: c });
const all = (...of: Condition[]): Condition => ({ kind: 'all', of });

/**
 * Idempotent act turn, matching the scene graph's helper of the same name: the
 * gate that fires first wins and the second is a no-op, so the title card can
 * never play twice however the player reaches the boundary.
 */
const advanceTo = (act: number): Effect => ({
  kind: 'if',
  cond: { kind: 'act', max: act - 1 },
  then: [{ kind: 'setAct', act }],
});

// ---------------------------------------------------------------------------
// The Board's eight links, expressed as documents the player physically holds
// ---------------------------------------------------------------------------

/**
 * One decisive exhibit per link. The Board's finding is a function of the
 * casebook and the casebook is a function of these; a link with nothing in its
 * citation column is struck aloud, whatever the player says about it.
 */
const EIGHT_LINKS: Condition[] = [
  knows('clue-slip-r982211'), // 1 — presence, 09:10, 14 September 1998
  knows('clue-site-diary-rail'), // 2 — means and opportunity, items 41 and 63
  knows('clue-reprax-1998'), // 3 — consciousness of guilt, forty-one against twelve
  knows('clue-board-working-file'), // 4 — identity, twenty-six docketed copies
  knows('clue-ribbon-spool'), // 5 — prior knowledge, 12 September 1998
  knows('clue-pp-sort'), // 6 — signature, forty-one and seven
  knows('clue-liabilities-item14'), // 7 — the hand has a name
  knows('clue-reconciliation'), // 8 — motive, concealment, omission
];

/**
 * Pargeter's named rebuttals, and the one object that answers each. A link can
 * stand on its own exhibit and still fall to the counter; the strongest
 * finding needs both halves.
 */
const COUNTERS_ANSWERED: Condition[] = [
  knows('clue-ferry-booking-book'), // the Board Room alibi
  knows('clue-dust-jar-6'), // "a routine repair"
  knows('clue-docket-fold'), // chain of custody
  knows('clue-marigraph-drum'), // the statutory presumption of correctness
  knows('clue-chart-overlays'), // the 1975 reconstructed track
  knows('clue-gpo-account'), // "their own book is their word for it"
];

export const puzzles: Record<PuzzleId, PuzzleDefinition> = {
  // =========================================================================
  // ACT I — THE APPRAISAL
  // =========================================================================

  'puz-fused-commission': {
    id: 'puz-fused-commission',
    name: 'The Fused Commission',
    premise:
      'Spray has welded leaves two and three of Wren’s own commission into one stiff biscuit of paper. Until the seal, the schedule of series and Halkett’s countersignature can be read, she has no authority to open a door on Brannock Head. Field kit on the table, flat water for about four minutes, and nobody to hurry her but herself.',
    hints: [
      'Wren, to herself: ‘Eleven months on a parish register. Do it the way it is done.’',
      'The kit lid falls open on its own, and the corner of card 3 lifts: RELATIVE HUMIDITY 68–72. NOT ABOVE.',
      'Halkett’s covering note in the kit: ‘If you find you are pulling, you are early. Put it down and count the clock. The paper will let go on its own or it will not let go at all.’',
    ],
    onSolve: [
      sound('paper-rustle'),
      item('commission-s41'),
      clue('clue-fused-commission'),
      set('skill-paper-authentication'),
      think(
        'Two leaves, three seam segments, and not one fibre lifted across a chain line.',
        'Section 41 of the Coastal Services Act 1997, the seal, the schedule of series, and Halkett’s countersignature in her small upright hand.',
        'That is the whole of my authority and it is four ounces of rag paper. Keep it dry.',
      ),
    ],
  },

  'puz-typewriter-survey': {
    id: 'puz-typewriter-survey',
    name: 'Four Machines, Four Injuries',
    premise:
      'Standard conservation practice: before you date anything by its typescript, characterise every machine in the building. Four survivors, four specimen sheets, one album page in the casebook. Nobody here thinks this is anything but housekeeping, and it will not be housekeeping for very much longer.',
    hints: [
      'Casebook margin, in Wren’s hand: ‘A machine cannot help being itself. Four sheets, four albums, and no guessing.’',
      'The loupe was left on the bench over the Imperial’s specimen, sitting on the word ‘appraisal’ with both a’s dark as full stops.',
      'Halkett on procedure: ‘You characterise, then you compare, then you date. If you compare before you characterise you will convince yourself of something, and it will be struck.’',
    ],
    onSolve: [
      item('specimen-sheets'),
      item('specimen-album'),
      clue('clue-typewriter-specimens'),
      set('skill-typewriter-forensics'),
      think(
        'Imperial 66, Warden’s Office: a filling solid with ink and wax, comma printing four tenths of a millimetre high, broken descender on y.',
        'Underwood 5, Rolls Room: e riding above the baseline, a wandering 3. Olivetti in the Registry: grey doubling off a slack vibrator, chipped l. Remington in Accounts: heavy g off a bent typebar, capitals dropping.',
        'Four albums, mounted and dated. Anything typed in this building since 1928 will now tell me which room it was typed in, whether or not anybody wanted it to.',
      ),
    ],
  },

  'puz-postmasters-register': {
    id: 'puz-postmasters-register',
    name: 'The Machine That Cannot Lie',
    premise:
      'Wren’s warrant lets her open a franking meter, which is a General Post Office offence for everybody else in this building. Reconciling the day’s post book against the meter’s two registers is a competence test she has set herself. It is also five minutes’ training on a machine that nobody in a hundred and eighty-seven years has thought of as a witness.',
    hints: [
      'Wren: ‘Two registers and a book. One of the three is wrong, and it will not be the registers.’',
      'The pinned standing instructions are curling at the corner. Rule 6 is the one with the drawing-pin straight through it.',
      'Halkett: ‘A meter counts impressions, not intentions. If it says seventeen there were seventeen, and your job is to find the one nobody thought worth writing down.’',
    ],
    onSolve: [
      item('meter-card-book'),
      clue('clue-franking-meter'),
      set('skill-serial-records'),
      think(
        'Descending register fell four shillings and twopence-farthing. Post book totals four shillings and elevenpence. Ascending counter advanced seventeen against sixteen entries.',
        'The seventeenth is Enid’s thirteen-penny test strike on a scrap, taken every morning to prove the die, carried to the meter card and never to the post book. Rule 6, and a drawing-pin through it.',
        'A boring explanation, arrived at properly. Remember how that felt. The next counter that disagrees with a book will not have one.',
      ),
    ],
  },

  'puz-ash-grate': {
    id: 'puz-ash-grate',
    name: 'The Ash Grate',
    premise:
      'Somebody was burning paper in the rain at twenty past one in the morning, and the flue would not draw because the scaffolders took the damper off on 2 September. The grate is a sodden black brick. Leave it until morning and the fragments dry onto the iron and go to dust when they are touched.',
    hints: [
      'Wren, in the rain: ‘Cold water. Nothing warm, nothing quick. It has already been on fire once.’',
      'Two fragments drift together in the tray and a typed line runs straight across the join: MAY NOT BE RELIED.',
      'Halkett, told only that a notice has been recovered: ‘Then it has a number, and every number issued in this country since 1855 is in a register. Go and look at the register. That is the whole of my advice and it is enough.’',
    ],
    onSolve: [
      item('notice-74-119-carbon'),
      clue('clue-scorched-carbon'),
      think(
        'Eleven fragments, floated off one at a time, dried between blotters and laid down on their char pattern. Paper curls toward the fire, so the blackest edge is the outside edge and the perimeter builds itself.',
        'A Notice to Mariners. Numbered. Drafted the fifteenth of August 1974. Two hundred and fourteen copies were run off it.',
        'It has a number, so it is in a register, and every number issued in this country since 1855 is in one. Long Registry, shelf 1/A/9, before breakfast.',
      ),
      cinematic('cin-act-2'),
    ],
    allowSkipAfterMs: SKIP,
  },

  // =========================================================================
  // ACT II — SERIES 14/B
  // =========================================================================

  'puz-forty-seven-cards': {
    id: 'puz-forty-seven-cards',
    name: 'The Forty-Seven Cards',
    premise:
      'Sixty thousand cards in four hundred drawers, and an index more honest than the archive it describes — because weeding a file takes an afternoon and weeding an index takes a fortnight, and nobody ever does the index. Drawers 214 to 216, as a routine condition survey. Sort by the object, not the words.',
    hints: [
      'Wren: ‘Sort by the object, not the words. Stock, ribbon, type. The words are what somebody wanted you to read.’',
      'Ottoline, delighted, over tea from drawer 388: ‘Oh, now, the cards have never been retyped, dear. Not in my time. And I have been here since the Ark.’',
      'Halkett: ‘An index is a claim about a holding. Test it the only way there is: ask the holding. A card with no paper behind it is not an error, it is an event.’',
    ],
    onSolve: [
      item('want-list'),
      clue('clue-index-gap'),
      set('want-list-derived'),
      think(
        'Forty-seven cards. All on white smooth wove, and Enid’s stationery invoices put the first delivery of that stock in March 1987. All typed on the Underwood 5, which stands four feet from Ottoline Verge’s chair.',
        'Seven accession numbers with no paper behind them. Oil and Stores 1974. The Lamp Superintendent’s report of the fifteenth of August. Requisitions R.741, R.748 and R.755. The despatch docket of the sixteenth. A memorandum to the Cashier, sixth of November.',
        'Nobody forged anything. Somebody removed seven documents and retyped a drawer thirteen years later so the gap would not show, and forgot that new card stock is as datable as a coin.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  'puz-three-movements': {
    id: 'puz-three-movements',
    name: 'The Three Movements',
    premise:
      'A Chubb three-movement timelock has no keyhole. It cannot be picked, drilled or reasoned with. It can only be told the truth about what hours this building keeps — and it has been told them by hand, every working day, since 1946.',
    hints: [
      'Wren: ‘It does not want a number I invent. It wants a number this building already keeps.’',
      'The instruction plate, brass, cast 1911: MOVEMENT I ORDINARY DAY. MOVEMENT II SATURDAY. MOVEMENT III THE INTERVAL LAST SET.',
      'Pike, without looking up: ‘Order Book. Closing hour, every day since the war. Saturdays are not weekdays and 1974 is not 1998, and if you cannot manage that you have no business behind that door.’',
    ],
    onSolve: [
      sound('lock-click'),
      clue('clue-order-book-closings'),
      set('strongroom-open'),
      { kind: 'unlockScene', scene: 'strongroom' },
      think(
        'Fifteen and a quarter hours on the first: half past five to a quarter to nine. Forty-four and a quarter on the second, because Saturday closes at half past twelve and Monday opens at a quarter to nine.',
        'And the third is whatever interval was last set by hand — the Order Book for the fourteenth of September 1998. Strongroom wound, closed seventeen hundred, to open oh eight hundred.',
        'Handle three-quarters anti-clockwise, and lift. Somebody stood exactly here and wound eleven inches of steel shut at five o’clock on the evening a man died in this building, and wrote it down, and thought nothing of it.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  'puz-bottom-shelf': {
    id: 'puz-bottom-shelf',
    name: 'Bottom Shelf',
    premise:
      'Twenty-three forty. The undercroft sump has backed up in the rain and the water is coming under the door at ankle depth. The movements will not release until seven. Twenty-four boxes on the bottom shelf, a failing torch, and about forty minutes. There is nothing whatever to deduce in here.',
    hints: [
      'Wren, out loud, to nobody: ‘One. Which of these exists anywhere else. Two. Nothing else matters.’',
      'The torch, swung along the top shelf, catches the microfilm register’s twin volume, stencilled FILMED 1994 — SERIES 1/A 2/C 9/E.',
      'Halkett, next morning, on procedure: ‘You will want to say who it was. You will be asked how you know, in a room, by a man paid to ask, and if the answer is that you were frightened and it was dark, he will strike it and he will be right.’',
    ],
    onSolve: [
      item('flimsy-page-two'),
      clue('clue-deed-box-flimsy'),
      set('strongroom-flood-survived'),
      think(
        'Nine boxes of 14/B and a japanned deed box, up onto the top shelf by feel. 1/A, 2/C and 9/E left standing in the water, because they went to film in 1994 and paper that exists twice is not paper you drown for.',
        'A. FERRIER, WARDEN, stencilled on the lid. Empty but for a quarter-century of dust, a dead moth, and one sheet of blue-black flimsy pressed flat by its own weight.',
        'Page two. Page one is ash on my bench upstairs. Somebody kept the half that says nothing and burned the half that says the light could not be relied upon.',
        'And through forty feet of ventilation trunk, two women, and I will write down what I am sure of and mark the rest not certain, because that is what I am.',
      ),
      cinematic('cin-act-3'),
      advanceTo(3),
    ],
    allowSkipAfterMs: SKIP,
  },

  // =========================================================================
  // ACT III — THE FORGERY
  // =========================================================================

  'puz-deakin-authentication': {
    id: 'puz-deakin-authentication',
    name: 'Five Steps on the Deakin Letter',
    premise:
      'Rita’s letter says the beacon was dark and the crew were told to say nothing. It is the only evidence in existence for the thing Wren now believes. The commission obliges her to authenticate it before she can cite it, and it does not contain an exception for a document she badly wants to be true.',
    hints: [
      'Wren: ‘Five steps. Do all five. Doing four is how you get the answer you came in with.’',
      'The paper-stock gazetteer is lying open at the A’s, and ARDWELL BOND has a first-issue date in the right-hand column.',
      'Halkett, asked what happens if it fails: ‘Then you write that it failed, in the same words you would have used if it had passed, and you send it. No, that is not a question for me either. Have you eaten?’',
    ],
    onSolve: [
      item('adverse-report'),
      clue('clue-deakin-letter'),
      set('deakin-adverse-filed'),
      think(
        'Chain lines correct. Fibre correct at forty power. Ribbon ink neutral against all four office machines.',
        'Watermark: ARDWELL BOND, first manufactured June 1981. Frank: Cardew sorting office, which struck its last item on the thirtieth of September 1972.',
        'Not genuine. This sheet cannot have existed on the fourth of March 1975.',
        'And now I write that down in exactly the words I would have used if it had passed, and sign it, and send it, and it will cost somebody everything, and there is no version of the job where I do not.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  'puz-chart-loft': {
    id: 'puz-chart-loft',
    name: 'Three Flashes',
    premise:
      'For twenty-four years the strongest evidence that the Nine Bells was burning has been a truthful nineteen-year-old who saw three flashes, and nobody ever asked her to count the seconds. Under the same lamp, three surveys of the same water disagree about where a ship was.',
    hints: [
      'Wren: ‘Three flashes is not a light. Three flashes and a period is a light.’',
      'The Admiralty List of Lights is open at Ivory Sound. Two entries on the same page begin Fl(3) W and end differently.',
      'Halkett: ‘You do not register a survey by eye and you do not register it on the coastline. You register it on the marks the surveyor put there for the purpose, and if the marks will not lie down together the sheets are not of the same date.’',
    ],
    onSolve: [
      item('light-characteristic-note'),
      item('approach-surveys'),
      clue('clue-light-characteristic'),
      clue('clue-chart-overlays'),
      set('sealed-chamber-found'),
      think(
        'Nine Bells: Fl(3) W 20s. Cadran Point, nine miles south-south-east: Fl(3) W 15s. Norah Feaver counted fifteen on a kitchen clock in Wolverhampton this afternoon, from memory, and she has never once been wrong.',
        'She saw Cadran. She told the exact truth for twenty-four years and it buried a man, because a barrister asked her what she saw and not how long it took.',
        'And registered on the trig marks instead of the coastline, the Inquiry’s reconstructed track sits three hundred and forty yards east of its own finding — dead on the line a competent pilot would steer.',
        'One more thing, which nobody was looking for. The 1948 sheet has a room under the north end of the undercroft, twenty feet by twelve, and it stops existing in 1975.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  'puz-tide-room': {
    id: 'puz-tide-room',
    name: 'The Room That Was Not There',
    premise:
      'Nine courses of brick in a Portland stone opening, laid in cement twenty-three years younger than the wall around it, on Works Order 75/188 — ‘seal chamber, damp’ — initialled p.p. Behind it a machine has been waiting since 1908 to be asked a question, and nobody has wound it since June 1975.',
    hints: [
      'Wren: ‘It was walled up in June 1975. The wreck was November 1974. That is not damp, that is a decision.’',
      'The Kelvin & White instruction plate is under sixty years of salt. Wiped, the numbered list under TO SET GOING is perfectly legible.',
      'Halkett: ‘An instrument that has been stopped proves nothing until it is running, because a stopped instrument is somebody’s word for what it said. Start it in front of yourself, watch it write, and then read the old drums.’',
    ],
    onSolve: [
      item('marigraph-drum-44'),
      item('tide-surge-finding'),
      item('inquiry-working-papers'),
      clue('clue-marigraph-drum'),
      sound('click-brass'),
      think(
        'Weight hung, drum shipped, paper smoked, pen inked to the datum, clutch engaged, clock wound. Six operations in the order the plate gives them — and it starts writing in front of me, which is the only reason I am entitled to believe the old ones.',
        'Drum 1974/44. Twenty-three oh four on the third of November: one metre four above prediction, which is four metres two over the Sowens shoal.',
        'The Inquiry assumed two metres eight, at paragraph forty-four, and destroyed a dead man on the difference.',
        'And behind the marigraph, tied in tape and never accessioned: the Rossport Inquiry’s own working papers, returned to this Authority in 1975 and bricked into a wall the same month.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  'puz-reconciliation': {
    id: 'puz-reconciliation',
    name: 'The Third Column',
    premise:
      'Three books under a bare bulb: the Light Dues Ledger, the Oil Requisition Book for the Nine Bells 1966–1980, and the Keeper’s Wage Sheets. One blank Conservancy reconciliation form. Nobody has ever put these three books on the same table before, because they were kept in three different rooms by three different people who each did their job correctly.',
    hints: [
      'Wren: ‘Cast it week by week. Do not skip to the end. The end is where you make things up.’',
      'Pike, from the doorway, not helping: ‘Three books. If they agreed you would not be sat in my kitchen at one in the morning.’',
      'Halkett: ‘A reconciliation has no opinion in it. You fill it in and then you read what it says, and if you cannot bear what it says that is not a reason to have filled it in differently.’',
    ],
    onSolve: [
      // No chime, no highlight, no cue. The design is explicit: when the third
      // column refuses to agree the score stops and the only sound for eleven
      // seconds is rain on a kitchen window at Cardew.
      { kind: 'setAmbience', ambience: 'rain-window' },
      clue('clue-reconciliation'),
      clue('clue-franking-shortfall'),
      think(
        'Dues collected every week. Wages paid every week. Oil drawn on the twenty-fourth of August 1974 and never again.',
        'Seventy-one days. Ten complete dues weeks. One thousand one hundred and eighty-two vessels charged four thousand one hundred and eighty pounds four shillings for a light that was not burning — and two hundred pounds four shillings paid out over eleven weeks to a keeper who was not there.',
        'And the despatch of the sixteenth of August cost three pounds eleven shillings, which is eight hundred and fifty-two pence, which is two hundred and thirteen impressions at fourpence, against a docket, a post book and a distribution list that all say two hundred and fourteen.',
        'Fourpence. One envelope was not franked and was not posted, and it was the one addressed to the rock.',
      ),
      cinematic('cin-act-4'),
      advanceTo(4),
    ],
    allowSkipAfterMs: SKIP,
  },

  // =========================================================================
  // ACT IV — PER PROCURATIONEM
  // =========================================================================

  'puz-per-procurationem': {
    id: 'puz-per-procurationem',
    name: 'Per Procurationem',
    premise:
      'Forty-eight documents signed A. FERRIER, drawn from four separate custodies so that no one custodian could have faked the set: the strongroom, Pike’s cottage, Enid’s ledgers and Ottoline’s biscuit tin. Sort them into two piles — signed, and signed on behalf of. Wren has known what p.p. means since her first morning, when a kind old woman taught her as an item of housekeeping.',
    hints: [
      'Wren: ‘Bottom left corner. Two millimetres. Every one of them, and no assuming.’',
      'Ottoline’s voice, remembered, over the tray: ‘Per procurationem, dear. On behalf of. We have done it since the Ark.’',
      'Halkett, told the count is forty-one and nothing: ‘Then nothing was forged and you have no forgery case. What you have is a question nobody has ever been obliged to answer, which is who. That is not a question for me. It is very much a question for you.’',
    ],
    onSolve: [
      clue('clue-pp-sort'),
      clue('clue-order-book-offsets'),
      set('pp-boundary-dates-fixed'),
      think(
        'Forty-one and seven. Every single document dated the eleventh of August to the third of November 1974 carries two millimetres of 2H pencil in the bottom left corner. The seven outside that window are a genuine, shaky, unmistakably male hand.',
        'Eleventh of August to the eighteenth of November. Ninety-nine days, taken off the paper and off nothing anybody told me.',
        'Read backwards in a shaving mirror, the offsets on the facing leaves give me the rest: the deferment of the relief keeper with wages to continue, the refusal of R.741, the refusal of R.748.',
        'Nothing was forged. It is scrupulous, it is lawful, it is precisely what Standing Order 4 permits — and in a hundred and eighty-seven years no rule has ever required anybody to write down whose hand held the pencil.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  'puz-switchboard': {
    id: 'puz-switchboard',
    name: 'The Night Plug-Log',
    premise:
      'Twelve lines, six cord pairs, and a call-log book that records cord numbers and durations because the night clerk was nineteen and paid to be quick rather than descriptive. The board has not been patched since 1991. Everything that happened in this building on the night of 3 November 1974 went through these twelve holes.',
    hints: [
      'Wren: ‘The log gives me cords and minutes. The board gives me who. Both, or neither.’',
      'The 1974 internal directory is thumbed open at C, and CARDEW 4471 is annotated in pencil: ‘call box, P.O., for the relief boatman.’',
      'Iveson, on the telephone from Rossport: ‘Their own book, is it. Their own book is their word for it. Find me somebody outside that building who wrote it down for money.’',
    ],
    onSolve: [
      clue('clue-switchboard-log'),
      set('plug-log-reconstructed'),
      think(
        'Twenty-two thirty-four, trunk 3 inbound: Rossport Coastguard to extension 2, the Warden’s Office, six minutes. On a Sunday night, in an office that was supposed to be empty.',
        'Twenty-two forty-one, outbound: extension 2 to trunk 1, Cardew 4471, four minutes, no reply. Then the coastguard relay at six minutes past eleven, the harbourmaster at eleven past, Rossport at nineteen past.',
        'Cardew 4471 is the public call box outside Cardew Post Office. Forty yards from the front door of the relief keeper who should have been on that rock, and he was in the Ship Inn.',
        'Somebody stood in an empty office and let it ring for four minutes, twenty-three minutes before impact. That is not panic. That is somebody doing arithmetic.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  'puz-september-spool': {
    id: 'puz-september-spool',
    name: 'The September Spool',
    premise:
      'Enid Charnock’s stationery rule 4, instituted 1968 and enforced without mercy: no new ribbon is issued until the used spool is returned. Two hundred and forty docketed spools on a shelf. One of them belongs to the Imperial 66, returned on 21 September 1998 — and a fabric ribbon remembers everything typed on it, once, in order, backwards.',
    hints: [
      'Wren: ‘A ribbon is a serial record. It has no memory of what it was for and no reason to lie about the order.’',
      'Enid, before she resigns: ‘I don’t keep used ribbons, whatever would I want with used ribbons.’ Her own ledger, rule 4, is on the shelf above the two hundred and forty of them.',
      'Halkett: ‘The words are not your evidence, the sequence is. Anyone can produce a sentence. Nobody can produce a sentence that has another sentence physically behind it on the same strip of fabric.’',
    ],
    onSolve: [
      clue('clue-ribbon-spool'),
      set('ribbon-read'),
      say(
        'Imperial 66, spool of 12 September 1998',
        '‘I know what you mean to send. Please do not send it. There is nothing in it that can help anybody now. S.’',
      ),
      think(
        'Splices at the head and at the eighth of September, both marked. Between the twelfth and the fourteenth there is no splice, no eyelet and no colour break at all.',
        'That letter runs directly, on unbroken fabric, into the accident report of the fourteenth of September. Two days.',
        'She knew what he meant to send before he was dead, and she has said in writing three times that she did not — and the only reason there is any proof of it is a stationery economy from 1968.',
      ),
    ],
    allowSkipAfterMs: SKIP,
  },

  // =========================================================================
  // ACT V — THE NINE BELLS
  // =========================================================================

  'puz-the-optic': {
    id: 'puz-the-optic',
    name: 'First Light',
    premise:
      'The optic has been dead since 1974 and it is incomplete, because two Fresnel panels went to Antwerp in a packing crate. Ivo Sandbach drove to Rossport at four this morning and bought one back off a shipping agent with money he does not have, and handed it over wrapped in a fleece, and said nothing. There is no reason to do this. It is not evidence. Nothing in the case turns on it.',
    hints: [
      'Wren: ‘Three flashes in twenty seconds. Not fifteen. Fifteen is nine miles south-south-east and it has never once been wrong.’',
      'The instruction plate inside the lantern door, brass, 1908: ONE REVOLUTION IN TWENTY SECONDS. EIGHTEEN DEGREES THE SECOND. BOLTS TO BE SET IN OPPOSED PAIRS.',
      'Rita, from the gallery, not looking at her: ‘Two seconds apart. That’s what it was. I was five and I could tell it from Cadran with my eyes shut in the back of my dad’s van.’',
    ],
    onSolve: [
      set('nine-bells-lit'),
      sound('click-brass'),
      think(
        'Clips in opposed pairs — one, four, two, five, three, six — and the panel seats true on the third attempt.',
        'Sector plates at nought, thirty-six and seventy-two degrees. Eighteen degrees the second, so a flash at nought, a flash at two, a flash at four, and then sixteen seconds of nothing at all.',
        'Wound to full fall. Escapement release set for twenty-three oh four.',
        'Fl(3) W 20s. It is not an argument, it will never be cited, and no Board will ever hear about it. It is only the truth, set into a machine by hand, and it will be visible from Cardew.',
      ),
    ],
  },

  'puz-board-of-dissolution': {
    id: 'puz-board-of-dissolution',
    name: 'The Board of Dissolution',
    premise:
      'Fourteen hundred hours. Mrs Ellary Voss in the chair, Captain Dunnet as assessor, and Mr Pargeter for the Ministry, whose entire job is to strike. Eight links. Nothing Wren has been told may be used — a confession made to one nineteen-year-old on a rock in a gale is worth precisely nothing. Only what she can hold up to a window. Sabine sits at the side with a 2H pencil behind her ear, taking her own minutes, and does not interrupt once.',
    hints: [
      'Wren’s own casebook, open at the citation column: three assertions on this page have nothing at all in the right-hand box.',
      'Iveson, in the corridor beforehand: ‘That’s an inference, that is. Bring me an object.’',
      'Halkett’s note, folded into the case file: ‘Section 41(6). An assertion supported by a document in the appraiser’s possession stands unless the document is impeached. An assertion supported by what you were told stands until the first question. You have known this since October, and I am not going to have an opinion at this hour.’',
    ],
    onSolve: [
      clue('clue-commission-minute'),
      {
        kind: 'if',
        cond: all(...EIGHT_LINKS, ...COUNTERS_ANSWERED),
        then: [
          set('board-eight-links'),
          tell(
            'Eight links read out. Eight links cited. Every named rebuttal answered off the table with a document, and the last one answered with the Authority’s own pension file.',
          ),
          cinematic('cin-ending-solved'),
          {
            kind: 'endGame',
            ending:
              'ALL EIGHT LINKS STAND. The Board finds corporate manslaughter and misfeasance in public office. The Rossport finding of 1975 is quashed in full and Emrys Tain is exonerated by name, in a document that will be posted to two hundred and fourteen addressees. Sabine Ferrier-Kyne is arrested on the Board Room steps on a charge of the unlawful killing of Cormac Sallow — and because the referral was worded to what the paper proves rather than to what would have been satisfying to say, it sticks. The archive is certified and saved. At 23:04 the Nine Bells shows three flashes in twenty seconds, and nobody on that coast needs it explained to them.',
          },
        ],
        else: [
          {
            kind: 'if',
            cond: all(...EIGHT_LINKS),
            then: [
              set('board-seven-links'),
              tell(
                'The links hold. Not every rebuttal falls, and Mr Pargeter is careful to say so twice, slowly, for the minute.',
              ),
              cinematic('cin-ending-solved'),
              {
                kind: 'endGame',
                ending:
                  'THE LINKS STAND; THE REBUTTALS DO NOT ALL FALL. The Board finds negligence by the Authority. Emrys Tain’s blame is reduced to a contributory finding. The officer who signed for ninety-nine days in 1974 is named only as “an officer of the Authority whose identity is not established by these papers”, and the arrest, when it comes, is on the 1974 offences alone. The archive is certified and saved. At 23:04 the Nine Bells shows three flashes in twenty seconds, and nobody on that coast needs it explained to them.',
              },
            ],
            else: [
              set('board-weak-file'),
              tell(
                'Struck. Struck. On what document, Miss Adare? — Then it is struck, and the transcript will print with the gap in it, because that is what a transcript is for.',
              ),
              cinematic('cin-ending-wrong'),
              {
                kind: 'endGame',
                ending:
                  'THE FILE DOES NOT HOLD. The Board finds misadventure. The Rossport finding of 1975 stands undisturbed with its statutory presumption of correctness intact, Emrys Tain is not cleared, and no person is named. The archive is certified all the same, boxed and carried out to a lorry that is not a pulper — because the record outlives everybody, and that is the one thing this case will not take away from you. At 23:04 the Nine Bells shows three flashes in twenty seconds. It was never evidence. It happens anyway.',
              },
            ],
          },
        ],
      },
    ],
  },
};
