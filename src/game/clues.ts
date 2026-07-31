/**
 * Case-file clues — the casebook.
 *
 * Sixty entries, one per finding in the story bible, in the order the case
 * assembles. `summary` is not a description of the object; it is the note Wren
 * Adare rules into her casebook after reading it, in her own voice, with the
 * numbers in. The deduction board groups by `category` and pins by `bearsOn`.
 *
 * Nothing in here asserts a conclusion the paper does not support. That is the
 * whole discipline of the game: an assertion without a citation is struck,
 * aloud, in front of the player, on 3 November.
 */

import type { Clue, ClueId } from '@/engine/types';

export const clues: Record<ClueId, Clue> = {
  // -------------------------------------------------------------------------
  // ACT I — THE APPRAISAL
  // -------------------------------------------------------------------------

  'clue-fused-commission': {
    id: 'clue-fused-commission',
    name: 'Commission under s.41, Coastal Services Act 1997',
    act: 1,
    category: 'document',
    summary:
      'Two leaves of my own commission welded together by spray and separated by hand at seventy per cent. Everything I am permitted to do on this headland is on this sheet: certify every series in situ by 3 November, or the whole archive is deemed valueless and lawfully pulped on the 4th. My entire authority is a piece of paper I can destroy by hurrying, which is a lesson I would rather have been taught by somebody else’s document.',
  },

  'clue-visitors-book': {
    id: 'clue-visitors-book',
    name: 'Visitors’ Book, 14 September 1998',
    act: 1,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne', 'ottoline-verge', 'bram-aylward'],
    summary:
      'C. SALLOW signed in at 08:56 and never signed out. The “admitted by” column is initialled S.F-K. Not H.P., who runs the counter, and not O.V., who was on the wicket all morning and says so. Two pages on: B. AYLWARD, 6 October — a fortnight before he told me he only got here on Tuesday.',
  },

  'clue-pp-specimen-bundle': {
    id: 'clue-pp-specimen-bundle',
    name: 'The Warden’s Specimen Bundle, 1974',
    act: 1,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Nine documents of August 1974, handed to me in my first half-hour as a courtesy, so that I would not start dating things at her. Every one signed A. FERRIER. Every one carrying, in 2H pencil, two millimetres high, in the bottom left corner, the notation p.p. I have written that down because I write everything down. I do not yet know what I have written down.',
  },

  'clue-pp-taught': {
    id: 'clue-pp-taught',
    name: 'The Requisition-Slip Lesson',
    act: 1,
    category: 'testimony',
    bearsOn: ['ottoline-verge'],
    summary:
      'Mrs Verge, eleven minutes, no notes: white top copy up the tube, pink carbon into the stub book, countersignature box at the foot. “If the Warden’s out, her clerk initials it p.p. — per procurationem, on behalf of. We’ve done it since the Ark.” Standing Order 4. An item of housekeeping so dull that nobody in a hundred and eighty-seven years has thought it worth a marginal note.',
  },

  'clue-docket-fold': {
    id: 'clue-docket-fold',
    name: 'The Ministry Fold and the Squared Tag',
    act: 1,
    category: 'observation',
    bearsOn: ['halvard-pike', 'sabine-ferrier-kyne'],
    summary:
      'Mr Pike, unprompted, four minutes, ending on docketing: exactly one hand in this building endorses a folder the Ministry way — on the outside third, upside down to the tag, so you have to turn the whole file over to read your own file. Whitehall, 1958. Everybody else does it like a Christian. It is an old man’s grievance and it is also a fact about the building, and facts about buildings are cheap to keep.',
  },

  'clue-accident-report': {
    id: 'clue-accident-report',
    name: 'Accident Report, 14 September 1998',
    act: 1,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Typed at 16:50 on the day he died, on the Imperial 66 in the Warden’s Office. Docketed the Ministry way, upside down to the tag. Signed Sabine Ferrier-Kyne — and having now read a good deal of this Authority’s paper, it is the only document I have seen in any of it that she has signed in her own name rather than on behalf of somebody else.',
  },

  'clue-iveson-request-slip': {
    id: 'clue-iveson-request-slip',
    name: 'DS Iveson’s File Request Slip, 2 October 1998',
    act: 1,
    category: 'document',
    bearsOn: ['marren-iveson'],
    summary:
      'Stapled inside the back cover of the coroner’s file where nobody was meant to look for it: a request from DS M. Iveson, Rossport, dated 2 October, three weeks before I landed. She told me she had never laid eyes on this file. Somebody with a warrant card was uneasy about the fall, pulled the papers on her own time, and was told there was nothing in it.',
  },

  'clue-liabilities-item14': {
    id: 'clue-liabilities-item14',
    name: 'Liabilities Schedule, Item 14',
    act: 1,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Superannuation arrears, FERRIER-KYNE, S., £2,140 4s in dispute, claim filed March 1998, reckonable service asserted from 1959. A pension squabble between an officer and her own Authority, and the first statutory duty I discharged on this headland was to clear it off the schedule. Noted the year because I note everything. Cleared it in my first hour.',
  },

  'clue-typewriter-specimens': {
    id: 'clue-typewriter-specimens',
    name: 'Four Machines, Four Injuries',
    act: 1,
    category: 'physical',
    summary:
      'Characterised before dating anything by its typescript, as the practice requires. Imperial 66, Warden’s Office, 1961: lower-case a filling with a hard plug of ink and wax, comma printing 0.4mm high, broken descender on the y. Underwood 5, Rolls Room, 1928: e riding 0.3mm above the baseline, a wandering 3. Olivetti Lettera 32, Registry, 1966: grey doubling from a slack ribbon vibrator, chipped l. Remington Noiseless, Accounts, 1938: heavy g from a bent typebar, capitals dropping 0.2mm. The Imperial’s a has been filling since 1961 at a rate I can plot from dated sheets, which makes that machine a clock.',
  },

  'clue-franking-meter': {
    id: 'clue-franking-meter',
    name: 'The Pitney Postmaster and its Two Registers',
    act: 1,
    category: 'physical',
    summary:
      'Opened under warrant — a GPO offence for everyone else in this building — wound the register drum and read both windows: descending credit, ascending impressions since 1961. It has recorded every penny of postage this Authority has spent for thirty-seven years and has never had an opinion about any of it, never been asked a question, and never been mentioned in a single minute. A counter and a log disagreeing usually means somebody forgot to write something down. Remember that it usually means that.',
  },

  'clue-scorched-carbon': {
    id: 'clue-scorched-carbon',
    name: 'Scorched Carbon of Notice to Mariners 74/119',
    act: 1,
    category: 'physical',
    bearsOn: ['halvard-pike', 'enid-charnock'],
    summary:
      'Fourteen fragments raked out of a sodden ash grate at twenty past one in the morning, floated off in cold water, dried flat between blotters. Assembled, it is a carbon of Notice to Mariners 74/119, drafted 15 August 1974: MARINERS ARE ADVISED THAT THE LIGHT EXHIBITED FROM THE NINE BELLS BEACON MAY NOT BE RELIED UPON UNTIL FURTHER NOTICE. Two facts and I am keeping them separate. Somebody wrote that warning in 1974. Somebody was still trying to burn it forty hours after I arrived.',
  },

  'clue-incinerator-damper': {
    id: 'clue-incinerator-damper',
    name: 'Site Diary Item 41: the Incinerator Damper',
    act: 1,
    category: 'document',
    bearsOn: ['ivo-sandbach'],
    summary:
      '2 September 1998: chimney damper removed by the scaffolders. The flue will not draw and the rain comes straight in at the open head, which is the only reason last night’s fire failed and the only reason I have a document instead of a smell. The demolition of this building saved the evidence in it, which I would call irony if I had the time.',
  },

  'clue-issued-register': {
    id: 'clue-issued-register',
    name: 'Register of Notices Issued, 1974',
    act: 1,
    category: 'document',
    summary:
      'Shelf 1/A/9, bound, foliated, complete: 74/117, 74/118, 74/120. No 74/119. No cancellation minute, no reallocation, no marginal note, no explanation in any hand of any date. A number was used and then unused, and the register does not say by whom or why. That is not clerical error. Clerical error leaves apologies all over the page.',
  },

  // -------------------------------------------------------------------------
  // ACT II — SERIES 14/B
  // -------------------------------------------------------------------------

  'clue-reprax-1974': {
    id: 'clue-reprax-1974',
    name: 'Duplicating Book, 15 August 1974',
    act: 2,
    category: 'physical',
    summary:
      'Reprax counter 41,882 to 42,319: an advance of four hundred and thirty-seven against two hundred and twenty-three impressions logged. Two hundred and fourteen unlogged copies, run on the day 74/119 was drafted, in a room where the counter advances whether the operator writes anything down or not. Schedule D has two hundred and fourteen addressees. The notice was not merely written. It was produced, in full, and stacked.',
  },

  'clue-schedule-d': {
    id: 'clue-schedule-d',
    name: 'Notices to Mariners Distribution List, Schedule D',
    act: 2,
    category: 'document',
    summary:
      'Two hundred and fourteen addressees in statutory precedence, cut as address plates and kept in a cabinet by the sack rack. No. 1 is “The Keeper, Nine Bells Beacon — per relief boatman, Cardew Post Office, tel. Cardew 4471.” The light is told about itself first. That is not sentiment; it is the order of the list, and it has been the order of the list since 1834.',
  },

  'clue-index-gap': {
    id: 'clue-index-gap',
    name: 'Forty-Seven Retyped Index Cards',
    act: 2,
    category: 'physical',
    bearsOn: ['ottoline-verge', 'sabine-ferrier-kyne'],
    summary:
      'Drawers 214–216. Forty-seven cards on white smooth wove, a stock this Authority did not take delivery of before March 1987 on Miss Charnock’s own invoices, typed on a machine whose lower-case e rides 0.3mm high — the Underwood 5, which stands four feet from Mrs Verge’s chair. Cross-referred against the shelf list and the box contents sheets, seven accession numbers in series 14/B exist as cards and do not exist as paper. Weeding a file is an afternoon. Weeding an index is a fortnight. Nobody did it, and that is why I now have a want-list.',
  },

  'clue-w-o-89-2': {
    id: 'clue-w-o-89-2',
    name: 'Memorandum W/O 89/2: Reboxing of Series 14/B',
    act: 2,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'The 1989 reboxing, ordered openly, in daylight, over her own signature, and filed in the policy series where anybody could read it. Attached schedule: twenty-three items in box 17. Present in box 17 today: seventeen. It looks like the entire answer. It is the wrong shape to be the entire answer — nobody signs a concealment in their own name and then indexes it.',
  },

  'clue-substituted-slips': {
    id: 'clue-substituted-slips',
    name: 'Requisition Stubs 2271, 2283, 2291 and 2302',
    act: 2,
    category: 'document',
    bearsOn: ['halvard-pike', 'sabine-ferrier-kyne'],
    summary:
      'Thirty-one requisitions in nine days, logged in my own handwriting out of habit. Four came back wrong. 2271: series 14/B box 4, Oil and Stores, Nine Bells — returned as 14/A box 4, Oil and Stores, Cadran Point. One character. 2283: Despatch Book 1970–79 — NOT TRACED, see W/O 89/2. Standing Order 7 is printed on the back of every slip I have filled in here and read by nobody: every reader’s requisition passes the Warden’s pigeonhole for countersignature before it goes anywhere at all.',
  },

  'clue-sallow-1975-transcript': {
    id: 'clue-sallow-1975-transcript',
    name: 'Sallow’s Evidence, Rossport Inquiry 1975, Day 9',
    act: 2,
    category: 'testimony',
    bearsOn: ['cormac-sallow'],
    summary:
      'Balgowan: “Was the light exhibited on the night of 3 November?” Sallow: “The light was not discontinued.” A Lamp Superintendent answered an operational question with an administrative one, and the whole finding rests on that sentence. Same day: “I have no knowledge of any requisition for oil being refused.” Both answers true as far as he understood them. Both catastrophic. Nobody asked him a second question.',
  },

  'clue-order-book-closings': {
    id: 'clue-order-book-closings',
    name: 'Warden’s Order Book: Closing Hours since 1946',
    act: 2,
    category: 'document',
    summary:
      'Every working day since 1946, the hour this building shut, entered by hand. 1974 kept different hours from 1998, and Saturdays different again, and the Chubb wants all three. The door cannot be picked, drilled or argued with; it can only be told the truth about what hours this building keeps. Note in passing, because I note everything: somebody wound the strongroom at five o’clock on the evening of 14 September 1998.',
  },

  'clue-deed-box-flimsy': {
    id: 'clue-deed-box-flimsy',
    name: 'Page Two of Notice 74/119',
    act: 2,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Back of the bottom shelf, two inches above the flood, in a japanned deed box stencilled A. FERRIER, WARDEN: a quarter-century of paper dust, a dead moth, and one sheet of blue-black flimsy. It is page two of the notice whose page one is ash on my bench. “…until oil supply is restored and the No. 2 vaporiser renewed.” It names the mechanical fault, which ties the notice to whatever report described that fault, and to whatever happened to the oil.',
  },

  'clue-spectacles': {
    id: 'clue-spectacles',
    name: 'Cormac Sallow’s Spectacles',
    act: 2,
    category: 'observation',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'North bay, behind the map presses, on a reading slope where nobody has any business working: a pair of folded spectacles on an open ledger. Six weeks. The police walked through this room twice. A man reading does not fold his spectacles; a man standing up to talk to somebody does. I photographed them from four angles and took the dust from the floor and I did not touch them, and I am not going to.',
  },

  'clue-dust-jar-6': {
    id: 'clue-dust-jar-6',
    name: 'Dust Jar 6 against Coroner’s Exhibit 4',
    act: 2,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Floor dust from the gallery north bay against the turn-ups of the trousers he died in: French chalk, beeswax and a particular salt bloom, occurring together in exactly one room in this building. He was not at the 14/B shelving where his box came from. He was in the dead corner behind the map presses, which has no sightline from anywhere, and which is where two people go when they do not want to be heard. This tells me a room. It does not yet tell me a person.',
  },

  'clue-deakin-letter': {
    id: 'clue-deakin-letter',
    name: 'The Deakin Letter, 4 March 1975',
    act: 2,
    category: 'testimony',
    bearsOn: ['rita-tain'],
    summary:
      'From a crewman named Deakin, out of Miss Tain’s campaign file: the beacon was dark, they all knew, they were told to say nothing. It says, in four sentences, precisely the thing I have come to believe. That is exactly why I have to take it apart before I can cite a word of it, and she will not forgive me for saying so, and she is not going to be wrong to be angry.',
  },

  // -------------------------------------------------------------------------
  // ACT III — THE FORGERY
  // -------------------------------------------------------------------------

  'clue-light-characteristic': {
    id: 'clue-light-characteristic',
    name: 'Norah Feaver’s Three Flashes',
    act: 3,
    category: 'testimony',
    summary:
      'Nine Bells: Fl(3) W 20s. Cadran Point, nine miles south-south-east: Fl(3) W 15s, and has been since 1911. Norah Feaver was nineteen and frightened and has told the exact truth for twenty-four years — she saw three flashes, and so did everybody on that deck. Three flashes either way. Nobody at the Inquiry ever asked her to count the seconds. She counted them for me on a kitchen clock in Wolverhampton in under a minute, and got fifteen, twice. She saw Cadran. The strongest evidence that the beacon was burning has always been the strongest evidence that it was not.',
  },

  'clue-chart-overlays': {
    id: 'clue-chart-overlays',
    name: 'Three Registered Surveys of the Approach',
    act: 3,
    category: 'physical',
    summary:
      '1948, the 1974 buoyage revision and 1998, registered on the light table by the Brannock trig pillar, St Bride’s tower and the Sowens beacon. The Inquiry drew the Pelagia’s reconstructed track on the 1948 sheet. Laid against 1974 buoyage she is not where the finding puts her; she is on the line a competent pilot would steer, to within the width of the pencil. Emrys Tain was where he ought to have been, and it took tracing paper and a pair of dividers. Second thing, which nobody was looking for: the 1948 sheet shows a chamber under the north end of the undercroft that appears on no plan drawn after 1975.',
  },

  'clue-works-order-75188': {
    id: 'clue-works-order-75188',
    name: 'Works Order 75/188: “seal chamber, damp”',
    act: 3,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'June 1975, nine months after the wreck. Nine courses of brick in a Portland stone opening, in a cement twenty-three years younger than the wall round it, to shut a room containing a machine that writes down the height of the sea. Initialled p.p. — and going through the works file forward from 1974, it is the last p.p. anybody ever wrote in this building.',
  },

  'clue-marigraph-drum': {
    id: 'clue-marigraph-drum',
    name: 'Marigraph Drum 1974/44',
    act: 3,
    category: 'physical',
    summary:
      'Kelvin & White stilling-well gauge, installed 1908, unwound since 1975. Re-inked the pen, re-hung the driving weight, wound the movement, and it began writing the height of the sea again while I was standing in front of it. Drum 44: a surge of 1.4 metres above prediction on the night of 3 November 1974. Tain had 4.2 metres over the Sowens, not the 2.8 the finding assumes. The Inquiry’s central assumption about the tide has been wrong for twenty-four years, in a machine’s handwriting, behind a brick wall.',
  },

  'clue-inquiry-rejects': {
    id: 'clue-inquiry-rejects',
    name: 'Persons Considered and Not Called, 1975',
    act: 3,
    category: 'document',
    bearsOn: ['ottoline-verge', 'sabine-ferrier-kyne'],
    summary:
      'Forty-one names, typed on the Underwood 5. No. 29: “Mrs O. Verge — wife of relief keeper — no direct knowledge — not called”, with a small tick in the margin in a hand I have watched make ticks for a week. No. 33: “Miss S. Ferrier — the Warden’s private secretary — no official capacity — not called.” The erasure exists in ink, in the assessor’s own file, and the bundle was returned in 1975 and never accessioned — which is the only reason it survives. Nobody can weed what the index has never heard of.',
  },

  'clue-oil-requisition-book': {
    id: 'clue-oil-requisition-book',
    name: 'Oil Requisition Book, Nine Bells 1966–1980',
    act: 3,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne', 'halvard-pike'],
    summary:
      'On a kitchen table at Cardew, because Mr Pike carried it out of the building in 1985 to save it from a circular that ordered it destroyed. R.741, 13 August. R.748, 9 September. R.755, 7 October. All three of 1974, all three stamped REQUISITION NOT SANCTIONED — REFER WINTER REFIT, all three initialled p.p. Somebody refused a lighthouse its oil three times in eight weeks, in pencil, on behalf of a man whose name is not the name of the person who did it.',
  },

  'clue-lamp-report-15aug': {
    id: 'clue-lamp-report-15aug',
    name: 'Lamp Superintendent’s Report, 15 August 1974',
    act: 3,
    category: 'document',
    bearsOn: ['cormac-sallow'],
    summary:
      'No. 2 vaporiser cracked, reserve oil ninety gallons, “light cannot be maintained beyond the end of the month.” Signed C. SALLOW. It is the document that caused 74/119 to be drafted the same day, and it is the document that destroys his own evidence of 1975. He went into hospital for a hernia on the 20th and came out on 10 October, and I do not believe he ever knew what was done in those seven weeks until he found a piece of paper in his own retirement box at seventy-nine years of age.',
  },

  'clue-despatch-docket': {
    id: 'clue-despatch-docket',
    name: 'Despatch Docket, 16 August 1974',
    act: 3,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Contents docket for the fortnightly batch: 74/117, 74/118, 74/119. The third is not erased, not typed over, not annotated. It is ruled out, once, in 2H pencil, and initialled p.p. Foot of the docket in the clerk’s hand: “214 @ 4d — £3 11s 4d.” This is the moment of the decision. It is in graphite, it is two millimetres high, and it has a date on it.',
  },

  'clue-franking-shortfall': {
    id: 'clue-franking-shortfall',
    name: 'The Franking Shortfall of 16 August 1974',
    act: 3,
    category: 'physical',
    bearsOn: ['enid-charnock', 'sabine-ferrier-kyne'],
    summary:
      'Cross-totalled between the meter recharges of 2 August and 4 September, the despatch of 16 August cost £3 11s 0d. Eight hundred and fifty-two pence. Two hundred and thirteen impressions at fourpence, against a docket, a post book and a distribution list that all read two hundred and fourteen. One envelope in that batch was never franked and never posted, and Schedule D No. 1 is the Keeper of the Nine Bells, care of the call box at Cardew. Fourpence.',
  },

  'clue-reconciliation': {
    id: 'clue-reconciliation',
    name: 'The Reconciliation, July–December 1974',
    act: 3,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne', 'enid-charnock', 'ottoline-verge'],
    summary:
      'Three books on one table for the first time in twenty-four years, because they were kept in three rooms by three people who each did their job correctly. Twenty-seven weeks, four columns. Dues collected every week. Wages paid every week — £200 4s over eleven weeks to a keeper who was not there. Oil drawn on 24 August and never again. Seventy-one days. Ten complete dues weeks. One thousand one hundred and eighty-two vessels charged £4,180 4s 0d for a light that was not burning. I have cast the third column four times. It does not agree and it is not going to.',
  },

  'clue-sundries-column': {
    id: 'clue-sundries-column',
    name: '“Sundry Adjustments (Lights)”',
    act: 3,
    category: 'document',
    bearsOn: ['enid-charnock'],
    summary:
      'A column ruled in by hand on 31 December 1974 in Miss Charnock’s writing, holding £4,180 4s 0d that has not moved in ninety-six quarters. The sum is exactly the dues collected on a dark light. She invented a heading to put it under and has carried it forward for twenty-four years without a single query from anybody. That is either the whole crime or the record of an instruction, and I do not yet have the instruction.',
  },

  'clue-sallow-r755': {
    id: 'clue-sallow-r755',
    name: 'Sallow’s File Copy of Requisition R.755',
    act: 3,
    category: 'physical',
    bearsOn: ['cormac-sallow', 'rita-tain'],
    summary:
      'In a box in a shed at the slipway that nobody has opened since the funeral. Refused, stamped, initialled p.p. — and signed on the front, by him, in his own hand, before the anaesthetic. He was seventy-nine, alone at a kitchen table sorting his retirement papers, and he recognised the hand that made those initials because he had watched it write for twenty-six years. Then he wrote nine lines to a stranger and posted them. That is the whole of why I am on this headland.',
  },

  // -------------------------------------------------------------------------
  // ACT IV — PER PROCURATIONEM
  // -------------------------------------------------------------------------

  'clue-pp-sort': {
    id: 'clue-pp-sort',
    name: 'The p.p. Sort: Forty-Eight Signatures',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Forty-eight documents signed A. FERRIER, drawn from four custodies that have never spoken to one another: the strongroom, Pike’s cottage, Miss Charnock’s ledgers and Mrs Verge’s biscuit tin. Sorted into signed and signed-on-behalf-of, the answer is forty-one and none. Every document between 11 August and 3 November 1974 is per procurationem. The seven outside those dates are a genuine and badly shaking man’s hand. Nothing here is forged. Standing Order 4 permitted it, Article 9 of the Charter required it, and no rule anywhere in a hundred and eighty-seven years required anybody to write down who was holding the pencil.',
  },

  'clue-locum-mileage': {
    id: 'clue-locum-mileage',
    name: 'Dr Munn’s Locum Mileage Claims, 1974',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Brannock House, fourteen miles, twice weekly, from 12 August 1974 to the following spring. An expense claim, kept for tax, filed by a locum who wanted his petrol money and had no interest of any kind in this case — and it incidentally documents the collapse of a man who is supposed to have signed forty-one documents after the date of the first visit.',
  },

  'clue-nurse-ledger': {
    id: 'clue-nurse-ledger',
    name: 'Nurse Kilbride’s Visit Ledger, 1974',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      '“12.8.74 — pt. hemiplegic R side, no speech, cannot hold pen, wife present.” Found in a paint store that used to be a sickroom, three feet from an invalid chair under a dust sheet and an unfaded rectangle on the wallpaper where a bed stood for two years. Absalom Ferrier signed nothing after 11 August 1974 because he was physically incapable of signing anything at all.',
  },

  'clue-order-book-offsets': {
    id: 'clue-order-book-offsets',
    name: 'Mirror Offsets of the Razored Order Book',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'The leaves for 11 August to 3 November 1974 were taken out at the gutter with a razor, in 1989, neatly, by somebody who was not in a hurry. Fifteen years of shelf pressure had already printed their ink in mirror image onto the facing pages. Raking light at a shallow angle and a shaving mirror recover three passages: the deferment of the relief keeper, two of the three oil refusals, and the instruction that the wages were to continue. You can cut a page out of a book. You cannot cut it out of the page it has been pressed against since 1974.',
  },

  'clue-deferment-letter': {
    id: 'clue-deferment-letter',
    name: 'Cass Verge’s Deferment Letter, 18 August 1974',
    act: 4,
    category: 'document',
    bearsOn: ['ottoline-verge', 'sabine-ferrier-kyne'],
    summary:
      '“Your autumn residence at the Nine Bells is deferred pending refit. Wages will continue. You will not discuss this with the Lamp Superintendent or with any other officer.” Initialled p.p. This is the order that emptied the rock, and it made certain that Accounts would never ask a question, because nothing in Accounts changed. His widow has kept it in a biscuit tin on a dresser for twenty-four years, believing she was protecting the wrong man.',
  },

  'clue-sundries-memo': {
    id: 'clue-sundries-memo',
    name: 'Memorandum to the Cashier, 6 November 1974',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne', 'enid-charnock'],
    summary:
      '“The Nine Bells oil column is to be carried to Sundry Adjustments (Lights) pending refit.” Initialled p.p., dated three days after the wreck, folded inside the back cover of the 1974 cash book where Miss Charnock has looked at it perhaps four hundred times. It clears her entirely and it turns a catastrophe into a concealment, and it was ordered from an office, in writing, while they were still bringing bodies into St Bride’s.',
  },

  'clue-switchboard-log': {
    id: 'clue-switchboard-log',
    name: 'Night Plug-Log, 3 November 1974',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Twelve-line board, six cord pairs, re-patched call by call against the night clerk’s shorthand. 22:34 IN, Rossport Coastguard to extension 2, six minutes. 22:41 OUT, extension 2 to Cardew 4471, four minutes, no answer recorded. Then 23:06, 23:11, 23:19, tumbling over each other. Extension 2 is the Warden’s Office, on a Sunday night. Cardew 4471 is the public call box forty yards from the relief keeper’s front door. Somebody sat in an empty office and let a telephone ring at a man who was in the Ship Inn, and did it twenty-three minutes before the ship struck and twenty-four years too late.',
  },

  'clue-gpo-account': {
    id: 'clue-gpo-account',
    name: 'GPO Itemised Trunk Account, Q4 1974',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      '“3.11.74 — CARDEW — 22.41 — 4 min — 1s 9d”, initialled EC. The Post Office kept it, for money, and nobody in Pilotage House had a vote about a line of it. The plug-log is this Authority’s own book and a competent Ministry man would strike it as self-serving in four seconds. This is not this Authority’s book, and it says the same thing to the minute.',
  },

  'clue-petty-cash-voucher': {
    id: 'clue-petty-cash-voucher',
    name: 'Petty Cash Travel Voucher, 4 November 1974',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      '“S. Ferrier — Brannock to Cardew, return — 3s 6d — urgent, on the Warden’s instruction.” The morning after thirty-one people drowned, a woman with no official capacity in this Authority took a car to the village where the relief keeper lived. She claimed the fare. It was authorised, paid, and pasted into a book, and it has been sitting in a petty cash box for twenty-four years being three shillings and sixpence.',
  },

  'clue-bank-refusal': {
    id: 'clue-bank-refusal',
    name: 'Naismith’s Bank Letter, 15 August 1974',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'No further facility, no extension, regrets. On the day 74/119 was drafted and R.741 refused, this Authority was about four months from insolvency, and there was no money for a vaporiser until the winter refit and no honest way of pretending otherwise. Motive, in a bank manager’s handwriting, and there is nothing whatever criminal on the face of it.',
  },

  'clue-ministry-review': {
    id: 'clue-ministry-review',
    name: 'Quinquennial Review Notice, 22 July 1974',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'An authority found to be without an effective Warden was to be abolished, its officers dismissed and its records dispersed. Dated six weeks before the stroke and acknowledged in the Warden’s own in-tray. This is the other half of the motive and it is the reason nobody could be told: the moment anybody outside this building learned that the Warden could not hold a pen, there would have been no Authority, no sixty jobs, and no archive.',
  },

  'clue-charter-art9': {
    id: 'clue-charter-art9',
    name: 'Charter of 1811, Article 9',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      '“The said office of Warden shall be holden by a man of full age.” Never amended in a hundred and eighty-seven years; still on vellum in a case in the Board Room, twelve feet from where I shall have to argue this. The clause that would not let her sign her own name is the same clause that meant the Inquiry had no name to call. The contempt and the alibi are one sentence, written when the Prince Regent was on the throne.',
  },

  'clue-a-curve-applied': {
    id: 'clue-a-curve-applied',
    name: 'The Imperial 66 ‘a’-Occlusion Curve',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Plotted from dated specimens, 1961 to 1998: the counter of the lower-case a filling with ink and wax at a rate that is nearly a straight line. The 1974 refusals sit at partial occlusion, exactly where the curve puts that August. The 1998 accident report sits at full. The new label on box 17 sits at full. Same machine, same room, twenty-four years apart — and the machine is still under the window and weighs eighteen kilos and can be carried into a hearing.',
  },

  'clue-ribbon-spool': {
    id: 'clue-ribbon-spool',
    name: 'Used Ribbon Spool, Imperial 66, September 1998',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne', 'enid-charnock'],
    summary:
      'Docketed “IMPERIAL 66 — W.O. — fitted 2.9.98 — returned 21.9.98” and shelved with two hundred and thirty-nine others, because Miss Charnock will not issue a new ribbon until she has the old one back. Wound under magnification and read backwards, in unbroken sequence, with no splice, no eyelet and no colour break anywhere between them: 12.9.98 — “I know what you mean to send. Please do not send it. There is nothing in it that can help anybody now. S.” — a letter never posted — and then, immediately after it, the accident report of the 14th. She knew what he intended two days before he died. She has denied that in writing three times.',
  },

  'clue-site-diary-rail': {
    id: 'clue-site-diary-rail',
    name: 'Site Diary Items 41 and 63: the Gallery Rail',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne', 'ivo-sandbach'],
    summary:
      'Item 41, 2 September: “gallery rail nth bay, baluster 3 loose, made safe pending order.” Item 63, 15 September: “gallery rail nth bay made good at Warden’s personal instruction, out of programme, no order no., not billed.” The defect was recorded. The morning after a man went over it, it was quietly repaired off the programme, with no order number and no invoice, at the personal instruction of the one person in this building who cannot cause anything else to happen without leaving a paper trail behind her.',
  },

  'clue-gallery-timeswitch': {
    id: 'clue-gallery-timeswitch',
    name: 'Gallery Time-Switch, 14 September 1998',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'The north bay has no daylight. It is lit by a twenty-minute spring time-switch with a counter read at lock-up and charged to the Lights account, because in this building even the electricity is audited. Eleven windings on 14 September: two hundred and twenty minutes of light for a visit of eighty-eight, with the last winding logged by the caretaker at 17:40 — seven hours after Cormac Sallow died and fifty minutes after the accident report was typed. Somebody went back up.',
  },

  'clue-reprax-1998': {
    id: 'clue-reprax-1998',
    name: 'Duplicating Book, 14 September 1998',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne', 'halvard-pike'],
    summary:
      'Counter advanced forty-one against twelve logged: twenty-nine unaccounted impressions on the day of the death, in a room whose book is Mr Pike’s and whose keeper was nine miles away on the 08:15. Twenty-six and three is twenty-nine, and I shall have to find twenty-six of something before I am allowed to write that sentence down as an assertion.',
  },

  'clue-ferry-booking-book': {
    id: 'clue-ferry-booking-book',
    name: 'Rossport Ferry Booking Book, 14 September 1998',
    act: 4,
    category: 'document',
    bearsOn: ['halvard-pike', 'sabine-ferrier-kyne'],
    summary:
      'H. PIKE, out 08:15, return 17:40. He was off this headland for the whole of the relevant period. He did not work the counter, did not issue slip R98/2211, did not run twenty-nine impressions and did not order a repair to a rail. The clue that clears the obvious suspect is the same clue that asks who worked the counter instead, and there is exactly one set of initials in that column.',
  },

  'clue-slip-r982211': {
    id: 'clue-slip-r982211',
    name: 'Requisition Slip R98/2211, 09:10, 14 September 1998',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Pink carbon in the stub book: C. SALLOW, series 14/B box 17. “Issued by” — S.F-K. I read this slip in my first hour on this headland and turned the page. With the ferry book it puts the Warden at the registry counter, and therefore at the strongroom, and therefore on the gallery stair, on the morning she says she spent in the Board Room with a quantity surveyor whose meeting, in Dr Sandbach’s own diary, was on the fifteenth.',
  },

  'clue-board-working-file': {
    id: 'clue-board-working-file',
    name: 'The Warden’s Board of Dissolution Working File',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Twenty-six Reprax copies of the contents of series 14/B box 17. Correctly foliated, correctly indexed, docketed on the outside third, upside down to the tag. Four of them are copies of documents that are no longer in box 17 and no longer anywhere. She copied the evidence, destroyed the originals and filed the copies — because she is an archivist to the bone and destruction is the one act she has never in her life been able to make herself perform. Twenty-six, and three of the accident report, is twenty-nine.',
  },

  'clue-box17-relabel': {
    id: 'clue-box17-relabel',
    name: 'Series 14/B Box 17, Relabelled',
    act: 4,
    category: 'physical',
    bearsOn: ['sabine-ferrier-kyne'],
    summary:
      'Requisitioned at 09:10 on 14 September 1998, no return entry against the slip, standing on its own shelf behind a timelock that only the Warden can set, wearing a label typed on the Imperial 66 at full ‘a’ occlusion. A box came home that was never sent home, and somebody typed it a new name before it went back on the shelf.',
  },

  'clue-keepers-log': {
    id: 'clue-keepers-log',
    name: 'Nine Bells Keeper’s Log, final entry 24 August 1974',
    act: 4,
    category: 'physical',
    summary:
      'In the rack in the oil store where he left it, in a smell of cold paraffin that has not moved since. Final entry, 24 August 1974, 22.10: “No. 2 vapor. cracked. Oil out. Light down. Nothing more to be done here.” It was kept by a keeper and not by this Authority, and it never entered this Authority’s custody, which is the entire value of it. On the back of the last page, in pencil: tea, boot polish, a birthday card for Nan.',
  },

  'clue-kestrel-mandate': {
    id: 'clue-kestrel-mandate',
    name: 'The Kestrel Bequest',
    act: 4,
    category: 'document',
    bearsOn: ['sabine-ferrier-kyne', 'rita-tain'],
    summary:
      'Bank mandate and trust deed, established 4 April 1977 through Mowbray & Slee of Rossport out of Isobel Ferrier’s legacy. Thirty-one index-linked standing orders, paid monthly for twenty-one years, in amounts too small for any auditor to find interesting. Matched against the Pelagia manifest, thirty of the beneficiaries are dependants of the drowned. The thirty-first is M. TAIN. She has been paying Rita Tain thirty-four pounds a month to fight her, since before Rita was thirty, and the deed does not name the settlor.',
  },

  'clue-commission-minute': {
    id: 'clue-commission-minute',
    name: 'Conservancy Commission Minute, 3 October 1998',
    act: 4,
    category: 'document',
    bearsOn: ['phyllida-halkett'],
    summary:
      'Nomination of W. Adare, apprentice conservator, 3 October 1998. Miss Halkett fell in the stairwell at Ilberry on the 12th. She had put my name down nine days before that, and has let me believe, and let the Conservancy believe, that the hip was the reason. She did not send an apprentice by accident. She sent a stranger, because a dead man asked for one.',
  },
};
