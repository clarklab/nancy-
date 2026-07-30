/**
 * The cutscenes.
 *
 * Seven of them: the arrival, four act turns, and two endings. They are the
 * only places in the game where the camera is not Wren's eyes, and the only
 * places where the prose is allowed to address the player directly — so the
 * rules are tight.
 *
 * IMAGES ARE SCENE ART, REUSED. Every `image` below is a painted background
 * that already exists in `public/art/scenes`, moved across slowly. A cutscene
 * that introduces artwork the player will never stand in is a trailer, not a
 * cutscene; a cutscene built from rooms she is about to work in is a promise.
 * The Ken Burns move does the editing: `in` for a fact closing on you, `out`
 * for the ground opening under one, `left`/`right` for travel.
 *
 * ONE OR TWO SENTENCES A BEAT. The player is reading a still, not a page. Text
 * is Wren's register — flat, exact, arithmetical — except where `speaker` is
 * set, which marks a document being read aloud or a person saying a thing that
 * will be quoted at a Board later.
 *
 * ALIASES. Each cutscene is registered twice: once under its canonical
 * `cin-…` id (which `acts.ts` and `puzzles.ts` reference) and once under the
 * bare name the design documents use. Two keys pointing at one object costs a
 * few bytes and removes an entire class of "the cutscene silently did not
 * play" bug when another pass wires a trigger from the design doc rather than
 * from this file.
 */

import type { Cinematic, CinematicBeat, CinematicId } from '@/engine/types';

const art = (scene: string) => `./art/scenes/${scene}.webp`;

/** Eleven seconds of rain and no score. Used once, deliberately. */
const SILENCE_MS = 11_000;

// ---------------------------------------------------------------------------
// The arrival
// ---------------------------------------------------------------------------

