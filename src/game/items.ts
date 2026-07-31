/**
 * Inventory objects.
 *
 * Almost everything in this game is paper, and paper is a physical body: it
 * has a stock, a watermark, a chain-line count, a ribbon, a frank, a fold and
 * a smell. `description` is the object as a painter would need it — one flat
 * unlit ground, one object, museum-accession key light, per the art bible.
 * `examineText` is Wren Adare looking at it properly, which is the only
 * superpower she has.
 *
 * `category` drives the inventory grouping: `evidence` and `document` items
 * are exhibits and cannot be discarded; `tool`, `key` and `personal` are
 * equipment. `combinesWith` is declared where a puzzle design calls for two
 * objects to become a third — a floated fragment and a blotter set becoming a
 * carbon, a carbon and a flimsy becoming a whole notice, a retyped notice and
 * a dead fourpenny die becoming, twenty-four years late, a posted one.
 */

import type { Item, ItemId } from '@/engine/types';

export const items: Record<ItemId, Item> = {
  // ==========================================================================
  // WREN'S KIT — the tools of the trade, most of them in the satchel on day one
  // ==========================================================================

  'commission-s41': {
    id: 'commission-s41',
    name: 'Commission under Section 41',
    icon: './art/items/commission-s41.webp',
    category: 'document',
    description:
      'Four leaves of heavy laid foolscap in a buff Conservancy wrapper, tied with green tape. An embossed seal at the foot of the last page, a countersignature in violet ink, and a wavy grey tide-mark across leaves two and three where the sea got in.',
    examineText:
      'BY COMMISSION of the National Records Conservancy under section 41 of the Coastal Services Act 1997: W. ADARE, apprentice conservator, is authorised to enter, appraise, requisition, open and certify. It is the only reason a nineteen-year-old can make a Warden hand over a strongroom key, and it is four sheets of paper that spent twenty minutes in a wet satchel. Leaves two and three carry the series schedule and Miss Halkett’s countersignature, which are the two things anybody will ever ask to see.',
  },

  'conservation-kit': {
    id: 'conservation-kit',
    name: 'Conservancy Field Kit',
    icon: './art/items/conservation-kit.webp',
    category: 'tool',
    description:
      'A canvas tool roll, unrolled: bone folder, brass microspatula, a folded square of Gore-Tex membrane, a pad of white blotters, a small glass plate, a lead weight in a felt sleeve, and eight numbered instruction cards tucked into the lid.',
    examineText:
      'Two years of the Ilberry store are in this roll. Card 3, which she can recite: HUMIDIFICATION AND SEPARATION — the sheet tells you when, you do not tell the sheet. Card 7 gives the standard specimen line for characterising a typewriter. The microspatula has her initials scratched on the tang because in a shared workroom everything walks. Nothing in here will open a door or hurt anybody; all of it is for making paper agree to be read.',
    combinesWith: [
      { item: 'ash-fragments', produces: 'notice-74-119-carbon' },
    ],
  },

  casebook: {
    id: 'casebook',
    name: 'The Casebook',
    icon: './art/items/casebook.webp',
    category: 'personal',
    description:
      'A wire-bound notebook with a marbled cover gone soft at the corners, a pencil through the spiral, and every page ruled by hand into three columns: ASSERTION, SOURCE, CITATION. A passport photograph of a silver-haired woman is clipped inside the front cover.',
    examineText:
      'She rules the citation column herself, in pencil, before she writes anything in it, because a column drawn afterwards is a column drawn to fit. The rule she was taught in her first month and has never broken: an assertion in the left column with nothing in the right is not evidence, it is an opinion with good manners. By the third of November this notebook is going to be the most important exhibit in the case, and at present it contains a sketch of a pneumatic tube head and the closing hours of a building since 1946.',
    combinesWith: [{ item: 'specimen-sheets', produces: 'specimen-album' }],
  },

  'fibre-loupe': {
    id: 'fibre-loupe',
    name: 'Fibre Loupe',
    icon: './art/items/fibre-loupe.webp',
    category: 'tool',
    description:
      'A blackened brass cylinder about the length of a thumb, with a knurled focusing collar, a ground-glass base ring and 40× cut into the barrel above a maker’s name half worn away.',
    examineText:
      'Forty power, which is enough to see what a sheet is actually made of: rag fibre lying long and irregular like straw in a field, or wood pulp lying short and dead flat. A stock can lie about its date on the watermark and it cannot lie about that. There is a lower setting at four power for glyphs and ribbon ink, and a hairline reticle she has never once needed and would not part with.',
  },

  'hooded-torch': {
    id: 'hooded-torch',
    name: 'Hooded Torch',
    icon: './art/items/hooded-torch.webp',
    category: 'tool',
    description:
      'A rubber-collared works torch with a black tin hood clipped over the lens to throw a narrow cone, the barrel scratched to bare metal and a strip of masking tape on it reading ILBERRY STORE — RETURN.',
    examineText:
      'Conservancy issue, hooded because raking a beam across a dark shelf tells you nothing and a narrow cone tells you everything. The cell is the flat rectangular sort you cannot buy on this coast after five o’clock, and the one in it has done a fortnight of night work already. In four inches of cold water on a strongroom floor that will matter more than anything else she owns.',
  },

  'paper-gazetteer': {
    id: 'paper-gazetteer',
    name: 'Conservancy Paper-Stock Gazetteer',
    icon: './art/items/paper-gazetteer.webp',
    category: 'tool',
    description:
      'A squat blue-cloth handbook, thumb-indexed, swollen at the fore-edge from damp and re-sewn along the spine with linen thread. Mounted specimen chips are tipped in along the margins.',
    examineText:
      'Every paper stock manufactured for British government and commercial use since 1900, by maker, by mill, by watermark, with first and last dates of issue and a chip of the actual sheet gummed beside the entry so you can feel it. ARDWELL BOND: first issued June 1981. It is the dullest book she owns, it weighs nine hundred grams, and it will kill a document stone dead in about forty seconds.',
  },

  'beta-radiograph-sheets': {
    id: 'beta-radiograph-sheets',
    name: 'Beta-Radiograph Reference Sheets',
    icon: './art/items/beta-radiograph-sheets.webp',
    category: 'tool',
    description:
      'A stiff card folder of transparent films, each a ghostly grey-white image of a sheet of paper with its chain lines and watermark standing out like a skeleton, numbered in the corner in white chinagraph.',
    examineText:
      'Radiographs of known sheets, made by laying the paper on film with a weak beta source until the density of the pulp draws its own portrait. Laid over a suspect document on a light table you can count its chain lines in a twenty-five millimetre window and compare the spacing to the reference. Mould-made papers hold their chain spacing to a quarter of a millimetre for the life of the mould, and a forger has to get a real sheet of the real period or not bother.',
  },

  'shaving-mirror': {
    id: 'shaving-mirror',
    name: 'Shaving Mirror',
    icon: './art/items/shaving-mirror.webp',
    category: 'tool',
    description:
      'A small round bevelled mirror on a folding chrome stand, the silvering going black in a crescent along one edge, taken off a washstand shelf and never returned.',
    examineText:
      'Off the shelf in the visitors’ washroom, and she will put it back. Where the ink of a page has pressed against its facing page for fifteen years, the offset is perfectly legible and perfectly backwards, and the equipment required to read it is a raking lamp and a nine-inch mirror that cost somebody four shillings in about 1955.',
  },

  dividers: {
    id: 'dividers',
    name: 'Dividers and Parallel Rule',
    icon: './art/items/dividers.webp',
    category: 'tool',
    description:
      'A pair of brass-jointed steel dividers with worn needle points, and a mahogany-and-brass parallel rule, both lifted out of a felt-lined drawer in the Chart Loft with a chandler’s label still gummed inside the lid.',
    examineText:
      'Chart-room instruments, unchanged in design since about 1820, and the whole of navigation is these two objects and a scale bar. Step the dividers along the printed scale and a distance becomes a number; walk the parallel rule across from the compass rose and a course becomes a number. What a competent pilot would have steered across the Sowens is not a matter of opinion. It is thirty seconds’ work with sixty pounds’ worth of brass.',
  },

  'treasury-tag': {
    id: 'treasury-tag',
    name: 'Squared Treasury Tag',
    icon: './art/items/treasury-tag.webp',
    category: 'personal',
    description:
      'A short length of green waxed string with a flat metal bar swaged at each end, tied off in a neat squared knot, tail under, loop left.',
    examineText:
      'Mr Pike squared it for her at the counter without asking, in about two seconds, while continuing to tell her what was wrong with the Conservancy. Tail under, loop left. He called it her people’s knot, which was meant unkindly. She has kept it in the casebook because a man who has tied treasury tags for forty-four years ties them the same way every time, and so, it turns out, does everybody else.',
  },

  'ten-pence-pieces': {
    id: 'ten-pence-pieces',
    name: 'Pocketful of Tens',
    icon: './art/items/ten-pence-pieces.webp',
    category: 'personal',
    description:
      'A loose handful of ten-pence pieces, some of the big old ones, some of the small new ones, wrapped in a torn strip of paper bag with a total pencilled on it.',
    examineText:
      'One pound eighty in tens, which the girl in the Rossport ferry office changed for her out of the till with an expression. The box on the quay eats them at a rate she has now measured: the pips come about every ninety seconds on a trunk call to Ilberry, and Miss Halkett explaining the certification procedure for a series takes rather longer than that. Advice is free. Hearing the end of a sentence costs ten pence.',
  },

  'dry-bag': {
    id: 'dry-bag',
    name: 'Rita’s Dry Bag',
    icon: './art/items/dry-bag.webp',
    category: 'tool',
    description:
      'A scuffed orange roll-top bag in heavy proofed fabric, the closure a stiff plastic clip, a shackle and a length of blue cord knotted through the eyelet, salt-bloomed white along the folds.',
    examineText:
      'It lives on the Ardent’s cabin sole under the flare box and it has kept a spare jersey dry since 1988. It will hold, at a guess, one bound volume and no more, and everything else that comes off that rock comes off in somebody’s coat. Miss Tain rolled the top down three times and clipped it without being asked and said nothing at all about what that meant.',
  },

  crowbar: {
    id: 'crowbar',
    name: 'Crowbar',
    icon: './art/items/crowbar.webp',
    category: 'tool',
    description:
      'A four-foot forged steel wrecking bar, gooseneck at one end and a chisel blade at the other, mill-scale black with the working edges polished bright, a smear of yellow site paint at the balance point.',
    examineText:
      'Off Sandbach’s scaffold deck, where there are nine of them and nobody counts. Nine kilos, and the whole of it is leverage. She has spent two years learning to open things with a spatula and a hygrometer and forty seconds of patience, and tonight she is going to open nine courses of Victorian brick in horizontal rain because there is no delicate way to do it and no time to find one.',
  },

  // ==========================================================================
  // KEYS
  // ==========================================================================

  'strongroom-key': {
    id: 'strongroom-key',
    name: 'Strongroom Key',
    icon: './art/items/strongroom-key.webp',
    category: 'key',
    description:
      'A long steel lever key, five inches, the bit deeply and irregularly cut, hanging from a brass fob stamped 3 and a slip of card in copperplate reading STRONGROOM ANTE.',
    examineText:
      'Third hook on the board by the wicket, where the Warden said every key in the building would be, including her own. It opens the ante-room only. The strongroom door itself has no keyhole at all and never has: a Chubb three-movement timelock cannot be picked, drilled or reasoned with, and can only be told the truth about what hours this building keeps.',
  },

  'beacon-padlock-key': {
    id: 'beacon-padlock-key',
    name: 'Nine Bells Padlock Key',
    icon: './art/items/beacon-padlock-key.webp',
    category: 'key',
    description:
      'A stubby brass padlock key gone green in the wards, on a loop of tarred marline, with a boxwood tally tag burnt N. BELLS — ENTRANCE and a second, later tag in biro that says the same thing.',
    examineText:
      'It has hung on the hook board since 1974 and has been dusted round for twenty-four years. The bronze door at the foot of the tower was padlocked when the last keeper came off and nobody has had any reason to open it since, which is why the key is here, nine miles from the lock, and why nobody has ever thought that was strange. Take it before the boat, or the crossing is for nothing.',
  },

  // ==========================================================================
  // ACT I
  // ==========================================================================

  'sallow-letter': {
    id: 'sallow-letter',
    name: 'Cormac Sallow’s Letter, 11 September 1998',
    icon: './art/items/sallow-letter.webp',
    category: 'document',
    description:
      'A single sheet of cheap lined writing pad, folded in three, in a large upright hand in blue ballpoint that presses hard enough to emboss the back. Two forwarding stamps and a Conservancy date stamp in the top corner.',
    examineText:
      'Nine lines. No explanation, no accusation, nothing about himself, no request for a reply. It gives the series reference, states that the writer was Lamp Superintendent from 1958 to 1984, and ends: “I would be obliged if series 14/B were read by a stranger before it leaves this building.” Posted 11 September, forwarded twice, reached the Conservancy on 1 October. He was dead on the 14th. Everything Wren has done for nine days is the discharge of a requisition slip filled in by a man who never met her.',
  },

  'liabilities-schedule': {
    id: 'liabilities-schedule',
    name: 'Schedule of Outstanding Liabilities',
    icon: './art/items/liabilities-schedule.webp',
    category: 'document',
    description:
      'Four foolscap sheets clipped at the head, ruled and typed in a column of numbered items with a money column at the right, several items ruled through in red with an initial and a date beside them.',
    examineText:
      'Twenty-two claims the Authority must clear before it can be dissolved: unpaid coal, a disputed ferry account, a boundary wall at St Bride’s. Item 14 is a pension arrears claim — FERRIER-KYNE, S., £2,140 4s, reckonable service asserted from 1959 — and Wren cleared it in her first hour because it is exactly the sort of dull administrative tidying a section 41 commission exists to do. It is also, though nobody will notice for another week, the only document in a hundred and eighty-seven years in which Sabine Ferrier-Kyne asks to be counted as having been here.',
  },

  'specimen-sheets': {
    id: 'specimen-sheets',
    name: 'Four Typewriter Specimen Sheets',
    icon: './art/items/specimen-sheets.webp',
    category: 'document',
    description:
      'Four half-sheets of clean bank paper, each with the same three lines struck on it and a pencilled note of the machine, the room and the date at the foot. The typescript on each is a slightly different colour of black.',
    examineText:
      'The standard specimen line off card 7, struck once on each survivor: Imperial 66, Underwood 5, Olivetti Lettera 32, Remington Noiseless. Every machine in the world acquires injuries and never recovers from them — a clogged counter, a typebar bent by a jam in 1953, a letter riding high because somebody dropped the carriage. Four sheets of housekeeping. In nine days one of them will be the difference between an assertion and a citation.',
    combinesWith: [{ item: 'casebook', produces: 'specimen-album' }],
  },

  'specimen-album': {
    id: 'specimen-album',
    name: 'Typewriter Specimen Album',
    icon: './art/items/specimen-album.webp',
    category: 'document',
    description:
      'A double casebook spread with the four specimens tipped in on paper hinges, each glyph of interest ringed in pencil and labelled in a small careful hand: CLOGGED COUNTER, RIDING HIGH, DOUBLING, DROPPING.',
    examineText:
      'Mounted, dated, ringed and annotated, with the four defects named in the Conservancy’s own vocabulary so that nobody can argue about what she means. Imperial 66: a filling with a hard plug of ink and wax, comma 0.4mm high, broken y descender. Underwood 5: e riding 0.3mm, wandering 3. Olivetti: grey doubling, chipped l. Remington: heavy g, capitals dropping 0.2mm. Any typescript in this building can now be put to one of four rooms, and after that all that remains is to ask who was in it.',
  },

  'meter-card-book': {
    id: 'meter-card-book',
    name: 'Meter Card Book',
    icon: './art/items/meter-card-book.webp',
    category: 'document',
    description:
      'A slim oblong book of perforated card counterfoils, each stamped by the Post Office with a date and two six-figure readings, the used ones torn out along the perforation and the stubs remaining in date order since 1961.',
    examineText:
      'Every time the meter is taken to the Post Office to be recharged, a clerk who has never heard of this case reads both registers and stamps the figures on a counterfoil. Descending credit, ascending total. Which means that between any two recharges, the exact sum of postage this Authority spent is a subtraction, and the exact number of impressions it struck is another one, and neither figure has ever passed through anybody’s hands in this building. Recharges of 2 August and 4 September 1974 are three inches apart in this book.',
  },

  'fourpenny-die': {
    id: 'fourpenny-die',
    name: 'The Superseded Fourpenny Die',
    icon: './art/items/fourpenny-die.webp',
    category: 'tool',
    description:
      'A small steel meter die on a knurled boss, the printing face a mirror-reversed crown and value with the figures 4d, the whole thing furred with dried red ink and wrapped in a twist of oiled paper.',
    examineText:
      'Withdrawn at decimalisation and never surrendered, because in this building nothing is ever surrendered, only put in a drawer. It has struck perhaps two hundred thousand impressions and none since February 1971. The face is sharp. Fourpence is the difference between a warning that went out to two hundred and fourteen addressees and a warning that went out to two hundred and thirteen, and this is the object that would have made it.',
    combinesWith: [
      { item: 'notice-74-119-retyped', produces: 'notice-74-119-issued' },
    ],
  },

  'ash-fragments': {
    id: 'ash-fragments',
    name: 'Fragments from the Ash Grate',
    icon: './art/items/ash-fragments.webp',
    category: 'evidence',
    description:
      'Fourteen irregular pieces of charred paper floating in an enamel tray of cold water, black and curling at the edges, the largest the size of a hand, one carrying two legible words in reversed carbon-purple.',
    examineText:
      'Raked out of a sodden grate at twenty past one in the morning and floated off the brick one at a time, because dry char goes to dust between finger and thumb and wet char will lift whole if you are patient. Paper curls toward the fire: the blackest edges were the outside of the sheet and belong at the perimeter of whatever this was. Carbon impression, not ink — which means this is a file copy, which means somewhere there was a top copy, which means somewhere there was a distribution.',
    combinesWith: [
      { item: 'conservation-kit', produces: 'notice-74-119-carbon' },
    ],
  },

  'notice-74-119-carbon': {
    id: 'notice-74-119-carbon',
    name: 'Scorched Carbon of Notice 74/119',
    icon: './art/items/notice-74-119-carbon.webp',
    category: 'evidence',
    description:
      'A sheet of thin flimsy reassembled from fourteen fragments between two glass plates, brown-edged and holed, the carbon typescript purple-black and the char line running across it like a coastline.',
    examineText:
      'NOTICE TO MARINERS 74/119. Drafted 15 August 1974. MARINERS ARE ADVISED THAT THE LIGHT EXHIBITED FROM THE NINE BELLS BEACON MAY NOT BE RELIED UPON UNTIL FURTHER NOTICE. Page one of two; the second sheet is not in this tray. The Register of Notices Issued for 1974 runs 74/118, 74/120, with no cancellation and no minute. Somebody wrote this warning. Somebody stopped it. And somebody, forty hours after she landed, was standing in the rain trying to burn it.',
    combinesWith: [{ item: 'flimsy-page-two', produces: 'notice-74-119' }],
  },

  'pelagia-manifest': {
    id: 'pelagia-manifest',
    name: 'Pelagia Passenger and Crew Manifest',
    icon: './art/items/pelagia-manifest.webp',
    category: 'document',
    description:
      'Three foolscap carbons stapled at the corner, a typed list of names with ages, embarkation port and berth, and a later hand adding a small pencil cross beside thirty-one of them.',
    examineText:
      'One hundred and eighteen aboard, inbound for Rossport, 3 November 1974. Somebody in this building went down the list afterwards and put a small pencil cross against the drowned, and did it neatly, and did it with a ruler under the line so as not to mark the wrong name. Thirty-one crosses. Wren has copied the surnames and initials into the casebook without knowing yet what she will need them for, because a list of names is cheap to keep and impossible to reconstruct.',
  },

  'quinquennial-review-notice': {
    id: 'quinquennial-review-notice',
    name: 'Quinquennial Review Notice, 22 July 1974',
    icon: './art/items/quinquennial-review-notice.webp',
    category: 'document',
    description:
      'A single Ministry circular on thin blue-tinged paper with a printed crown at the head, three paragraphs, a reference number, and a rubber date stamp of receipt across the corner.',
    examineText:
      'Paragraph 3: an authority found upon review to be without an effective Warden shall be recommended for abolition, its officers discharged and its records dispersed to such repositories as the Minister may direct. It is a form letter. It went to eleven pilotage authorities that July and ten of them filed it and forgot it. It reached this in-tray twenty days before the Warden of this Authority had a cerebral haemorrhage in his own hall.',
  },

  // ==========================================================================
  // ACT II
  // ==========================================================================

  'order-book-working-copy': {
    id: 'order-book-working-copy',
    name: 'Order Book (Working Copy)',
    icon: './art/items/order-book-working-copy.webp',
    category: 'document',
    description:
      'A slim oblong duplicate book in limp black cloth, the pages ruled in narrow columns of dates and times in a dozen different hands, a rubber band round it and a strip of card marking 1974.',
    examineText:
      'The registry keeps a working copy so the bound original never leaves the Muniment Room, and it records the same dull thing every working day since 1946: the hour this building shut. 1974 shut at 17:30, and at noon on Saturdays. 1998 shuts at 17:00. The Chubb’s three movements want all three figures and will not take two out of three. She can carry this to the door, which is the only mercy in the whole arrangement.',
  },

  'flimsy-page-two': {
    id: 'flimsy-page-two',
    name: 'Page Two of Notice 74/119',
    icon: './art/items/flimsy-page-two.webp',
    category: 'evidence',
    description:
      'A single sheet of blue-black flimsy, pressed flat and slightly cockled, the typescript grey where the ribbon was tired, the top edge showing a rusty offset where a paperclip sat for twenty-four years.',
    examineText:
      'It was lying at the bottom of a japanned deed box under a quarter-century of its own dust, held flat by nothing but its own weight, two inches above the water line. “…until oil supply is restored and the No. 2 vaporiser renewed. By order, A. FERRIER, Warden.” And in the bottom left corner, two millimetres high, in 2H pencil: p.p. The mechanical fault is named. Which means a report named it first, and somebody read that report and did the arithmetic.',
    combinesWith: [{ item: 'notice-74-119-carbon', produces: 'notice-74-119' }],
  },

  'notice-74-119': {
    id: 'notice-74-119',
    name: 'Notice to Mariners 74/119, complete',
    icon: './art/items/notice-74-119.webp',
    category: 'evidence',
    description:
      'Two sheets under glass in a Melinex sleeve, side by side: a fire-eaten purple carbon and a clean blue-black flimsy, the type of both continuing across the join in the same measure and the same tired ribbon.',
    examineText:
      'The whole of it, from two custodies twenty yards and twenty-four years apart, and the ribbon impression runs on across the break without a stumble. A warning that the Nine Bells could not be relied upon, drafted the same day as the report that gave the reason, with the fault named and the remedy costed and two hundred and fourteen copies run off in the Duplicating Room before the ink was dry. It was never issued. Nothing in this building says who decided that, and everything in this building was in a position to.',
  },

  'naismiths-bank-letter': {
    id: 'naismiths-bank-letter',
    name: 'Naismith’s Bank Letter, 15 August 1974',
    icon: './art/items/naismiths-bank-letter.webp',
    category: 'evidence',
    description:
      'Engraved bank letterhead on heavy cream wove, six typed lines and a fountain-pen signature with a manager’s name typed beneath it, a rusty pin-hole through the top left corner.',
    examineText:
      '“…the Bank is not able to extend further facility to the Authority, and would be glad of an early indication of the Board’s proposals.” The Authority’s balance that August would have carried it to about the middle of December. It is a perfectly ordinary letter that a perfectly ordinary bank sends every day of the week, and it is dated the same day as a report of a cracked vaporiser, a drafted warning and a refused requisition for oil.',
  },

  'want-list': {
    id: 'want-list',
    name: 'The Want-List',
    icon: './art/items/want-list.webp',
    category: 'document',
    description:
      'A casebook page torn out along the perforation and folded once, seven accession numbers written down the left margin in pencil with a ruled column beside them, three of the lines already annotated.',
    examineText:
      'Seven accession numbers in series 14/B that exist as index cards and do not exist as paper. The index betrayed the file because weeding a file is an afternoon and weeding an index is a fortnight and nobody has ever once had the fortnight. Wren does not know what any of the seven documents are. She knows their numbers, their dates, and the eleven words of their card descriptions, and that is a shopping list, and she intends to fill it.',
  },

  'dust-jar-6': {
    id: 'dust-jar-6',
    name: 'Dust Reference Jar 6',
    icon: './art/items/dust-jar-6.webp',
    category: 'evidence',
    description:
      'A small screw-top glass specimen jar a third full of pale grey dust, with a gummed label in pencil: 6 — MUNIMENT GALLERY, N. BAY, FLOOR, BEHIND MAP PRESSES — 28.x.98 — W.A.',
    examineText:
      'Swept up with a card and a clean brush from a strip of floor eighteen inches by four. French chalk from the map presses, beeswax from the reading slope, and a salt bloom that comes through the limewash on that one north-facing wall and nowhere else in the building. Six jars have come off six floors this week and five of them are controls. This is a room, in a jar, and rooms cannot be argued with.',
    combinesWith: [{ item: 'coroner-exhibit-4', produces: 'dust-comparison' }],
  },

  'coroner-exhibit-4': {
    id: 'coroner-exhibit-4',
    name: 'Coroner’s Exhibit 4',
    icon: './art/items/coroner-exhibit-4.webp',
    category: 'evidence',
    description:
      'A brown paper evidence envelope, string-and-washer closure, seals broken and re-signed twice, containing the folded turn-ups cut from a pair of grey worsted trousers with grey dust still lodged in the seam.',
    examineText:
      'Released by the coroner’s officer on a Thursday, against a signature and a receipt, because nobody had asked for it and nobody was ever going to. What is in the turn-up of a man’s trouser is where he last stood still. There is no blood on it and nothing dramatic about it. There is about a gram of grey dust, and it has been in a paper envelope in a cupboard in Rossport for six weeks doing nothing at all.',
    combinesWith: [{ item: 'dust-jar-6', produces: 'dust-comparison' }],
  },

  'dust-comparison': {
    id: 'dust-comparison',
    name: 'Dust Comparison Slides',
    icon: './art/items/dust-comparison.webp',
    category: 'evidence',
    description:
      'Two glass microscope slides taped side by side on a card mount, each with a smear of grey dust under a cover slip, labelled JAR 6 and EX. 4, with a pencilled note of magnification and date beneath.',
    examineText:
      'Chalk, wax and salt bloom in the same three proportions in both, at forty power, and the salt bloom is the tell because it comes off one wall in one bay of one room. He did not fall from the 14/B shelving where his box had come from. He was standing in the dead corner behind the map presses, which has no sightline from anywhere in the building, which is where two people go when they do not wish to be overheard. It names a room. It does not yet name a second person.',
  },

  'deakin-letter': {
    id: 'deakin-letter',
    name: 'The Deakin Letter',
    icon: './art/items/deakin-letter.webp',
    category: 'evidence',
    description:
      'A single typed sheet of white bond, creased in four as though carried in a pocket, with a smudged circular postmark on a pasted-on envelope corner and a signature in blue biro that presses through the paper.',
    examineText:
      '“Dated 4 March 1975. I was fireman aboard the Pelagia. The Nine Bells was dark and every man on that ship knew it, and we were told at Rossport to say nothing about the light and we said nothing.” Four sentences, and they say the exact thing Wren has spent four days coming to believe. Which is why she is going to put it under a raking lamp, count its chain lines, look at its fibre at forty power, find its sorting office in a gazetteer and compare its ribbon against four specimen albums — and she already knows, in the way you know a thing you have not proved, that it is going to fail.',
  },

  'memo-wo-89-2': {
    id: 'memo-wo-89-2',
    name: 'Memorandum W/O 89/2',
    icon: './art/items/memo-wo-89-2.webp',
    category: 'document',
    description:
      'Two typed sheets with a schedule stapled behind, the Authority’s printed memorandum head, a firm upright signature in black ink and a policy-file punch through the top margin.',
    examineText:
      '“Rationalisation and Reboxing of Series 14/B”, 1989, signed in her own name, filed in the policy series where anyone appraising the Authority would be certain to find it, with the reboxing schedule attached. The schedule lists twenty-three items in box 17. There are seventeen in box 17. It looks exactly like the answer to everything and it is the wrong shape to be the answer to anything: no one signs a concealment in their own name, indexes it, and puts it where the auditors keep their coats.',
  },

  'binocular-glasses': {
    id: 'binocular-glasses',
    name: 'The Ardent’s Glasses',
    icon: './art/items/binocular-glasses.webp',
    category: 'tool',
    description:
      'A heavy pair of brass-bound 7×50 marine binoculars in cracked black leather, the eyecups perished, a broad canvas strap, and a brass plate on the bridge engraved with a dealer’s name in Rossport.',
    examineText:
      'They live in the locker under the Ardent’s port berth wrapped in a jersey, and they are older than everybody who has used them. At four hundred yards through blowing spray, with the horizon going up and down four feet, they show a hundred and twelve feet of coursed granite, a black cast-iron gallery, a lantern the colour of a cataract — and a gallery door standing open, which nobody who has told her they never go out to the rock in the off season is going to be able to explain.',
  },

  'admiralty-list-1974': {
    id: 'admiralty-list-1974',
    name: 'Admiralty List of Lights, 1974',
    icon: './art/items/admiralty-list-1974.webp',
    category: 'document',
    description:
      'A thick official volume in stiff blue paper covers with the year in white on the spine, foxed at the fore-edge, opened flat at a ruled table of columns: number, name, position, characteristic, elevation, range.',
    examineText:
      'The dullest book on any bridge in the world and there is a copy on every one of them. Entry 4118, NINE BELLS: Fl(3) W 20s, 34m, 18M. Entry 4131, CADRAN POINT, nine miles south-south-east: Fl(3) W 15s, 21m, 15M, and it has shown that since 1911. Three flashes either way. The only thing that distinguishes them from a deck at night is a number of seconds, and no one at the Rossport Inquiry asked a single witness for a number of seconds.',
    combinesWith: [
      { item: 'feaver-timing-note', produces: 'light-characteristic-note' },
    ],
  },

  'schedule-d-plates': {
    id: 'schedule-d-plates',
    name: 'Schedule D and its Address Plates',
    icon: './art/items/schedule-d-plates.webp',
    category: 'document',
    description:
      'A typed distribution list of numbered addressees, and beside it a shallow wooden tray of embossed metal address plates in their runners, brass-edged, the first plate standing slightly proud of the rest.',
    examineText:
      'Two hundred and fourteen addressees in statutory precedence: keepers, then pilots, then harbourmasters, then coastguard stations, then the shipping companies, then the newspapers. No. 1 is “The Keeper, Nine Bells Beacon — per relief boatman, Cardew Post Office, tel. Cardew 4471.” The light is always told about itself first. It is not sentiment. It has been the order of the list since 1834, and it means that if exactly one envelope in a batch fails to be posted, you can say precisely whose it was.',
  },

  // ==========================================================================
  // ACT III
  // ==========================================================================

  'mortar-sample': {
    id: 'mortar-sample',
    name: 'Mortar Sample',
    icon: './art/items/mortar-sample.webp',
    category: 'evidence',
    description:
      'Two thumb-sized lumps of set mortar in a labelled polythene bag, one pale and gritty with visible lime lumps, the other grey, dense and smooth, with a scale card behind them.',
    examineText:
      'One from the Portland stone opening, one from the nine courses of brick filling it. Lime and sharp sand against ordinary Portland cement: two entirely different centuries of building practice, four inches apart, and there is no arguing with the set. Dr Sandbach, who cares about nothing in this building but the programme, wrote a note about the same two mortars in the site hut in September and thought he was complaining about damp.',
  },

  'approach-surveys': {
    id: 'approach-surveys',
    name: 'Three Surveys of the Nine Bells Approach',
    icon: './art/items/approach-surveys.webp',
    category: 'document',
    description:
      'Three rolled sheets held with tape ties: two on brittle linen-backed cartridge, one on modern film, all three carrying the same three small triangulation crosses and a printed scale bar along the foot.',
    examineText:
      '1948, the 1974 buoyage revision, and 1998. Registered over one another on the light table by the Brannock trig pillar, St Bride’s tower and the Sowens beacon, they should tell the same story about the same water. The Rossport Inquiry drew the Pelagia’s reconstructed track on the 1948 sheet, because it was the sheet on the wall, and nobody in 1975 checked what the buoyage had done in twenty-six years. The mark that matters is not on the water at all: on the 1948 sheet there is a chamber under the north end of the undercroft that no plan after 1975 admits exists.',
  },

  'feaver-timing-note': {
    id: 'feaver-timing-note',
    name: 'Norah Feaver’s Timing',
    icon: './art/items/feaver-timing-note.webp',
    category: 'document',
    description:
      'A casebook page in pencil, headed with a date and a telephone number, covered in short tally strokes in three rows with times written beside them and one figure circled twice.',
    examineText:
      'Taken down in a call box on Rossport quay with sixty pence left, while a woman of forty-three in Wolverhampton tapped a kitchen table with a teaspoon against her own kitchen clock. Flash, flash, flash — dark — and then again. Fifteen seconds, twice, and then fourteen, and then fifteen, and she apologised for the fourteen. She has been telling the exact truth for twenty-four years and no living soul has ever asked her this question. The Nine Bells is twenty.',
    combinesWith: [
      { item: 'admiralty-list-1974', produces: 'light-characteristic-note' },
    ],
  },

  'light-characteristic-note': {
    id: 'light-characteristic-note',
    name: 'Characteristic Comparison: Nine Bells / Cadran',
    icon: './art/items/light-characteristic-note.webp',
    category: 'evidence',
    description:
      'A ruled casebook spread with two timing diagrams drawn one above the other in pencil — three short marks and a long gap, twice, at different spacings — and the List of Lights entries copied out beneath each with their numbers.',
    examineText:
      'Fl(3) W 20s and Fl(3) W 15s, nine miles apart on the same bearing from the same deck, drawn to scale so that anybody can see it in two seconds. Norah Feaver saw three flashes and told the truth about it under oath and has never wavered, and what she saw was Cadran Point. For twenty-four years the strongest evidence that the Nine Bells was burning has been a frightened nineteen-year-old whom nobody asked to count, and it is now the strongest evidence that it was dark.',
  },

  'marigraph-drum-44': {
    id: 'marigraph-drum-44',
    name: 'Marigraph Drum 1974/44',
    icon: './art/items/marigraph-drum-44.webp',
    category: 'evidence',
    description:
      'A brass-ended cylinder wrapped in a sheet of smoked paper, the black lampblack surface scratched through by a fine continuous curve that rises and falls twice across the sheet, with dates inked on the trailing edge.',
    examineText:
      'A pen on a clockwork drum has been scratching the height of the sea onto smoked paper here since 1908 without an opinion in its head, and this is the week of 3 November 1974. Laid under the predicted-tide transparency it is 1.4 metres high at 23:00 — a surge, southwesterly, nothing remarkable for the time of year. Emrys Tain had 4.2 metres over the Sowens shoal, not the 2.8 the finding assumes at paragraph 44. Nobody wound this machine after 1975 and nobody bricked it up for that reason, and it is still the most honest witness on the headland.',
    combinesWith: [
      { item: 'tide-tables-1974', produces: 'tide-surge-finding' },
    ],
  },

  'tide-tables-1974': {
    id: 'tide-tables-1974',
    name: 'Admiralty Tide Tables, 1974',
    icon: './art/items/tide-tables-1974.webp',
    category: 'document',
    description:
      'A limp-bound volume of dense figure tables with a transparent overlay of predicted tidal curves tucked inside the back board, the cover ringed by a wet cup and the corner gnawed by something.',
    examineText:
      'Predicted heights and times for every standard port on the coast, computed years in advance by people who have never seen the sea. The overlay is the useful half: laid over a real trace, the difference between what the sea was told to do and what it did comes off a vernier scale in about four seconds. Predicted high water at Rossport on 3 November 1974 was 22:47.',
    combinesWith: [
      { item: 'marigraph-drum-44', produces: 'tide-surge-finding' },
    ],
  },

  'tide-surge-finding': {
    id: 'tide-surge-finding',
    name: 'Tidal Finding, 3 November 1974',
    icon: './art/items/tide-surge-finding.webp',
    category: 'evidence',
    description:
      'A drum trace and a printed prediction curve pinned together over a light box, the two lines diverging visibly toward the right-hand edge, with the gap measured off in pencil and a figure written against it twice.',
    examineText:
      '1.4 metres above prediction at 23:00 on 3 November 1974, measured off a machine that was walled up nine months later. Paragraph 44 of the Rossport finding says the Pelagia grounded because she was set inshore in water shoaler than her master supposed. She had a metre and a half more under her than the assessors gave her. The pilot did not put her on the reef by misjudging the depth. He put her where a competent man would have put her, steering for a light.',
  },

  'inquiry-working-papers': {
    id: 'inquiry-working-papers',
    name: 'Rossport Inquiry Working Papers',
    icon: './art/items/inquiry-working-papers.webp',
    category: 'document',
    description:
      'A fat untidy bundle of foolscap tied crosswise with faded pink tape, edges cockled and spotted with mould bloom, no file cover, no accession label, a compliments slip from the assessor’s clerk on top.',
    examineText:
      'Returned to the Authority in 1975 when the Inquiry closed, and walled up in the same month. Draft findings with the deletions still visible, the assessors’ marginal queries, the running list of witnesses, a seating plan for Day 9. It has never been accessioned, which means it appears in no index, in no shelf list and on no transfer schedule. Which means, uniquely in six hundred feet of shelving, that nobody could ever have weeded it, because nobody in this building has ever known it was here.',
  },

  'rejects-list': {
    id: 'rejects-list',
    name: 'Persons Considered and Not Called',
    icon: './art/items/rejects-list.webp',
    category: 'evidence',
    description:
      'Four foolscap sheets of numbered names and one-line reasons, typed with a lower-case e riding slightly high, several entries carrying a small neat tick in the left margin in soft pencil.',
    examineText:
      'Forty-one names, each with a reason typed beside it. No. 29: “Mrs O. Verge — wife of relief keeper — no direct knowledge — not called”, and beside it a tick, in a hand Wren has watched make ticks all week. No. 33: “Miss S. Ferrier — the Warden’s private secretary — no official capacity — not called.” Somebody considered her, wrote down that she had no official capacity, and moved on to number 34. The erasure is not a conspiracy. It is a clerk being accurate.',
  },

  'oil-requisition-book': {
    id: 'oil-requisition-book',
    name: 'Oil Requisition Book, Nine Bells 1966–1980',
    icon: './art/items/oil-requisition-book.webp',
    category: 'evidence',
    description:
      'A wide quarter-bound counterfoil book with marbled boards, worn white at the corners, the stubs bearing carbon impressions and three of them struck across with a large rubber stamp in faded red.',
    examineText:
      'R.741, 13 August 1974, 400 gallons. R.748, 9 September, 400 gallons. R.755, 7 October, 250 gallons. Each one signed out by the Lamp Superintendent or his deputy. Each one returned stamped REQUISITION NOT SANCTIONED — REFER WINTER REFIT. Each one initialled in the corner in soft pencil, and beside the initials, two millimetres high, p.p. Three refusals in eight weeks, on a light with ninety gallons in the tank, and this book has been on a dresser at Cardew since 1985 because a chief clerk stole it to stop the Ministry burning it.',
  },

  'despatch-book': {
    id: 'despatch-book',
    name: 'Despatch Book 1970–79',
    icon: './art/items/despatch-book.webp',
    category: 'evidence',
    description:
      'A heavy oblong ledger in green buckram with a red leather spine label, the pages ruled into fortnightly dockets of contents, addressee counts and postage, and one line ruled through in fine pencil.',
    examineText:
      'The docket for 16 August 1974 lists 74/117, 74/118 and 74/119, and against the third somebody has drawn a single ruled line — not scribbled, not erased, not typed over — and initialled it, and put p.p. beside the initials. At the foot, in the despatch clerk’s round hand: “214 @ 4d — £3 11s 4d.” The batch went out that afternoon. The book says two hundred and fourteen envelopes. Somewhere else in this building is a machine that counted them.',
  },

  'lamp-report-15aug': {
    id: 'lamp-report-15aug',
    name: 'Lamp Superintendent’s Report, 15 August 1974',
    icon: './art/items/lamp-report-15aug.webp',
    category: 'evidence',
    description:
      'A single typed foolscap on the Authority’s printed report form, boxes filled in with figures, a large plain signature at the foot, and a red pencil ring round one line of the stores return.',
    examineText:
      '“No. 2 vaporiser cracked at the throat, not repairable on station. Reserve oil 90 gallons. Light cannot be maintained beyond the end of the month. Recommend immediate supply and renewal of vaporiser.” Signed C. SALLOW. He wrote it on the fifteenth and went into hospital on the twentieth for a hernia and came out on 10 October, and in 1975 he told an Inquiry on oath that he had no knowledge of any requisition being refused, and he believed that, and it was true of everything he had been allowed to see.',
  },

  'reconciliation-form': {
    id: 'reconciliation-form',
    name: 'Conservancy Reconciliation Form',
    icon: './art/items/reconciliation-form.webp',
    category: 'document',
    description:
      'A large ruled pro-forma sheet, twenty-seven week rows and four money columns headed DUES COLLECTED, WAGES PAID, OIL DRAWN and DIFFERENCE, the first rows filled in in pencil in a small upright hand.',
    examineText:
      'Form C/41/7. It exists so that an appraiser can put three series that were never designed to be read together onto one sheet of paper and see whether an institution’s account of itself holds. Nobody has ever put the Light Dues Ledger, the Oil Requisition Book and the Keeper’s Wage Sheets on the same table, because they were kept in three rooms by three people who each did their job correctly. The fourth column casts itself. That is the trouble with it.',
  },

  'cash-book-1974': {
    id: 'cash-book-1974',
    name: 'Cash Book, 1974',
    icon: './art/items/cash-book-1974.webp',
    category: 'evidence',
    description:
      'A thick ledger in oxblood buckram, boards scorched black along one edge and the fore-edge swollen with water, the ruled pages inside dry and intact, a hand-ruled extra column pencilled in at the right of the December spread.',
    examineText:
      'Taken out of a fire at ten to eleven at night by a woman of sixty-three in a coat over her nightdress who could not make the thing burn and could not make herself stop trying. The last spread of the year carries a column that is not printed on the form: “Sundry Adjustments (Lights)”, ruled in by hand on 31 December 1974, holding £4,180 4s 0d that has not moved in ninety-six quarters. The back cover is stiffer than it ought to be, and Miss Charnock would not let Wren near it.',
  },

  'sallow-r755': {
    id: 'sallow-r755',
    name: 'Sallow’s File Copy of R.755',
    icon: './art/items/sallow-r755.webp',
    category: 'evidence',
    description:
      'A yellow flimsy carbon counterfoil, softened and furred at the folds from being carried in a pocket, a red rubber stamp across the face and a signature in indelible pencil on the front.',
    examineText:
      'His own copy, kept out of thirty years of them, in a box in a shed at the slipway that nobody has opened since the funeral. Refused. Stamped. Initialled p.p. And signed on the front, by him, on 7 October 1974 — which is what destroys his own evidence to the Inquiry, and which he would have known the moment he saw it. He was seventy-nine, alone at a kitchen table with his retirement papers, and he recognised the hand that made those initials because he had watched it write for twenty-six years. Then he wrote nine lines and posted them, and told nobody, not even Rita.',
  },

  'postmark-gazetteer': {
    id: 'postmark-gazetteer',
    name: 'Post Office Gazetteer of Sorting Offices',
    icon: './art/items/postmark-gazetteer.webp',
    category: 'tool',
    description:
      'A fat red-cloth reference volume, thumb-indexed, dense with tiny facsimile postmark rings printed four to a line, each with an office code and two dates in brackets.',
    examineText:
      'Every sorting office in the country, every die it ever struck, and — the column that matters — the date the office opened and the date it shut. CARDEW (CDW): closed 30 September 1972, work transferred to Rossport. A frank is not a claim about a date. It is a physical act performed by a machine in a building, and if the building was not there the machine was not there either.',
  },

  'adverse-report': {
    id: 'adverse-report',
    name: 'Adverse Report on the Deakin Letter',
    icon: './art/items/adverse-report.webp',
    category: 'document',
    description:
      'A Conservancy pro-forma of five numbered test boxes, each ticked PASS or FAIL, with a finding line at the foot in a small hand and a signature and date beneath a carbon of the same sheet.',
    examineText:
      'Steps 1, 3 and 5 pass. Step 2 fails: Ardwell Bond, first issued June 1981, on a letter dated 1975. Step 4 fails: a Cardew frank on an office that shut in 1972. The finding line, which nobody made her word this way: “The document is not of the date it bears and cannot be relied upon for any purpose.” She filed it because the commission obliges her to file it and because a person who fudges one step will fudge the next, and she knew when she signed it what it would do to Rita Tain, and she signed it anyway, and her hand shook.',
  },

  'revocation-fax': {
    id: 'revocation-fax',
    name: 'Ministry Fax, 16:20, 1 November',
    icon: './art/items/revocation-fax.webp',
    category: 'document',
    description:
      'A curling length of thermal fax roll, grey-black type already beginning to fade at the head, a machine header line of numbers and times printed across the top, torn off square at the foot.',
    examineText:
      '“Informed of a document of doubtful authenticity within a series under appraisal, the commission of W. ADARE under section 41 is revoked with immediate effect pending review. Certification is suspended. Access to the records of the Authority is at the discretion of the Warden.” Timed, logged and filed by the machine itself. For thirty-one hours she is a nineteen-year-old girl standing in somebody else’s building with no legal right to touch anything in it, and the pulper is booked for the fourth.',
  },

  'works-order-75188': {
    id: 'works-order-75188',
    name: 'Works Order 75/188',
    icon: './art/items/works-order-75188.webp',
    category: 'document',
    description:
      'A small buff works docket with printed boxes for trade, materials and hours, filled in in ink in a builder’s hand, a builder’s thumbprint in cement dust at the corner and pencil initials at the foot.',
    examineText:
      '“Undercroft north end: seal chamber, damp. 9 c. brick in c.m., make good render. 2 men, 1½ days.” June 1975. Nine months after the wreck; four months after the Inquiry returned its papers. The initials at the foot are the same two letters that appear on the refusals, and beside them, two millimetres high, in the same soft pencil, p.p. Going forward through the works file from here there is not another one. It is the last per procurationem anybody ever wrote in this building.',
  },

  // ==========================================================================
  // ACT IV
  // ==========================================================================

  'forty-eight-signatures': {
    id: 'forty-eight-signatures',
    name: 'Forty-Eight Documents Signed A. Ferrier',
    icon: './art/items/forty-eight-signatures.webp',
    category: 'evidence',
    description:
      'A squared stack of paper of eight different stocks and four different sizes, interleaved with tissue and held under a glass plate, every sheet carrying the same name in ink at the foot in a hand that varies from firm to a bad tremor.',
    examineText:
      'Drawn from four custodies that have never spoken to one another: the strongroom, a stolen dresser at Cardew, a cashier’s ledgers, a widow’s biscuit tin. That is the point of them. No one custodian could have assembled this set, therefore no one custodian can have faked it. Every sheet is signed A. FERRIER. Two millimetres from the bottom left corner of some of them, and not others, there is a mark in 2H pencil that anybody could see and nobody has looked at for twenty-four years.',
  },

  'nurse-kilbride-ledger': {
    id: 'nurse-kilbride-ledger',
    name: 'Nurse Kilbride’s Visit Ledger, 1974',
    icon: './art/items/nurse-kilbride-ledger.webp',
    category: 'evidence',
    description:
      'A district nurse’s pocket ledger in limp black oilcloth, ruled columns of date, patient, address and treatment in a small round hand, the pages cockled and the last third unused.',
    examineText:
      'Found on a shelf in a paint store that used to be a sickroom, three feet from an invalid chair under a dust sheet and an unfaded rectangle on the wallpaper where a bed stood for two years. “12.8.74 — Brannock Hse — Ferrier, A. — pt. hemiplegic R side, no speech, cannot hold pen, wife present.” The same six words recur, twice weekly, into the following March. A district nurse writes the truth in these because she is not writing for anybody.',
  },

  'munn-mileage-claims': {
    id: 'munn-mileage-claims',
    name: 'Dr Munn’s Locum Mileage Claims',
    icon: './art/items/munn-mileage-claims.webp',
    category: 'document',
    description:
      'A sheaf of small printed expenses claims on pink paper, dates and mileages in a doctor’s scrawl, each initialled by a cashier and stamped PAID with a date, spiked through the corner and rethreaded on tape.',
    examineText:
      'Brannock House, fourteen miles, twice weekly, from 12 August 1974 through to the spring. A locum wanting his petrol money at 4½d a mile, initialled EC and paid. Dr Munn had no interest in this case, no knowledge of the Nine Bells, and no idea he was creating a record of anything at all. That is exactly why it will stand: the most reliable documents in any archive are the ones nobody thought were about anything.',
  },

  'order-book-1972-76': {
    id: 'order-book-1972-76',
    name: 'Warden’s Order Book 1972–1976',
    icon: './art/items/order-book-1972-76.webp',
    category: 'evidence',
    description:
      'A large half-bound ledger in oxblood with brass corner pieces, opened flat to show a gap in the gutter where a block of leaves has been cut out close to the sewing, the stubs a clean bright razor line.',
    examineText:
      'The leaves for 11 August to 3 November 1974 are gone, taken out at the gutter with a razor by somebody who was not in a hurry and who cut inside the sewing so the book still opens flat. It was done in 1989, on the same programme as the reboxing. What could not be cut out is fifteen years of shelf pressure printing the ink of each missing page onto the page it lay against. Raking light, a shaving mirror, and the orders come back mirror-wise out of a blank leaf.',
  },

  'biscuit-tin': {
    id: 'biscuit-tin',
    name: 'The Biscuit Tin',
    icon: './art/items/biscuit-tin.webp',
    category: 'personal',
    description:
      'A dented oblong tin printed with a faded coronation scene, the lid held on with a perished rubber band, containing a folded letter, three buttons, a lock of hair in tissue and a bus ticket.',
    examineText:
      'It stood on Ottoline Verge’s dresser for twenty-four years between a jug and a photograph of a man in keeper’s uniform, and she brought it back down the lane without being asked, walking rather fast, holding it in both hands like something hot. Everything in it belongs to a marriage. One item in it belongs to a Board of Dissolution, and she has known that since 1975, and she made the tea every morning anyway.',
  },

  'deferment-letter': {
    id: 'deferment-letter',
    name: 'Cass Verge’s Deferment Letter',
    icon: './art/items/deferment-letter.webp',
    category: 'evidence',
    description:
      'A single sheet on the Authority’s letterhead, folded in three to fit a tin, the folds worn through to a hole at the crossing, four typed lines and initials in soft pencil at the foot.',
    examineText:
      '“Your autumn residence at the Nine Bells is deferred pending refit. Wages will continue at the full rate. You will not discuss this with the Lamp Superintendent or with any other officer of the Authority.” 18 August 1974. Initialled, and p.p. This is the order that emptied the rock — and the second sentence is the one that did the work, because a keeper on full pay is a keeper Accounts will never ask a question about. Kept for twenty-four years by a widow who believed she was protecting a man who could not hold a pen.',
  },

  'sundries-memo': {
    id: 'sundries-memo',
    name: 'Memorandum to the Cashier, 6 November 1974',
    icon: './art/items/sundries-memo.webp',
    category: 'evidence',
    description:
      'A quarter-sheet memorandum slip, printed head, one typed sentence, folded twice and permanently creased into a shallow rectangle the size of a cash-book cover, initials in soft pencil below.',
    examineText:
      '“The Nine Bells oil column is to be carried to Sundry Adjustments (Lights) pending refit.” One sentence, three days after thirty-one people drowned, while they were still bringing them into St Bride’s. Initialled p.p. It has lived folded inside the back cover of the 1974 cash book for twenty-four years, where Enid Charnock has looked at it perhaps four hundred times and taken it to mean that the Warden was too ill to sign, and never once taken it to mean that the Warden did not write it.',
  },

  'gpo-trunk-account': {
    id: 'gpo-trunk-account',
    name: 'GPO Itemised Trunk Account, Q4 1974',
    icon: './art/items/gpo-trunk-account.webp',
    category: 'evidence',
    description:
      'A long concertina-folded computer printout on green-lined paper, columns of dates, exchange names, times, durations and amounts in shillings and pence, one line ticked in the margin in ballpoint.',
    examineText:
      '“3.11.74 — CARDEW — 22.41 — 4 min — 1s 9d”, initialled EC where she checked it against the ledger in January 1975 and passed it for payment. The Post Office produced this for money, about a customer it had never met, on a machine in Bristol. Nobody in Pilotage House had a vote on a line of it, nobody in Pilotage House could alter it, and it agrees with this Authority’s own plug-log to the minute.',
  },

  'petty-cash-voucher': {
    id: 'petty-cash-voucher',
    name: 'Petty Cash Travel Voucher, 4 November 1974',
    icon: './art/items/petty-cash-voucher.webp',
    category: 'evidence',
    description:
      'A small printed voucher on flimsy pink paper, gummed into a stub book and torn along the perforation, the amount in a ruled money box and two signatures, one claiming and one authorising.',
    examineText:
      '“S. Ferrier — Brannock to Cardew, return — 3s 6d — urgent, on the Warden’s instruction.” Claimed on the morning of 4 November 1974 and paid out of the tin the same day. A woman with no official capacity in this Authority took a car nine miles to the village where the relief keeper lived, the morning after the wreck, and did the one thing that guarantees a record of it: she asked for her fare back.',
  },

  'ribbon-spool-september': {
    id: 'ribbon-spool-september',
    name: 'Used Ribbon Spool, September 1998',
    icon: './art/items/ribbon-spool-september.webp',
    category: 'evidence',
    description:
      'A black-inked fabric typewriter ribbon on a two-inch metal spool, tied off with cotton, a small buff docket wired to the flange in a cashier’s handwriting, the ribbon showing a faint continuous relief of struck characters.',
    examineText:
      '“IMPERIAL 66 — W.O. — fitted 2.9.98 — returned 21.9.98.” One of two hundred and forty on a shelf, because Enid Charnock has refused to issue a new ribbon without the old one since 1968 and has been laughed at for it for thirty years. A fabric ribbon takes everything once, in order, backwards, and never forgets a word of it. Nobody has ever asked this shelf a question. It has been answering one for thirty years.',
  },

  'site-diary': {
    id: 'site-diary',
    name: 'Sandbach’s Site Diary',
    icon: './art/items/site-diary.webp',
    category: 'evidence',
    description:
      'A stout A4 hardback in a scuffed plastic wallet, ruled day by day, entries numbered and written in biro in a big fast hand, cement dust ground into the gutter and a rubber band round the used half.',
    examineText:
      'Item 41, 2 September: “gallery rail nth bay, baluster 3 loose, made safe pending order.” Item 63, 15 September: “gallery rail nth bay made good at Warden’s personal instruction, out of programme, no order no., not billed.” Dr Ivo Sandbach keeps it because his contract of engagement requires him to keep it, and grumbles about it daily. It is the only contemporaneous record made in this building every day by somebody who does not work for the Authority, and it is the one book on the headland that never passed the Warden’s pigeonhole.',
  },

  'ferry-booking-extract': {
    id: 'ferry-booking-extract',
    name: 'Certified Extract, Ferry Booking Book',
    icon: './art/items/ferry-booking-extract.webp',
    category: 'document',
    description:
      'A photocopied ledger page with a handwritten certification in the margin, a ferry company rubber stamp across the join and a signature and date beneath, stapled to a covering slip.',
    examineText:
      'Monday 14 September 1998: H. PIKE, out on the 08:15, return on the 17:40, fare paid, booked in the clerk’s hand two days beforehand. Certified as a true copy by the ferry office and stamped, because a photocopy is not a document and Wren will not carry one into a Board Room. It removes the Chief Clerk from this headland for the whole of the material period, and in doing so it asks the only remaining question there is: who was standing at his counter at ten past nine?',
  },

  'slip-r982211': {
    id: 'slip-r982211',
    name: 'Requisition Slip R98/2211 (pink carbon)',
    icon: './art/items/slip-r982211.webp',
    category: 'evidence',
    description:
      'A small pink carbon slip torn from a stub book, the printed boxes filled in in two different hands, the time in the corner, Standing Order 7 printed in six-point type across the reverse.',
    examineText:
      'Reader: C. SALLOW. Series 14/B, box 17. Time: 09:10, 14 September 1998. Issued by: S.F-K. Wren read this in her first hour on the headland, filed it as an example of the house procedure, and turned the page. With the ferry book beside it, it puts the Warden at the counter, and therefore at the strongroom, and therefore on the gallery stair, on the morning she says she spent in the Board Room with a quantity surveyor who, in Sandbach’s own diary, came on the fifteenth. There is no return entry against it anywhere.',
  },

  'board-working-file': {
    id: 'board-working-file',
    name: 'The Warden’s Board Working File',
    icon: './art/items/board-working-file.webp',
    category: 'evidence',
    description:
      'A stout manila folder with a treasury tag through the top corner, twenty-six foliated duplicator copies inside, an index sheet in front, and the endorsement written on the outside third, upside down to the tag.',
    examineText:
      'Twenty-six Reprax copies of the entire contents of series 14/B box 17, foliated in the corner, indexed, cross-referenced, endorsed the Ministry way. It is beautiful work. Four of the twenty-six are copies of documents that are no longer in box 17 and no longer anywhere on earth. She copied the evidence, destroyed the originals and filed the copies — because she is an archivist to the bone and destruction is the one act she has never in her life been able to make herself perform. Twenty-six, and three of the accident report, is twenty-nine.',
  },

  'keepers-log': {
    id: 'keepers-log',
    name: 'Nine Bells Keeper’s Log',
    icon: './art/items/keepers-log.webp',
    category: 'evidence',
    description:
      'A slim salt-stained log book in limp grey board, swollen along the spine, ruled columns of date, hour, wind, visibility and remarks in pencil, the last written line halfway down a page and everything after it blank.',
    examineText:
      '“24.8.74. 22.10. No. 2 vapor. cracked. Oil out. Light down. Nothing more to be done here.” Then eleven blank pages, ruled and dated by nobody. The log belongs to the beacon and never entered the Authority’s custody, which is the whole of its value: it is the one record in this case that no officer of the Brannock Pilotage Authority has ever been able to touch. On the reverse of the last written page, in pencil, in a different mood: tea, boot polish, a birthday card for Nan.',
  },

  'kestrel-mandate': {
    id: 'kestrel-mandate',
    name: 'The Kestrel Bequest',
    icon: './art/items/kestrel-mandate.webp',
    category: 'evidence',
    description:
      'A solicitor’s deed in a stiff blue wrapper tied with tape, a bank mandate on a printed form, and a fanfold standing-order schedule of thirty-one lines: initials, surname, sort code, amount, index clause.',
    examineText:
      'Established 4 April 1977 through Mowbray & Slee of Rossport out of Isobel Ferrier’s legacy. Thirty-one index-linked standing orders, paid monthly for twenty-one years, in amounts small enough that no auditor has ever found them interesting. The deed does not name the settlor. Run the initials against the Pelagia manifest and thirty of them are dependants of the drowned. The thirty-first is M. TAIN, and it has been going into Rita Tain’s post office book at Rossport since before she was thirty, and she believes it is a legacy from her father’s union.',
  },

  'commission-minute': {
    id: 'commission-minute',
    name: 'Conservancy Commission Minute',
    icon: './art/items/commission-minute.webp',
    category: 'document',
    description:
      'A single typed minute sheet with a printed Conservancy head, three numbered paragraphs, two initialled amendments in the margin and a nomination line with a date typed at the end of it.',
    examineText:
      'Requisitioned for an entirely different reason: Wren needed the appointment reference to word her certificate correctly. Paragraph 2: nomination of W. Adare, apprentice conservator, second year, dated 3 October 1998. Miss Halkett fell in the stairwell at Ilberry on the 12th. She had already put the name down nine days before the accident she has allowed everybody, including Wren, to believe was the reason. She did not send an apprentice by mistake. She sent a stranger, because a dead man asked for one.',
  },

  'aldis-lamp': {
    id: 'aldis-lamp',
    name: 'Aldis Signalling Lamp',
    icon: './art/items/aldis-lamp.webp',
    category: 'tool',
    description:
      'A heavy pistol-gripped signalling lamp with a wide plated reflector, a trigger for the shutter and a coiled rubber lead with bared copper at the end, dulled with salt and a tarpaulin’s worth of dust.',
    examineText:
      'Under a tarpaulin by the base of the signal mast, where it has been since the Authority stopped standing a signal watch in 1979. The bulb is good. The shutter still snaps like a rifle bolt. Four miles of black water between here and the Rossport signal station, the telephone pole at the Cardew turn down across the road, and a nineteen-year-old on a wet roof who does not know Morse and has a book that does.',
  },

  'signal-book': {
    id: 'signal-book',
    name: 'The Signal Book',
    icon: './art/items/signal-book.webp',
    category: 'document',
    description:
      'A pocket-sized book in stiff waxed covers with a lanyard hole, the pages printed with code tables, flag plates in colour and a Morse alphabet inside the front board, swollen and rippled by rain.',
    examineText:
      'Single letters, two-letter groups, the international code, and the procedure signals that tell the other end you are about to make a mistake. Wren has never sent a letter of Morse in her life. She is going to compose it in the book first, in pencil, in full, and then send it slowly, and then send it again, because the alternative is standing on a roof in a gale guessing, and she does not guess.',
  },

  'spoil-sheet': {
    id: 'spoil-sheet',
    name: 'Misfed Duplicator Sheet',
    icon: './art/items/spoil-sheet.webp',
    category: 'evidence',
    description:
      'A single sheet of duplicator bank creased hard across the middle where the drum caught it, one side a smeared half-impression running off the edge, the other side clean but for a faint offset image.',
    examineText:
      'Out of the spoil bin under the Reprax, which nobody empties because nobody has ever thought a misfeed was worth burning. The face of it is a ruined copy of a Ministry circular about fire doors. The back of it took an offset from whatever was on the drum immediately before — reversed, faint, and perfectly legible under a raking lamp, and it is not about fire doors at all.',
  },

  'charter-1811': {
    id: 'charter-1811',
    name: 'Charter of the Brannock Pilotage Authority, 1811',
    icon: './art/items/charter-1811.webp',
    category: 'document',
    description:
      'A large vellum membrane, gone honey-coloured and slightly cockled, engrossed in a heavy chancery hand with a great seal in a tin skippet hanging from a plaited cord at the foot.',
    examineText:
      'Article 9: “The said office of Warden shall be holden by a man of full age, being a subject of His Majesty, resident within the liberty of Brannock.” Never amended in a hundred and eighty-seven years, because nobody ever needed it amended, because nobody it excluded was ever in a position to ask. It is the reason a competent woman running a bankrupt institution had to sign on behalf of an unconscious one — and it is the reason an Inquiry could find nobody to call. The contempt and the alibi, in the same clause, on the same skin.',
  },

  'sector-plates': {
    id: 'sector-plates',
    name: 'Brass Occulting Sector Plates',
    icon: './art/items/sector-plates.webp',
    category: 'tool',
    description:
      'Three curved brass plates in a fitted wooden box lined with green baize, each pierced with a slotted arc and a locking screw, the outer faces engraved with degree graduations and rubbed bright at the tangs.',
    examineText:
      'They bolt to the rotation drum and they are the whole character of a light: the glass makes the beam and these three pieces of brass decide who it belongs to. Eighteen degrees is one second, because the governor turns the drum once in twenty. Set them at eighteen-degree spacings and a ship nine miles out sees Fl(3) W 20s. Set them at twenty-seven and she sees Fl(3) W 15s, which is Cadran Point, and thirty-one people already went that way once.',
  },

  'fresnel-panel': {
    id: 'fresnel-panel',
    name: 'The Returned Fresnel Panel',
    icon: './art/items/fresnel-panel.webp',
    category: 'tool',
    description:
      'A tall curved panel of stepped prismatic glass in a bronze frame, wrapped in a red fleece and half unwound, the concentric rings catching light along their edges, one bronze land freshly scratched by a crate nail.',
    examineText:
      'It went to Antwerp in a crate with a hundred and forty kilos of the Authority’s brass, and it came back at four o’clock in the morning on 3 November, bought off a shipping agent by a man with nothing left to buy it with, driven ninety minutes, and handed over wrapped in a fleece off his own back seat. He said nothing about his daughters, or his firm, or the fourteen thousand pounds. It weighs thirty-one kilos and it takes two people up the last ladder.',
  },

  // ==========================================================================
  // ACT V
  // ==========================================================================

  'case-file': {
    id: 'case-file',
    name: 'The Case File',
    icon: './art/items/case-file.webp',
    category: 'document',
    description:
      'A Conservancy file board tied with green tape, eight tabbed dividers standing proud of the top edge, every sheet foliated in the corner and a citation column ruled down the right of each page in pencil.',
    examineText:
      'Eight links: presence, means and opportunity, consciousness of guilt, identity, prior knowledge, signature, the hand has a name, motive and predicate. Every assertion on the left, every accession number on the right, and nothing in the right-hand column that is not a document she has physically held. Cormac Sallow’s letter of 11 September is bound at the front, because the file is the answer to it. Anything she cannot cite will be struck, aloud, in front of her, at two o’clock this afternoon.',
  },

  'notice-74-119-retyped': {
    id: 'notice-74-119-retyped',
    name: 'Notice to Mariners 74/119, retyped',
    icon: './art/items/notice-74-119-retyped.webp',
    category: 'document',
    description:
      'A crisp new foolscap typed on the Imperial 66, the lower-case a a solid black lozenge throughout, a manuscript note of the delay at the foot, and a second sheet behind it listing thirty-one names.',
    examineText:
      'Retyped from a scorched carbon on the same machine that drafted it, in the same room, twenty-four years two months and eighteen days late, with a note of the delay entered at the foot in the correct form and the Register of Notices Issued left open at the place. Appended to it, against Conservancy house style and at the insistence of a nineteen-year-old who cannot be argued out of it, are thirty-one names.',
    combinesWith: [{ item: 'fourpenny-die', produces: 'notice-74-119-issued' }],
  },

  'notice-74-119-issued': {
    id: 'notice-74-119-issued',
    name: 'Notice to Mariners 74/119, issued',
    icon: './art/items/notice-74-119-issued.webp',
    category: 'evidence',
    description:
      'A sealed envelope on top of a stacked batch, addressed from a brass plate, carrying one bright vermilion franking impression reading 4d and a date twenty-four years after the one typed inside it.',
    examineText:
      'Two hundred and fourteen envelopes, addressed from the plates in the order Schedule D has kept since 1834, and the top one is No. 1, The Keeper, Nine Bells Beacon, per relief boatman, Cardew Post Office. Struck with the old die under the meter’s descending register, because fourpence was the sum, and fourpence is what it will cost. It is the only vermilion in the building today and it is on the right document at last.',
  },

  's41-certificate': {
    id: 's41-certificate',
    name: 'Section 41 Certificate',
    icon: './art/items/s41-certificate.webp',
    category: 'document',
    description:
      'A single heavy sheet with a printed Conservancy head and an embossed blind stamp, a schedule of series references in a ruled table, and a wide empty box at the foot for a signature and a date.',
    examineText:
      'Every series in the Brannock Pilotage Authority, listed by reference, appraised, described and certified as of permanent value. Signing it saves six hundred feet of shelving from a pulper booked for the fourth of November, in every version of this afternoon, whatever else stands or falls. Whether anybody is named, whether a dead pilot is cleared, whether a Board finds anything at all — the paper survives, and Wren Adare would tell you that is not the consolation prize.',
  },

  'referral-form': {
    id: 'referral-form',
    name: 'Homicide Referral Form',
    icon: './art/items/referral-form.webp',
    category: 'document',
    description:
      'A police pro-forma on grey stock with a carbon behind it, blocked into sections for the deceased, the circumstances and the proposed offence, most of it still blank and a biro lying across the fold.',
    examineText:
      'The wording is hers, from a menu of clauses that the paper does or does not support. The physical evidence supports a grab, and a fall from a rail known to be defective, and eleven minutes before a 999 call, and a repair ordered off the programme the next morning, and twenty-nine impressions on a duplicator, and a ribbon. It does not support a push. DS Iveson, who is not being unkind, has already told her which of the two versions puts people in prison.',
  },
};
