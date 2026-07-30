import type { DialogueTree } from '@/engine/types';

/**
 * Dr Ivo Sandbach — conservation architect, project manager, outsider.
 *
 * Programme language as a first language: out of float, tranche, practical
 * completion, that's a Tuesday problem. First names immediately and wrongly
 * ("Wendy" for Wren, every act, until Act V). Fifteen per cent too fast, so
 * his pauses land like a dropped tool. Guilty of exactly what he looks guilty
 * of and of nothing else whatsoever.
 */
export const sandbachTrees: DialogueTree[] = [
  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'ivo-sandbach',
    act: 2,
    greeting: [
      'Wendy! No — Wren. Wren, sorry, I’m terrible with — right.',
      'Hard hat, technically. Nobody wears it. Two minutes, I’m out of float on the Chart Loft.',
    ],
    exhausted: 'Right, that’s me. Anything else is a Tuesday problem and it is not Tuesday.',
    farewell: 'Mind the scaffold, love. It’s signed off, it’s just not friendly.',
    nodes: [
      {
        id: 'san-a2-01',
        playerLine: 'What’s the strip-out programme?',
        reply: [
          'Room by room, pinned in the hut, day by day. Chart Loft goes on the thirtieth. Rolls Room index skipped to the thirty-first.',
          'Practical completion the first of December, and that date is not negotiable, love.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sandbach-programme-explained', value: true }],
      },
      {
        id: 'san-a2-02',
        playerLine: 'The incinerator wouldn’t draw last night.',
        reply: [
          'Course it wouldn’t. Damper’s off — item 41, second of September, my lads took it out. Flue’s open to the sky.',
          'Anybody burning anything in that thing gets a face full of wet ash and serves them right.',
        ],
        once: true,
        effects: [{ kind: 'giveClue', clue: 'clue-incinerator-damper' }],
      },
      {
        id: 'san-a2-03',
        playerLine: 'You keep a site diary?',
        reply:
          'Every day since March, in my own hand, because that’s how you don’t get sued. Loose baluster, cracked lintel, who turned up, who didn’t. Riveting stuff. Nobody has ever read a word of it.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sandbach-diary-mentioned', value: true }],
      },
      {
        id: 'san-a2-04',
        playerLine: 'What happens if a marine inquiry is reopened?',
        reply: [
          'It isn’t. It can’t be. Site becomes a place of interest, everything freezes, the tranche doesn’t release on the first —',
          'and that’s a Tuesday problem I am not having on a Thursday, Wendy. Wren.',
        ],
        once: true,
      },
      {
        id: 'san-a2-05',
        playerLine: 'Rooms are becoming unavailable faster than I can read them.',
        reply: [
          'That’s the programme, not me. I’ve given you the Rolls Room an extra day and it’s cost me two men.',
          'Tell me which room and I’ll tell you what it costs. Everything’s a number.',
        ],
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'ivo-sandbach',
    act: 3,
    greeting: [
      'Wren! God. You gave me —',
      'this is a salvage record. I am recording salvage. At two in the morning. In a crate. Addressed to Antwerp.',
    ],
    exhausted: 'Are we done? Only I’m standing in a yard at two in the morning being honest, and it’s not a habit I want.',
    farewell: 'Go on, then. Tell her. She’ll have known a fortnight anyway.',
    nodes: [
      {
        id: 'san-a3-01',
        playerLine: 'You said nothing leaves this site without a schedule entry.',
        reply: 'Absolutely nothing. Ministry-approved, for God’s sake. Every item, condition-surveyed, photographed, listed.',
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'san-a3-01-crate',
            playerLine: 'Then read me the entry for this crate.',
            reply: [
              'Two Fresnel panels, the binnacle, a hundred and forty kilos of brass. Thirty grand.',
              'Payroll’s nine weeks. I’ve two girls at school.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'sandbach-admitted-salvage', value: true },
              { kind: 'addCounter', counter: 'sandbach-exposure', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'san-a3-02',
        playerLine: 'You’ll be prosecuted for this.',
        reply: [
          'I’ll be administrated first, which is quicker and hurts less.',
          'Don’t tell Sabine. No. Tell her. She’ll have known a fortnight. She knows what’s in every skip on this site, that woman.',
        ],
        availableIf: { kind: 'flag', flag: 'sandbach-admitted-salvage' },
        once: true,
      },
      {
        id: 'san-a3-03',
        playerLine: 'Item 41 and item 63. The gallery rail.',
        reply: [
          'Baluster 3, north bay, loose on the second. Made good on the fifteenth.',
          'Out of programme, no order number, not billed, at the Warden’s personal instruction. I wrote it because I wasn’t being paid for it.',
        ],
        availableIf: { kind: 'hasItem', item: 'site-diary' },
        once: true,
        effects: [{ kind: 'giveClue', clue: 'clue-site-diary-rail' }],
      },
      {
        id: 'san-a3-04',
        playerLine: 'Where were you on the fourteenth of September?',
        reply: [
          'Rossport, with the structural engineer, eleven till three, and there’s an invoice.',
          'Cleanest alibi in the building and I can see you’re disappointed. Everyone is. I’m the man you all want it to be.',
        ],
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'ivo-sandbach',
    act: 4,
    greeting: [
      'You look like a fortnight of bad weather.',
      'Sorry. I do that. Say what you want, quickly, I’ve a lorry coming at eight.',
    ],
    exhausted: 'Right. Then I’ve a lorry, and you’ve a boat, and neither of us wants either.',
    farewell: 'Go on. And Wren — it is Wren, isn’t it — get some sleep before the water.',
    nodes: [
      {
        id: 'san-a4-01',
        playerLine: 'You told me the quantity surveyor’s meeting was on the fifteenth.',
        reply: [
          'Fifteenth. Half ten. It’s in my diary, it’s on his invoice, and it’s on my phone bill.',
          'She’s said the fourteenth, has she. Right. Well. That’s not a Tuesday problem, is it.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-slip-r982211' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sandbach-broke-the-alibi', value: true }],
      },
      {
        id: 'san-a4-02',
        playerLine: 'Tell me about the rail again.',
        reply: [
          'She rang me half seven on the morning of the fifteenth. Personal instruction, no order, no bill.',
          'I thought she was being decent. Grieving. Tidying up. I’ve thought about it every night since you asked me.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-site-diary-rail' },
        once: true,
      },
      {
        id: 'san-a4-03',
        playerLine: 'I need one of those Fresnel panels back.',
        reply: [
          'It’s in Antwerp, love. Shipping agent, paid, gone, invoiced.',
          'How long have I — no. Don’t answer that. What time do you need it lit.',
        ],
        availableIf: { kind: 'flag', flag: 'sandbach-admitted-salvage' },
        once: true,
      },
      {
        id: 'san-a4-04',
        playerLine: 'Twenty-three hundred hours tomorrow.',
        reply: [
          'Then I’m on the four o’clock road to Rossport with money I haven’t got.',
          'Don’t put this in your book. I mean it. It doesn’t buy me anything and I’d rather it didn’t try.',
        ],
        availableIf: { kind: 'flag', flag: 'sandbach-admitted-salvage' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sandbach-buying-panel-back', value: true }],
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'ivo-sandbach',
    act: 5,
    greeting: [
      'Fleece. It’s wrapped in a fleece. Don’t unwrap it out here, the wind’ll have it off you.',
      'Right. That’s me.',
    ],
    exhausted: 'That’s the lot. Engine’s running and I’ve nothing left that’s any use to you.',
    farewell: 'Go and set your plates, Wren. — Yes. I got there in the end.',
    nodes: [
      {
        id: 'san-a5-00',
        playerLine: 'Is that it?',
        reply:
          'Panel four of six, Chance Brothers, 1871, and there’s a chip out of the top prism that was there when I sold it, so don’t you dare put that on my schedule.',
        once: true,
        effects: [
          { kind: 'giveItem', item: 'fresnel-panel' },
          { kind: 'setFlag', flag: 'panel-returned', value: true },
        ],
      },
      {
        id: 'san-a5-01',
        playerLine: 'Why?',
        reply:
          'Because it’s a lens for a lighthouse and I sold it to a man in Antwerp. There isn’t a better answer than that. There’s just that sentence, and I’ve had to say it out loud twice now.',
        once: true,
      },
      {
        id: 'san-a5-02',
        playerLine: 'The Board will hear about the brass this afternoon.',
        reply: [
          'The Board, the Ministry, the RIBA, my wife, and two girls of nine and twelve.',
          'Nineteenth of January, administration — I’ve had the letter drafted since August. Set your plates and don’t be kind to me.',
        ],
        once: true,
      },
      {
        id: 'san-a5-03',
        playerLine: 'Your diary is exhibit six.',
        reply: [
          'My diary. The thing I kept so I wouldn’t get sued.',
          'Item 63 is eleven words long. Eleven words. I wrote it standing in the rain wanting my dinner and it convicts a Warden.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-site-diary-rail' },
        once: true,
      },
      {
        id: 'san-a5-04',
        playerLine: 'Will you be on the quay tonight?',
        reply: [
          'No. I’ll be on the road.',
          'But I’ll pull in at the Cardew turn about five past eleven, and I’ll have the engine off, and I’ll look at the sea like everybody else.',
        ],
        once: true,
      },
    ],
  },
];