const openingBeats: CinematicBeat[] = [
  {
    image: art('rossport-quay'),
    move: 'right',
    text: [
      'Rossport quay, ten past eight in the morning, Monday the twenty-sixth of October 1998.',
      'The ferry runs Mondays and Thursdays. There is no third option, and the coast road has been out since the storms of ’93.',
    ],
    sound: 'footstep-stone',
  },
  {
    image: art('the-ardent'),
    move: 'in',
    speaker: 'Cormac Sallow, 11 September 1998',
    text: [
      '‘I ask only that series 14/B be read by a stranger before it leaves this building.’',
      '‘I am seventy-nine. I have been on the wrong side of it a long while, and I would rather not be, at the end.’',
    ],
    sound: 'page-turn',
  },
  {
    image: art('the-ardent'),
    move: 'left',
    text: [
      'Twenty minutes out and the swell is on the beam. Diesel, wet wool, salt, and the particular indignity of being frightened of water in front of a woman who works on it.',
      'Spray got into the satchel off the harbour mouth. Leaves two and three of my own commission have gone over hard, like a biscuit.',
    ],
  },
  {
    image: art('cliff-path-churchyard'),
    move: 'in',
    text: [
      'Brannock Head comes out of the rain the way a fact does: all at once, and larger than the account of it.',
      'Along the churchyard wall, thirty-one slate markers, all cut in the same month of 1975, and every one of them dated the third of November 1974.',
    ],
  },
  {
    image: art('entrance-hall'),
    move: 'in',
    text: [
      'Six hundred feet of shelving. A hundred and eighty-seven years of a coast. Nine days.',
      'Certify every series by the third of November, or the whole of it is deemed valueless and lawfully pulped on the fourth. That is not a threat. It is a filing deadline, and it is worse.',
    ],
    sound: 'door-heavy',
  },
  {
    image: art('great-stair'),
    move: 'out',
    text: [
      'Twenty-two Wardens up the great stair, three-quarter face against a dark ground, each one dated to the year.',
      'A dead man asked for a stranger. Everybody in this building has known since the third of October that one was coming, and exactly which morning she would arrive.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Act turns
// ---------------------------------------------------------------------------

/** I → II. The ash grate, the tray, and a sentence that was never sent. */
const actTwoBeats: CinematicBeat[] = [
  {
    image: art('courtyard-and-site-hut'),
    move: 'in',
    text: [
      'Twenty past one in the morning, a coat over a nightdress, and a fire that went out badly because the rain got at it through a flue with no damper.',
      'The courtyard is empty. Whoever raked this was standing here four minutes ago.',
    ],
    sound: 'footstep-stone',
  },
  {
    image: art('binding-room'),
    move: 'in',
    text: [
      'Cold water in a tray. Eleven fragments floated off a sodden black brick, one at a time, and laid down on their own char pattern.',
      'Then blotters, glass, weight, and nothing at all for four hours, because the paper decides when.',
    ],
    sound: 'paper-rustle',
  },
  {
    image: art('binding-room'),
    move: 'none',
    speaker: 'Notice to Mariners 74/119 — 15 August 1974',
    text: 'MARINERS ARE ADVISED THAT THE LIGHT EXHIBITED FROM THE NINE BELLS BEACON MAY NOT BE RELIED UPON UNTIL FURTHER NOTICE.',
  },
  {
    image: art('courtyard-and-site-hut'),
    move: 'out',
    text: [
      'Somebody wrote that warning. Somebody gave it a number, and ran off two hundred and fourteen copies of it.',
      'Twenty-four years later, in the rain, at twenty past one this morning, somebody in this building was still trying to burn it.',
    ],
  },
];

/** II → III. Eleven inches of steel, four inches of water, two women. */
const actThreeBeats: CinematicBeat[] = [
  {
    image: art('strongroom'),
    move: 'in',
    text: [
      'Eighteen twenty. The door goes to on its own weight and the movements start running backwards.',
      'Three of them, wound by hand this morning, and not one of them can be argued with until seven.',
    ],
    sound: 'door-heavy',
  },
  {
    image: art('undercroft'),
    move: 'in',
    text: [
      'Twenty-three forty. The sump backs up in the rain and the water comes under the door at ankle depth, in the dark.',
      'The bottom shelf is 1974.',
    ],
  },
  {
    image: art('strongroom'),
    move: 'left',
    text: [
      'Twenty-four boxes, a failing torch, and one question worth the time: which of these exists anywhere else.',
      'Standing Order 12, painted on the wall in 1946. IN FLOOD, SAVE BY SERIES, NOT BY SIZE.',
    ],
  },
  {
    image: art('great-stair'),
    move: 'out',
    text: 'Forty feet of galvanised ventilation trunk runs from this room up to the Wardens’ Hall landing, and at one in the morning it carries two women tearing each other apart.',
  },
  {
    image: art('great-stair'),
    move: 'none',
    speaker: 'Through the ventilation trunk',
    text: [
      '‘…forty-seven of them, and I did it with my own hands…’',
      '‘…he was in the chair, he could not hold a pen, you know that better than anybody…’',
      '‘…you were never even there, that is the whole of it, you were never there…’',
    ],
  },
  {
    image: art('strongroom'),
    move: 'in',
    text: [
      'Write down what you are sure of. Mark the rest not certain, in the dark, in four inches of water, with a pencil.',
      'That is the entire job, and in nine days’ time a man paid to ask how you know is going to make you glad you did it.',
    ],
  },
];

/**
 * III → IV. The reconciliation. No music: the design is explicit that when the
 * third column refuses to agree the score simply stops, and the only sound for
 * eleven seconds is rain on a kitchen window at Cardew.
 */
const actFourBeats: CinematicBeat[] = [
  {
    image: art('pikes-cottage'),
    move: 'in',
    text: 'Three books that have never once been on the same table, because they were kept in three rooms by three people who each did their job correctly.',
  },
  {
    image: art('pikes-cottage'),
    move: 'none',
    text: [
      'Dues collected every week. Wages paid every week.',
      'Oil drawn on Saturday the twenty-fourth of August 1974, and never again.',
    ],
  },
  {
    image: art('pikes-cottage'),
    move: 'in',
    text: [
      'Seventy-one days. Ten complete dues weeks. One thousand one hundred and eighty-two vessels.',
      'Four thousand one hundred and eighty pounds four shillings, collected for a light that was not burning.',
    ],
  },
  {
    // No text. The score has stopped. Rain on a kitchen window, and a girl at
    // a table with a form she has filled in correctly.
    image: art('pikes-cottage'),
    move: 'out',
    durationMs: SILENCE_MS,
  },
  {
    image: art('cardew-village'),
    move: 'in',
    text: [
      'R.741. R.748. R.755. REQUISITION NOT SANCTIONED — REFER WINTER REFIT.',
      'Over initials I cannot read, and two millimetres of pencil that say p.p.',
    ],
  },
];

/** IV → V. The sea closes the landing and the Warden puts the stove on. */
const actFiveBeats: CinematicBeat[] = [
  {
    image: art('beacon-landing'),
    move: 'out',
    text: [
      'The sea gets up past the point where the Ardent can lie off the landing.',
      'Rita runs for Cardew with the keeper’s log in a dry bag and does not look back, because looking back would cost her the boat and the log with it.',
    ],
  },
  {
    image: art('beacon-oil-store'),
    move: 'in',
    text: [
      'Cold paraffin that has not moved in twenty-four years. It smells like a cupboard in somebody’s grandmother’s house.',
      'On the back of the last page of the log, in pencil: tea, boot polish, a birthday card for Nan.',
    ],
  },
  {
    image: art('beacon-service-room'),
    move: 'in',
    text: 'A fifty-eight-year-old Warden, a nineteen-year-old apprentice, a paraffin stove and eleven hours, on a rock nine miles offshore in a force ten.',
    sound: 'match-strike',
  },
  {
    image: art('beacon-service-room'),
    move: 'none',
    speaker: 'Sabine Ferrier-Kyne',
    text: [
      '‘Ask me. You have all of it now, or near enough.’',
      '‘Ask me and I will tell you the truth, and then in the morning you will have to decide what to do with it. I promise you that is the harder half.’',
    ],
  },
  {
    image: art('beacon-service-room'),
    move: 'out',
    text: [
      'Numbered points, then, because that is what I do when I am frightened.',
      'One: nothing she says tonight can be used. Two: write it all down anyway.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

const endingSolvedBeats: CinematicBeat[] = [
  {
    image: art('board-room'),
    move: 'in',
    text: [
      'Fourteen hundred hours, the third of November: hard, blue, cold, and the only wholly sunlit room in this building in nine days.',
      'Eight links, read out in order, and every assertion tied to a document on the table in front of her.',
    ],
  },
  {
    image: art('board-room'),
    move: 'none',
    speaker: 'Mr Pargeter, for the Ministry',
    text: [
      '‘On what evidence does this Board propose to name a person whom no record of this Authority has ever named?’',
      '— Item 14 of your own schedule of liabilities, sir. A superannuation claim, reckonable service from 1959, signed in her own name. The one document in a hundred and eighty-seven years in which she asked to be counted.',
    ],
  },
  {
    image: art('board-room'),
    move: 'out',
    text: [
      'Sabine Ferrier-Kyne takes her own minutes to the last line, caps the pencil, and puts it behind her ear.',
      'She is arrested on the Board Room steps, in the sun, and she does not ask anybody to wait.',
    ],
    sound: 'lock-click',
  },
  {
    image: art('post-room'),
    move: 'in',
    text: [
      'Notice to Mariners 74/119, retyped from a scorched carbon and franked with one fourpenny impression struck from the old die.',
      'Two hundred and fourteen addressees. Number one, as statutory precedence requires, is the Keeper, Nine Bells Beacon.',
    ],
    sound: 'clue-found',
  },
  {
    image: art('cliff-path-churchyard'),
    move: 'in',
    text: [
      'Twenty-three oh four. Three flashes, twenty seconds, for the first time since Saturday the twenty-fourth of August 1974.',
      'From the Board Room window, from the quay at Rossport, from Cardew, from here. Nobody on this coast needs it explained to them.',
    ],
  },
  {
    image: art('slipway-and-ritas-shed'),
    move: 'out',
    text: [
      'On the slipway, Rita Tain sits down on the wet concrete, and after a while she asks whether there is anything else.',
      'It is not in any file, no Board needs it, and nothing in the world will score it either way.',
    ],
  },
];

const endingWrongBeats: CinematicBeat[] = [
  {
    image: art('board-room'),
    move: 'in',
    text: [
      'Fourteen hundred hours, and the light through the south sashes is the only thing in this room with nothing to prove.',
      'The links are read out. Some of them have nothing in the right-hand column.',
    ],
  },
  {
    image: art('board-room'),
    move: 'none',
    speaker: 'Mr Pargeter, for the Ministry',
    text: [
      '‘On what document, Miss Adare?’',
      '‘Then it is struck. The transcript will print with the gap in it, and the gap is not my doing.’',
    ],
  },
  {
    image: art('board-room'),
    move: 'out',
    text: [
      'The finding is misadventure. The Rossport report of 1975 stands, with its statutory presumption of correctness intact.',
      'Emrys Tain is not cleared. The officer who signed for ninety-nine days in 1974 is not named, because no record of this Authority has ever named her, which was always the point.',
    ],
  },
  {
    image: art('long-registry'),
    move: 'in',
    text: [
      'The archive is certified all the same, every series, in nine days, by a nineteen-year-old with a spatula.',
      'It goes onto a lorry that is not a pulper. The record outlives everybody, and that is not nothing — it is only not enough.',
    ],
    sound: 'page-turn',
  },
  {
    image: art('cliff-path-churchyard'),
    move: 'in',
    text: [
      'Twenty-three oh four. Three flashes, twenty seconds. It happens anyway.',
      'It was never evidence, and it was never going to be. It is just true.',
    ],
  },
  {
    image: art('cliff-path-churchyard'),
    move: 'out',
    text: [
      'Thirty-one slates along the wall, all cut in the same month of 1975.',
      'The paper that would have answered for them was in the building the whole time. She held most of it in her hands. She could not cite it.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const cine = (id: CinematicId, beats: CinematicBeat[], music?: string): Cinematic => {
  const c: Cinematic = { id, beats, skippable: true };
  if (music) c.music = music;
  return c;
};

export const cinematics: Record<CinematicId, Cinematic> = {
  'cin-opening': cine('cin-opening', openingBeats, 'main-theme'),
  'cin-act-2': cine('cin-act-2', actTwoBeats, 'tension'),
  'cin-act-3': cine('cin-act-3', actThreeBeats, 'tension'),
  // Deliberately unscored. See `actFourBeats`.
  'cin-act-4': cine('cin-act-4', actFourBeats),
  'cin-act-5': cine('cin-act-5', actFiveBeats, 'confrontation'),
  'cin-ending-solved': cine('cin-ending-solved', endingSolvedBeats, 'discovery'),
  'cin-ending-wrong': cine('cin-ending-wrong', endingWrongBeats, 'sorrow'),

  // Aliases under the bare names used in the design documents, so a trigger
  // authored from the design rather than from this file still finds a scene.
  opening: cine('opening', openingBeats, 'main-theme'),
  'act-2': cine('act-2', actTwoBeats, 'tension'),
  'act-3': cine('act-3', actThreeBeats, 'tension'),
  'act-4': cine('act-4', actFourBeats),
  'act-5': cine('act-5', actFiveBeats, 'confrontation'),
  'ending-solved': cine('ending-solved', endingSolvedBeats, 'discovery'),
  'ending-wrong': cine('ending-wrong', endingWrongBeats, 'sorrow'),
};
