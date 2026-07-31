import type { DialogueTree } from '@/engine/types';

/**
 * Phyllida Halkett — Senior Appraiser, National Records Conservancy, reachable
 * only from the GPO call box on Rossport quay with a pocketful of tens.
 *
 * THE DIEGETIC HINT LINE. Dry, exact, patient, with audible pauses for the
 * pips. She explains procedure at any length at any hour and will not have an
 * opinion about anything else — "That's not a question for me" is said
 * identically every single time. Her entire method of helping is to reframe an
 * unanswerable question into an answerable one. Every call ends "Have you
 * eaten?" and she rings off before the answer. She never names a suspect until
 * the Board Room steps.
 *
 * Her procedural answers are deliberately repeatable (`once: false`): a hint
 * line the player cannot ask twice is not a hint line.
 */
export const halkettTrees: DialogueTree[] = [
  // -------------------------------------------------------------- Act I ----
  {
    characterId: 'phyllida-halkett',
    act: 1,
    greeting: [
      'Halkett. — Yes, I can hear the sea, so you’ll be in the box on the quay.',
      'Ten-pence pieces, plural. Now. What is the procedural question?',
    ],
    exhausted: 'Then you have no procedural question, which means you have not yet opened enough boxes. Go and open some. Have you eaten?',
    farewell: 'Good. Ring me at low water; the line is better and so is your temper. Have you eaten?',
    nodes: [
      {
        id: 'hal-a1-01',
        playerLine: 'What does my commission actually let me do?',
        reply: [
          'Section 41. Access to every series in situ, power to open any receptacle in the custody of the dissolving body, and no power whatsoever to remove anything.',
          'You are a reader with a crowbar. Behave accordingly.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-fused-commission' },
        once: false,
      },
      {
        id: 'hal-a1-02',
        playerLine: 'What happens if I don’t certify by the third?',
        reply:
          'The series are deemed valueless on the fourth and lawfully destroyed. Not seized. Not mislaid. Destroyed, correctly, by clerical default. That is not a threat, it is a commencement order.',
        once: false,
      },
      {
        id: 'hal-a1-03',
        playerLine: 'Somebody in this building is lying to me.',
        reply: [
          'That’s not a question for me.',
          'The question you meant to ask is how to record a discrepancy so it survives challenge. Rule a citation column. Never put a conclusion in the same column as a fact.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'halkett-taught-citation-column', value: true }],
      },
      {
        id: 'hal-a1-04',
        playerLine: 'How do I certify a series?',
        reply: [
          'Sample at five per cent or fifty items, whichever is greater. Note arrangement, extent, gaps and condition. Sign the certificate.',
          'Never certify a series you have not physically opened. — Have you eaten?',
        ],
        once: false,
      },
      {
        id: 'hal-a1-05',
        playerLine: 'I’m nineteen and they all know it.',
        reply:
          'That’s not a question for me. — The question is what you do about a witness who will not answer a nineteen-year-old. You put a reference number in front of them and you wait. Numbers are not nineteen.',
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'phyllida-halkett',
    act: 2,
    greeting: [
      'Halkett. Pips in about four minutes, so talk faster than that.',
      'And don’t tell me the weather, I have a window and a barometer.',
    ],
    exhausted: 'Then we are wasting the Post Office’s time and yours. Ring back with a series reference in your hand. Have you eaten?',
    farewell: 'That’s your tens gone. Write it down before you walk back up the hill; you will forget the middle clause.',
    nodes: [
      {
        id: 'hal-a2-01',
        playerLine: 'There’s a document that isn’t in any register in the building.',
        reply: [
          'Then you have a negative, and a negative is the hardest thing in our profession to prove. Establish the completeness of the register first.',
          'A gap in a complete series is evidence. A gap in a shambles is nothing.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-issued-register' },
        once: false,
      },
      {
        id: 'hal-a2-02',
        playerLine: 'Can I open a strongroom without the Warden?',
        reply: [
          'You may open any receptacle. You may not force a mechanism you don’t understand.',
          'A three-movement timelock is not forced, it is set — and set wrongly it gives you a fortnight’s wait and a cold face.',
        ],
        once: false,
      },
      {
        id: 'hal-a2-03',
        playerLine: 'Should I trust the Warden?',
        reply: [
          'That’s not a question for me.',
          'Ask instead: is her custody documented? Whose signature is on the last transfer? Who holds the only key, and since when? Those are questions with answers in them.',
        ],
        once: true,
      },
      {
        id: 'hal-a2-04',
        playerLine: 'I was locked in the strongroom all night in four inches of water.',
        reply: [
          'Were the boxes above the waterline when you left them?',
          'Then that is the whole of the professional question, and you may cry about the remainder in your own time. Have you eaten?',
        ],
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'phyllida-halkett',
    act: 3,
    greeting: 'Halkett. I have had a telephone call from the Ministry, and I should like to hear the words from you, in order, with dates.',
    exhausted: 'Then file it. Everything else you have asked me tonight is the same question wearing a different coat.',
    farewell: 'Four o’clock. Sign it yourself. Have you eaten?',
    nodes: [
      {
        id: 'hal-a3-01',
        playerLine: 'The Deakin letter fails two of five tests.',
        reply: [
          'Then it fails. Word the report thus: state the tests, state the results, state the conclusion, state no opinion about the maker.',
          'The moment you speculate who typed it, you are a witness and not an appraiser.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-deakin-letter' },
        once: false,
      },
      {
        id: 'hal-a3-02',
        playerLine: 'Filing it truthfully destroys the only evidence I have.',
        reply: [
          'Yes.',
          'That’s not a question for me either, and I am not going to pretend it is a difficult one. File it by four o’clock, and sign it yourself, and do not soften a single clause.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'halkett-ordered-the-filing', value: true }],
      },
      {
        id: 'hal-a3-03',
        playerLine: 'My commission has been revoked.',
        reply: [
          'At sixteen twenty, by fax. I have the copy.',
          'You are now a member of the public with a suitcase. You may look at what you are invited to look at. You may not requisition, remove, or claim a warrant.',
        ],
        once: true,
      },
      {
        id: 'hal-a3-04',
        playerLine: 'Then what is the point of me?',
        reply: [
          'The Board of Dissolution may receive evidence from any person. Any person, Miss Adare.',
          'Section 44, four lines long, unused since 1963. — Have you eaten?',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'halkett-section-44', value: true }],
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'phyllida-halkett',
    act: 4,
    greeting: 'Halkett. You have ninety seconds before this line goes — they’re telling me the pole’s down at the Cardew turn. Talk.',
    exhausted: 'Ninety seconds and you have spent them on nothing. That is a young person’s luxury. Ring off.',
    farewell: 'Roof. Tarpaulin. Signal Book. Go — Have you eat—',
    nodes: [
      {
        id: 'hal-a4-01',
        playerLine: 'How do I prove who made an initial?',
        reply: [
          'You don’t. You exhaust everybody who could have made it. Prove incapacity in the named signatory from three independent custodies, then prove authority in the survivor.',
          'That isn’t proof of hand. It is proof of exclusion, and it stands.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-pp-sort' },
        once: false,
      },
      {
        id: 'hal-a4-02',
        playerLine: 'The commission minute is dated the third of October. You broke your hip on the twelfth.',
        reply: 'I sent you because I broke my hip and for no other reason on earth.',
        availableIf: { kind: 'hasClue', clue: 'clue-commission-minute' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'hal-a4-02-nine-days',
            playerLine: 'Nine days, Mrs Halkett. You nominated me nine days before you fell.',
            reply: [
              '— That is the third time I have said that sentence, and it has been untrue every time.',
              'We will discuss it on the steps.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'halkett-hip-lie-caught', value: true },
              { kind: 'addCounter', counter: 'trust-halkett', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'hal-a4-03',
        playerLine: 'The telephone is about to go.',
        reply: [
          'Then use the Aldis. Roof of Pilotage House, under the tarpaulin. Signal Book is in the Chart Loft.',
          'You do not need to know Morse. You need to be able to look things up. That is your entire profession.',
        ],
        once: false,
        effects: [{ kind: 'setFlag', flag: 'halkett-told-about-aldis', value: true }],
      },
      {
        id: 'hal-a4-04',
        playerLine: 'I’m frightened of the boat.',
        reply: [
          'Yes. That’s not a question for me.',
          'Two jerseys, something dry inside you before you go out, and don’t hold the rail with both hands. You’ll want one of them for the log.',
        ],
        once: true,
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'phyllida-halkett',
    act: 5,
    greeting:
      'Sit up. Pargeter reads the room before he reads the file, so give him a straight back and a foliated bundle and he’ll waste his first two minutes on nothing at all.',
    exhausted: 'Nothing further. Go in. I have said everything I am prepared to say before eleven o’clock.',
    farewell: 'Go on. I shall be at the back, looking at the ceiling. — Have you eaten? No. Nobody ever has.',
    nodes: [
      {
        id: 'hal-a5-01',
        playerLine: 'You came.',
        reply: [
          'Two sticks, one ferry and a gale. Don’t make anything of it.',
          'I shall say nothing during the hearing. Not one word. If you look at me I shall look at the ceiling.',
        ],
        once: true,
      },
      {
        id: 'hal-a5-02',
        playerLine: 'He’ll strike half of it.',
        reply: [
          'He will strike everything you cannot cite, aloud, and the transcript prints with the gaps in it.',
          'That is not cruelty. It is the only mechanism in English public life that cannot be charmed.',
        ],
        once: true,
      },
      {
        id: 'hal-a5-03',
        playerLine: 'How do I answer the last question?',
        reply: [
          'Item 14. Her own signature, her own service, her own reckonable date. Hold it up. Do not explain it.',
          'In twenty-nine years I have never seen a Board fail to do the arithmetic for itself.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-liabilities-item14' },
        once: false,
      },
      {
        id: 'hal-a5-04',
        playerLine: 'Why did you really send me?',
        reply: [
          'Because he asked for a stranger, and I believed this building would close round anybody it recognised.',
          'I nominated you on the third and fell on the twelfth and let everyone believe otherwise. — Was I right?',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-commission-minute' },
        once: true,
        isConfrontation: true,
        effects: [{ kind: 'setFlag', flag: 'halkett-told-the-truth', value: true }],
      },
    ],
  },
];
