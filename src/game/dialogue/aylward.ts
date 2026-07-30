import type { DialogueTree } from '@/engine/types';

/**
 * Bram Aylward — "Ministry dissolution liaison"; in fact a recovery
 * investigator for Kelbrooke & Hain, marine adjusters.
 *
 * Light, quick, disarmingly frank about everything except his employer.
 * Deflects with a question, and it is usually a good one. Quotes figures to
 * the penny and enjoys it. THE RULE the player must discover: he never lies
 * about a fact of the case — only ever about himself. When the truth finally
 * comes out in Act III it arrives in the flattest voice he owns.
 */
export const aylwardTrees: DialogueTree[] = [
  // -------------------------------------------------------------- Act I ----
  {
    characterId: 'bram-aylward',
    act: 1,
    greeting: [
      'Aylward. Ministry — dissolution liaison. You’ll be the Conservancy.',
      'Sorry, that’s rude. Do you drink coffee? There’s a flask in the site hut and it’s better than it deserves to be.',
    ],
    exhausted: 'Out of questions? That’s a first for this building. Go on, go and read something and come back sharper.',
    farewell: 'Right. I’ll be about. I’m always about — that’s rather the complaint against me.',
    nodes: [
      {
        id: 'bra-a1-01',
        playerLine: 'Which liaison office, exactly?',
        reply:
          'The dissolution desk. Small unit, no letterhead worth the name. Do you want the number? It rings a room with one telephone in it and nobody sitting by it. That’s Whitehall for you.',
        once: true,
      },
      {
        id: 'bra-a1-02',
        playerLine: 'You signed the visitors’ book on the sixth of October. You told me Tuesday.',
        reply: 'Did I say Tuesday? I’ve been in and out. It runs together after a fortnight in a building like this.',
        availableIf: { kind: 'hasClue', clue: 'clue-visitors-book' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'bra-a1-02-book',
            playerLine: 'Twenty days, Mr Aylward. It’s your own signature.',
            reply: [
              'Sixth of October. Twenty days.',
              'You read the book before you read the file, which is the right order, and almost nobody does it. Well done.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'aylward-early-arrival-known', value: true },
              { kind: 'addCounter', counter: 'aylward-caught', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'bra-a1-03',
        playerLine: 'What does the Ministry want with a pilotage archive?',
        reply: [
          'Reconciliation of liabilities, mostly. Dull as a wet Sunday.',
          'Ask me a better question. Ask me what the Pelagia was insured for in 1974 and watch me answer to the penny.',
        ],
        once: true,
      },
      {
        id: 'bra-a1-04',
        playerLine: 'What was the Pelagia insured for?',
        reply: [
          'Hull and machinery, one point one million. Cargo, four hundred and six thousand. Settled in 1975 on a finding of pilot error.',
          'Which is a very expensive sentence, if it happens to be wrong.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'aylward-quoted-the-policy', value: true }],
      },
      {
        id: 'bra-a1-05',
        playerLine: 'Your identity card is laser-printed.',
        reply: [
          'Is it?',
          'Everything in this building was letterpressed in 1988 and it shows, doesn’t it. You’ve a good eye for stock. Genuinely. Don’t waste it on me, I’m the least interesting thing here.',
        ],
        once: true,
        effects: [{ kind: 'addCounter', counter: 'aylward-caught', by: 1 }],
      },
    ],
  },

  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'bram-aylward',
    act: 2,
    greeting: [
      'There she is. You look like somebody who’s spent a day sorting index cards by ribbon colour.',
      'I’d have paid money to watch that. I mean it kindly.',
    ],
    exhausted: 'Nothing? Then I’ll ask one. Who in this building has never once been surprised by anything you’ve found?',
    farewell: 'Off you go. Eat. You’re running on tea and indignation and only one of those scales.',
    nodes: [
      {
        id: 'bra-a2-01',
        playerLine: 'Seven documents exist as cards and not as paper.',
        reply: ['Seven. Yes.', 'That’s not a question, that’s a shopping list. What would you give for two of them?'],
        availableIf: { kind: 'hasClue', clue: 'clue-index-gap' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'aylward-hinted-at-photos', value: true }],
      },
      {
        id: 'bra-a2-02',
        playerLine: 'You’ve been photographing documents.',
        reply: [
          'I haven’t photographed a thing. Wouldn’t dare.',
          'Why? Has somebody said I have? Which somebody? That’s the more useful question and you know it is.',
        ],
        once: true,
        isConfrontation: true,
        effects: [{ kind: 'addCounter', counter: 'aylward-caught', by: 1 }],
      },
      {
        id: 'bra-a2-03',
        playerLine: 'Who do you actually work for?',
        reply: [
          'Does it matter? Everything I’ve told you about this case is true. Check any of it, check all of it.',
          'You won’t trust me, and you’re right not to, and it will cost you a day.',
        ],
        once: true,
      },
      {
        id: 'bra-a2-04',
        playerLine: 'Sallow’s evidence, Day 9.',
        reply: [
          '“The light was not discontinued.” Beautiful. Administrative answer, operational question, and Balgowan let it go by because he’d had lunch.',
          'Sixty-eight men asked that question badly in 1975. I’ve counted them.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sallow-1975-transcript' },
        once: true,
      },
      {
        id: 'bra-a2-05',
        playerLine: 'Why are you being helpful?',
        reply: [
          'Because you’re the only person here doing the work and I’d like it done.',
          'That’s not the same as being on your side. Write that down somewhere with a date on it.',
        ],
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'bram-aylward',
    act: 3,
    greeting:
      'Bad week. Your boatwoman’s in a cell in Rossport, your warrant’s a fax in somebody’s bin, and you’re stood in the rain talking to a man in the wrong shoes.',
    exhausted: 'Nothing more? Then think about it overnight. That’s not pressure. That is, actually, entirely pressure.',
    farewell: 'Guest house on Marine Terrace, room 4. Knock any hour. I don’t sleep, it’s a professional advantage.',
    nodes: [
      {
        id: 'bra-a3-01',
        playerLine: 'You knew that letter was forged before I tested it.',
        reply: 'I never said a word about that letter. Not one word, at any point, to you or anybody.',
        availableIf: { kind: 'hasClue', clue: 'clue-deakin-letter' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'bra-a3-01-flat',
            playerLine: 'No. But you stopped asking about it on the twenty-eighth.',
            reply: [
              'Kelbrooke and Hain. Marine adjusters. Recovery investigator.',
              'There is no Ministry, there never was, and I’ve put thirty-one rolls of HP5 through that building since the sixth.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'aylward-unmasked', value: true },
              { kind: 'addCounter', counter: 'aylward-caught', by: 2 },
            ],
          },
        ],
      },
      {
        id: 'bra-a3-02',
        playerLine: 'You have two of my seven.',
        reply: [
          'Frames 14 and 15, roll nine. Contact prints in a guest house in Rossport. The only images on earth of two documents that no longer exist.',
          'Would you like to hear my price?',
        ],
        availableIf: {
          kind: 'all',
          of: [
            { kind: 'flag', flag: 'aylward-unmasked' },
            { kind: 'hasClue', clue: 'clue-index-gap' },
          ],
        },
        once: true,
      },
      {
        id: 'bra-a3-03',
        playerLine: 'What’s your price?',
        reply: [
          'Your signed statement. We reopen for fraudulent non-disclosure. Fourteen point two million at today’s values, three point nine per cent of it mine.',
          'And your archive freezes as evidence, and the Board sits without you.',
        ],
        availableIf: { kind: 'flag', flag: 'aylward-unmasked' },
        once: true,
        isConfrontation: true,
        effects: [{ kind: 'setFlag', flag: 'aylward-price-heard', value: true }],
        children: [
          {
            id: 'bra-a3-03-refuse',
            playerLine: 'No. Not for two photographs and a pulper on the fourth.',
            reply:
              'No. Right. — Say that again on the third, in the room, when Pargeter strikes your only source for the deferment. I’ll be at the back, and I won’t enjoy it, and I’ll still be right.',
            once: true,
            effects: [{ kind: 'setFlag', flag: 'aylward-offer-refused', value: true }],
          },
          {
            id: 'bra-a3-03-defer',
            playerLine: 'Ask me again when I know what I’m trading.',
            reply:
              'That’s the correct answer and it’s the one I’d have given. — Room 4, Marine Terrace. The prints don’t go anywhere before the third. You have my word, which is worth exactly what you think it is.',
            once: true,
            effects: [{ kind: 'setFlag', flag: 'aylward-offer-deferred', value: true }],
          },
        ],
      },
      {
        id: 'bra-a3-04',
        playerLine: 'You’d freeze the building to get paid.',
        reply: [
          'Freeze, not pulp. Which is worse, because it’s slower.',
          'I closed a claim wrongly in 1994 and a widow in Grimsby got nothing. I carry her letter. And I’m still asking. Work out what that makes me.',
        ],
        availableIf: { kind: 'flag', flag: 'aylward-price-heard' },
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'bram-aylward',
    act: 4,
    greeting: [
      'You’ve been on a roof with an Aldis lamp. There’s soot on your collar and you don’t know it.',
      'No, leave it. It suits the mood of the thing.',
    ],
    exhausted: 'Nothing else? Then go and be somewhere useful. I’ve a train and a conscience to catch.',
    farewell: 'Go on. And Miss Adare — cite everything. Everything. Even the things that hurt.',
    nodes: [
      {
        id: 'bra-a4-01',
        playerLine: 'Forty-one documents. Every one of them p.p.',
        reply: [
          'Per procurationem.',
          'Twenty-four years of adjusters and King’s Counsel and nobody turned the page to the corner. Two millimetres of pencil. Two millimetres, Miss Adare.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-pp-sort' },
        once: true,
      },
      {
        id: 'bra-a4-02',
        playerLine: 'Twenty-two forty-one. Extension 2 to Cardew 4471.',
        reply: [
          'That’s your own building’s book, and any counsel with a pulse strikes it as self-serving.',
          'Get the GPO account. Strangers keeping records for money. That’s the only kind anybody believes.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-switchboard-log' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'aylward-pointed-at-gpo', value: true }],
      },
      {
        id: 'bra-a4-03',
        playerLine: 'Give me the photographs.',
        reply: [
          'For nothing? — Yes. All right. Yes.',
          'Don’t thank me, and don’t put my firm’s name in your citation column, because if you do the Board freezes the lot and we both lose everything.',
        ],
        availableIf: { kind: 'flag', flag: 'aylward-price-heard' },
        once: true,
        effects: [
          { kind: 'setFlag', flag: 'aylward-photos-given', value: true },
          { kind: 'addCounter', counter: 'trust-bram', by: 2 },
        ],
      },
      {
        id: 'bra-a4-04',
        playerLine: 'Why?',
        reply: [
          'Because I want it in a finding, a finding needs a Board, and a Board needs you.',
          'That’s not decency. That’s a man choosing the faster route. Ask me again in 2003 and see what I say.',
        ],
        availableIf: { kind: 'flag', flag: 'aylward-photos-given' },
        once: true,
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'bram-aylward',
    act: 5,
    greeting: 'Back row, good suit, notebook on my knee. I’ve sat through four hundred of these. This is the only one I’ve ever wanted to watch.',
    exhausted: 'That’s everything I’ve got that’s any use. The rest is just me talking, and you’ve a room to go into.',
    farewell: 'Go in. Straight back, flat voice, accession numbers. And don’t look at me when it lands.',
    nodes: [
      {
        id: 'bra-a5-01',
        playerLine: 'Your clients will recover millions.',
        reply: [
          'Nine point one, I’d guess, and about five years. The thirty-one families get nothing — they were never parties.',
          'That’s not cruelty, it’s the law of contract, and it’s why nobody should let me near a eulogy.',
        ],
        once: true,
      },
      {
        id: 'bra-a5-02',
        playerLine: 'Article 9. “A man of full age.”',
        reply: [
          'Eighteen eleven, never amended in 187 years. That clause is why nobody could find her, and it’s why Pargeter can’t unfind her.',
          'Lead with it. Don’t explain it. Read it and then stop talking.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-charter-art9' },
        once: true,
      },
      {
        id: 'bra-a5-03',
        playerLine: 'What do I do when he strikes a link?',
        reply: [
          'Nothing. Don’t argue, don’t restate, and God, don’t apologise.',
          'Say the accession number. Then say absolutely nothing, and let him be the one who fills the silence. He always is.',
        ],
        once: true,
      },
      {
        id: 'bra-a5-04',
        playerLine: 'Goodbye, Mr Aylward.',
        reply: [
          'Bram. — No? Fine.',
          'I’ll send you a card at Christmas and you won’t open it, and I’ll send another the year after. It’s the only correspondence I’ve got that isn’t about money.',
        ],
        once: true,
      },
    ],
  },
];
