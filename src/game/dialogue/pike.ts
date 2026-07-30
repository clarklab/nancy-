import type { DialogueTree } from '@/engine/types';

/**
 * Halvard Pike — Chief Clerk, forty-four years in the building.
 *
 * Short, flat, declarative. Shelf-marks used as ordinary nouns. Insults by
 * classification. Sentences about himself simply stop. In Act III, at his own
 * kitchen table, he talks and talks and cannot look at her.
 */
export const pikeTrees: DialogueTree[] = [
  // -------------------------------------------------------------- Act I ----
  {
    characterId: 'halvard-pike',
    act: 1,
    greeting:
      'No. I don’t shake hands. Ink. — You’ll be the Conservancy, then. Nineteen. God help the shelving.',
    exhausted: 'That’s your lot. Trolley’s due and you’re stood where it turns.',
    farewell: 'Wicket shuts at five. Don’t leave a pencil on a shelf.',
    nodes: [
      {
        id: 'pik-a1-01',
        playerLine: 'I’m here to appraise the archive.',
        reply:
          'You’re here to pick the interesting ten per cent, microfilm it and pulp the rest. Don’t tell me otherwise. I’ve read the circular. Twelve stroke eighty-five. I can recite it.',
        once: true,
      },
      {
        id: 'pik-a1-02',
        playerLine: 'Show me how a requisition works in this building.',
        reply:
          'White top copy up the tube. Pink carbon stays in the stub. Countersignature box. And if you write on my stub book in biro I’ll have the pen off you and you can whistle for it.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'pike-taught-requisitions', value: true }],
      },
      {
        id: 'pik-a1-03',
        playerLine: 'You’ve got opinions about folders.',
        reply: [
          'One hand in this building dockets the Ministry way. Outside third, upside down to the tag. You turn the whole file over to read your own file.',
          'Whitehall, 1958. Everybody else does it like a Christian.',
        ],
        once: true,
        effects: [{ kind: 'giveClue', clue: 'clue-docket-fold' }],
      },
      {
        id: 'pik-a1-04',
        playerLine: 'Tell me about Cormac Sallow.',
        reply:
          'Lamp Superintendent, fifty-eight to eighty-four. Kept his reports in date order and his pencils sharp. Went over a rail at seventy-nine. That’s the lot. Fourteen stroke B if you want his hand.',
        once: true,
      },
      {
        id: 'pik-a1-05',
        playerLine: 'You weren’t the one who admitted him that morning.',
        reply: [
          'Wasn’t here. Ferry.',
          'Look at the column if you don’t believe me. You’ve looked at it already, I can see it on you.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-visitors-book' },
        once: true,
      },
      {
        id: 'pik-a1-06',
        playerLine: 'Why do you tie the tag like that?',
        reply:
          'Tail under, loop left. Your people’s knot, that. Conservancy. Somebody taught you it in a classroom and I’ve done it forty-four years. Don’t square it the other way in my registry.',
        once: true,
      },
      {
        id: 'pik-a1-07',
        playerLine: 'Where does the tube go?',
        reply:
          'Wicket to Registry, Registry to the Warden’s pigeonhole, and a dead leg to Accounts that’s been bunged with a tennis ball since 1979. Everything in this building goes past her desk. That’s not a hint. That’s plumbing.',
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'halvard-pike',
    act: 2,
    greeting: 'Trolley’s coming up. Don’t touch it. Sit down and put your hands somewhere I can see them.',
    exhausted: 'Nothing else? Then shift. I’ve two hundred slips to file and one of them’s yours.',
    farewell: 'Go on. And don’t come back at me with a photocopy.',
    nodes: [
      {
        id: 'pik-a2-01',
        playerLine: 'Slip 2271 came back as the wrong box. 14/A instead of 14/B.',
        reply: [
          'One character. That’s not a mistake, that’s a typist.',
          'Or it’s me going blind on the ladder. Take your pick. I know which you’ve taken.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-substituted-slips' },
        once: true,
      },
      {
        id: 'pik-a2-02',
        playerLine: 'Forty-seven index cards were retyped on the Underwood.',
        reply:
          'Then somebody’s been in the Rolls Room with too much time and a clean ribbon. Weeding a file’s an afternoon. Weeding an index is a fortnight. Nobody does it. Somebody did.',
        availableIf: { kind: 'hasClue', clue: 'clue-index-gap' },
        once: true,
      },
      {
        id: 'pik-a2-03',
        playerLine: '“The light was not discontinued.” That’s Sallow, Day 9.',
        reply: [
          'That’s an administrative answer to an operational question. He’d have known that. He was a lamp man, not a clerk.',
          'He’d have known that.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sallow-1975-transcript' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-pike', by: 1 }],
      },
      {
        id: 'pik-a2-04',
        playerLine: 'There’s no 74/119 in the Register of Notices Issued.',
        reply:
          'Numbers get cancelled. Minuted. Reallocated. Something. Nothing is the one thing a number never does. Ask the Warden. She reboxed everything in eighty-nine.',
        availableIf: { kind: 'hasClue', clue: 'clue-issued-register' },
        once: true,
      },
      {
        id: 'pik-a2-05',
        playerLine: 'Where are the Despatch Books for 1970 to 1979?',
        reply:
          'No notion. Not traced. There’s a slip in the stub book says so in my writing. Ask the Warden. She reboxed everything.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'pike-denies-despatch-books', value: true }],
      },
      {
        id: 'pik-a2-06',
        playerLine: 'Why do you hate me?',
        reply: [
          'I don’t. You’re a form with legs.',
          'Forty-four years. Copy boy at twenty-two. There’s no other building. That’s not your fault and I’ll still not be pleasant about it.',
        ],
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-pike', by: 1 }],
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'halvard-pike',
    act: 3,
    greeting: [
      'Strongroom key’s on the third hook and I’m going to my dinner.',
      'Get in the van after. Bring a coat, there’s no heater and there’s no radio either.',
    ],
    exhausted: 'You’ve gone quiet. Good. Kettle’s on the ring and the ledger’s not going anywhere.',
    farewell: 'Mind the step down. It’s not a step, it’s a subsidence, and I’ve reported it to nobody.',
    nodes: [
      {
        id: 'pik-a3-01',
        playerLine: 'This is the Oil Requisition Book. It’s been out of the building since 1985.',
        reply: 'Nothing’s ever left this building on my watch. Nothing. Forty-four years and not one item.',
        availableIf: { kind: 'hasClue', clue: 'clue-oil-requisition-book' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'pik-a3-01-table',
            playerLine: 'It’s on your kitchen table, Mr Pike.',
            reply: [
              'I took it. Four journeys, in the rain, in the van.',
              'The circular said burn them. I’m not a man who burns things.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'pike-admitted-removals', value: true },
              { kind: 'addCounter', counter: 'trust-pike', by: 2 },
            ],
            children: [
              {
                id: 'pik-a3-01-howmany',
                playerLine: 'How many?',
                reply:
                  'Three thousand and some. Catalogued on the backs of tide-table covers because paper costs money and I’d taken enough of it. — Don’t look at me like that. Look at the shelf behind you.',
                once: true,
              },
            ],
          },
        ],
      },
      {
        id: 'pik-a3-02',
        playerLine: 'The Despatch Book was on your dresser the whole time.',
        reply: 'I told you I’d no notion where it went. It’s in the stub book in my own writing. Not traced.',
        availableIf: { kind: 'hasClue', clue: 'clue-despatch-docket' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'pik-a3-02-covers',
            playerLine: 'Your own catalogue has it. Tide tables, 1971, inside cover.',
            reply: [
              'I knew exactly where it went. It went in a Bedford van with three thousand others, and I catalogued the lot on tide-table covers.',
              'Read the covers.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'pike-catalogue-open', value: true },
              { kind: 'addCounter', counter: 'trust-pike', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'pik-a3-03',
        playerLine: 'Why the Lights series?',
        reply: [
          'Circular said destroy on transfer to Trinity House. So I didn’t. Filed under Lights, all of it. And I’m a Pilotage man.',
          'Go on. Ask me what’s in the box marked STORES 1966 to 80.',
        ],
        once: true,
      },
      {
        id: 'pik-a3-04',
        playerLine: 'What’s in the box marked LIGHTS: STORES 1966–80?',
        reply: 'Paper.',
        availableIf: { kind: 'hasClue', clue: 'clue-oil-requisition-book' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'pik-a3-04-lid',
            playerLine: 'Lift the lid.',
            reply: [
              'I don’t know. Forty-four years, and I’ve said I know every document in this building, and I never once lifted that lid.',
              'Twenty-four years it sat there. That’s what the boast cost.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'pike-boast-broken', value: true },
              { kind: 'addCounter', counter: 'trust-pike', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'pik-a3-05',
        playerLine: 'You’ll be prosecuted for all of this.',
        reply:
          'Two hundred pound and my name in the Rossport Gazette. I’ve done the sum. Sit down. Ledger’s the one with the green spine, and mind the corners, they’re soft.',
        once: true,
      },
      {
        id: 'pik-a3-06',
        playerLine: 'The third column won’t agree.',
        reply: [
          'No. It won’t.',
          'Dues every week. Wages every week. Oil stops the twenty-fourth of August. Don’t say it out loud yet. Finish the line first. Finish the whole line.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-reconciliation' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'pike-saw-the-gap', value: true }],
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'halvard-pike',
    act: 4,
    greeting: 'You smell of smoke. So do I. Don’t fuss and don’t ask about my chest.',
    exhausted: 'Sit there and dry off, then. I’ll not be talked at while the tea’s going cold.',
    farewell: 'Go on. Blot, don’t press. I’ll know if you’ve pressed them.',
    nodes: [
      {
        id: 'pik-a4-01',
        playerLine: 'The ferry book clears you for the fourteenth of September.',
        reply: 'I know. Eight fifteen out, seventeen forty back, four gallons at the Cardew garage at twenty past six.',
        availableIf: { kind: 'hasClue', clue: 'clue-ferry-booking-book' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'pik-a4-01-why',
            playerLine: 'You’ve had that alibi for six weeks. Why not say so?',
            reply:
              'Because the same book says what else was in the van. — I’d have let you hang me before I’d have said where I was.',
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'pike-alibi-explained', value: true },
              { kind: 'addCounter', counter: 'trust-pike', by: 2 },
            ],
          },
        ],
      },
      {
        id: 'pik-a4-02',
        playerLine: 'Twenty-nine Reprax impressions that day against twelve logged. It’s your book.',
        reply:
          'It’s my book and I was nine miles away. Somebody worked my counter, ran my machine, and wrote nothing in my log. That’s not theft. That’s worse than theft.',
        availableIf: { kind: 'hasClue', clue: 'clue-reprax-1998' },
        once: true,
      },
      {
        id: 'pik-a4-03',
        playerLine: 'Every document of that autumn is signed per procurationem.',
        reply:
          'Aye. And I carried the trays for it. Twenty-two years old, up and down that stair, four times a day. Never once looked at the corner of the page. Two millimetres.',
        availableIf: { kind: 'hasClue', clue: 'clue-pp-sort' },
        once: true,
      },
      {
        id: 'pik-a4-04',
        playerLine: 'You went back into the fire twice.',
        reply: [
          'There were nine bundles. You got four out.',
          'Don’t tell me which four. Not tonight. Tell me tomorrow when I’ve had my tea.',
        ],
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-pike', by: 1 }],
      },
      {
        id: 'pik-a4-05',
        playerLine: 'I’m sorry about the cottage.',
        reply: [
          'That’s not a document, that’s an apology.',
          'Keep what you saved dry. Sallow’s reports took water on the left edge. Blot them, don’t press them, and don’t let them near a radiator.',
        ],
        once: true,
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'halvard-pike',
    act: 5,
    greeting: 'Best coat. Don’t say anything about the coat.',
    exhausted: 'They’ll call us in a minute. Stand up straight and stop rehearsing.',
    farewell: 'Go in. I’ll be behind you, and I’ll not sit at the back.',
    nodes: [
      {
        id: 'pik-a5-01',
        playerLine: 'The Board may hold your removals against half the exhibits.',
        reply: [
          'They will. Chain of custody. Pargeter’ll be up on his hind legs inside four minutes.',
          'Tell them the truth. Tell them a clerk stole them. Then tell them what’s in them.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'pike-consents-to-be-named', value: true }],
      },
      {
        id: 'pik-a5-02',
        playerLine: 'Four thousand one hundred and eighty pounds, four shillings.',
        reply:
          'For a light that wasn’t burning. Say the number slowly and then stop talking. They’ll do the sum in their heads and then they’ll all look at their shoes.',
        availableIf: { kind: 'hasClue', clue: 'clue-reconciliation' },
        once: true,
      },
      {
        id: 'pik-a5-03',
        playerLine: 'Will you say it yourself, if they ask you?',
        reply: [
          'I’ll say it standing. Forty-four years, brown coat, no wife, no garden. If the last thing on my record is that I carried them home, I’ll have that.',
          'Don’t put that in the file.',
        ],
        once: true,
      },
      {
        id: 'pik-a5-04',
        playerLine: 'Come down to the quay tonight.',
        reply: [
          'I’ll be on the quay.',
          'I’ve never seen it lit. Started in fifty-four. Went out in seventy-four. I did the shelving in between and never once looked out of a window.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'pike-on-the-quay', value: true }],
      },
    ],
  },
];
