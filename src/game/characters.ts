/**
 * The cast.
 *
 * Ten people, one of them dead before page one, all of them painted the same
 * way: three-quarter oil against a dark ground, in the manner of the Wardens'
 * portraits on the Great Stair, so the whole cast reads as already historical,
 * already framed, already finished with.
 *
 * `bio` is not narration. It is what Wren Adare has written about them on the
 * facing page of her casebook by the end of Act I — first impressions, in her
 * own flat voice, mostly wrong in the way first impressions are. Nothing here
 * knows how the case ends.
 *
 * `color` is the character's nameplate accent, taken from the one thing they
 * wear or carry that the art bible fixes: a slate cardigan, a brown warehouse
 * coat, verdigris brass, lilac wool, bottle green, an olive gilet, a charcoal
 * suit, navy serge, a mustard scarf, and a portrait varnish gone the colour of
 * old cream. Issued Vermilion is reserved for the stamp pad and is never used
 * here.
 */

import type { Character, CharacterId } from '@/engine/types';

export const characters: Record<CharacterId, Character> = {
  'sabine-ferrier-kyne': {
    id: 'sabine-ferrier-kyne',
    name: 'Sabine Ferrier-Kyne',
    role: 'Warden of the Brannock Pilotage Authority',
    portrait: './art/portraits/sabine-ferrier-kyne.webp',
    color: '#93A9B8',
    bio:
      'Fifty-eight, upright as a plumb line, a 2H pencil behind her right ear and a slate cardigan over her shoulders like a stole. She gave me a key to every room in the building before I had finished signing the visitors’ book, answered six questions completely when four would have done, and handed me nine documents from 1974 unasked so that I could learn the house style. She is the most competent person I have met in my life and I cannot decide whether that observation belongs in the casebook or not, so I am putting it here.',
  },

  'halvard-pike': {
    id: 'halvard-pike',
    name: 'Halvard Pike',
    role: 'Chief Clerk',
    portrait: './art/portraits/halvard-pike.webp',
    color: '#7E5A3C',
    bio:
      'Chief Clerk, forty-four years in this building, copy boy in 1954. Would not shake my hand, and then gave me four minutes on the state of the registry that were, every word of them, correct. He is right that the Conservancy will microfilm the interesting tenth and pulp the rest, and he is right that I am the instrument of it, and I have not yet worked out what to say to a man whose whole life is being appraised out of existence by a girl with a warrant. He squared a treasury tag for me tail-under, loop-left, and called it my people’s knot, which I think was meant as an insult.',
  },

  'rita-tain': {
    id: 'rita-tain',
    name: 'Marguerite “Rita” Tain',
    role: 'Lamp-room curator and boatwoman',
    portrait: './art/portraits/rita-tain.webp',
    color: '#4F7E7A',
    bio:
      'Runs the lamp room and the pilot cutter Ardent, and is employed by the Authority she has been publicly accusing since 1976, because nobody else on this coast can handle the boat. Daughter of Emrys Tain, the pilot the 1975 finding destroyed; she can recite that finding to me by paragraph number and did, on the crossing, without being asked. Refused legal aid four times, is being sued for defamation, and has spent every penny she has ever had on a name. She has decided I am the Conservancy and therefore the enemy, and she is not entirely wrong.',
  },

  'ottoline-verge': {
    id: 'ottoline-verge',
    name: 'Ottoline Verge',
    role: 'Registrar of the Rolls, retired',
    portrait: './art/portraits/ottoline-verge.webp',
    color: '#B9A2BC',
    bio:
      'Seventy-two, retired in 1991, and comes in six days a week unpaid because nobody else alive understands the card index. Keeps a kettle, a tin of biscuits and a pair of sheepskin slippers in drawer 388 of a national record, and taught me the requisition system in eleven minutes flat with more patience than I have been shown by anyone since I was sixteen. Accession numbers back to 1949 come out of her without a pause. Ask her about the autumn of 1974 and she says “oh, now”, and then tells you about somebody’s wedding.',
  },

  'enid-charnock': {
    id: 'enid-charnock',
    name: 'Enid Charnock',
    role: 'Cashier and Accountant',
    portrait: './art/portraits/enid-charnock.webp',
    color: '#3F6B52',
    bio:
      'Cashier since 1962: light dues, wage sheets, petty cash, stationery, postage. Eleven keys on a chain at her waist and a rule that no new typewriter ribbon is issued until the used spool comes back, which she has enforced without mercy since 1968 and which means there is a shelf of two hundred and forty of them upstairs. Precise to the penny about figures and useless about people; answers a question about a person with an answer about a ledger. Her eyes go to the door of the Warden’s Office about every ninety seconds and she calls it respect.',
  },

  'ivo-sandbach': {
    id: 'ivo-sandbach',
    name: 'Dr Ivo Sandbach',
    role: 'Conservation architect, Sandbach & Roule',
    portrait: './art/portraits/ivo-sandbach.webp',
    color: '#7C8A5E',
    bio:
      'Converting Pilotage House into a heritage hotel with a hard completion date of 1 December, and doing arithmetic in his head while he talks to you. Calls me Wendy. Genuinely knowledgeable about lime mortar and genuinely uninterested in anything not on the programme, which is a kind of honesty. He keeps a site diary in his own hand, every day, item by item, because his contract requires it — and it is the only daily record in this building that does not pass through the Warden’s pigeonhole.',
  },

  'bram-aylward': {
    id: 'bram-aylward',
    name: 'Bram Aylward',
    role: 'Ministry “dissolution liaison”',
    portrait: './art/portraits/bram-aylward.webp',
    color: '#5A6472',
    bio:
      'Introduced himself as Ministry dissolution liaison, bought the drinks, remembered my supervisor’s name, and told me he only got here on Tuesday. The visitors’ book says 6 October. His identification card is laser-printed on 90gsm in a building where every other card was letterpressed in 1988, and the Ministry staff circular in the Long Registry lists all four liaison officers by name and he is not one of them. He has not yet said a single thing about this case that I can show to be false, which is a different sentence entirely.',
  },

  'marren-iveson': {
    id: 'marren-iveson',
    name: 'DS Marren Iveson',
    role: 'Detective Sergeant, Rossport',
    portrait: './art/portraits/marren-iveson.webp',
    color: '#46586E',
    bio:
      'Two officers, one car, four hundred square miles, and a coroner’s officer who does three days a week. She writes while you are still talking and treats me as nineteen, which I am. She told me she had never laid eyes on the Sallow file. Her own request slip is stapled inside the back cover of it, dated 2 October. I have not raised it. “That’s an inference, that is. Bring me an object.”',
  },

  'phyllida-halkett': {
    id: 'phyllida-halkett',
    name: 'Phyllida Halkett',
    role: 'Senior Appraiser, National Records Conservancy',
    portrait: './art/portraits/phyllida-halkett.webp',
    color: '#C9A227',
    bio:
      'My supervisor, in traction in Ilberry with a broken hip, reachable from the call box on Rossport quay at low water with a pocketful of tens. Will explain section 41, certification, adverse reports and exactly what happens on 4 November at any length and at any hour, and will not say one word about who did anything: “that’s not a question for me.” Twenty-nine years of appraisal and a professional horror of opinion. Ends every call with “have you eaten?” and rings off before the answer.',
  },

  'cormac-sallow': {
    id: 'cormac-sallow',
    name: 'Cormac Sallow',
    role: 'Lamp Superintendent 1958–1984 (deceased)',
    portrait: './art/portraits/cormac-sallow.webp',
    color: '#9C9384',
    bio:
      'Seventy-nine, Lamp Superintendent for twenty-six years, dead of a fall from the Muniment gallery at about 10:24 on Monday 14 September 1998. I have never met him and I have read four hundred pages of him: lamp reports with no adjectives in them, an inquiry transcript, and one letter of nine lines that gives no reason for anything and ends “I would be obliged if series 14/B were read by a stranger before it leaves this building.” He is painted in the lamp room, 1979, patient, faintly amused, waiting for somebody to catch up. That is my job, then.',
  },
};
