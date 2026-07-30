import type { DialogueTree } from '@/engine/types';

/**
 * Enid Charnock — Cashier and Accountant since 1962.
 *
 * Precise to the penny about figures, useless about people: a question about a
 * person gets answered with a ledger. "I'm sure there's an explanation"
 * precedes every piece of bad news. Her eyes go to the Warden's door about
 * every ninety seconds. Under pressure the sentences shorten and the
 * arithmetic speeds up. She calls her terror of Sabine "respect", and she
 * would like everything minuted.
 */
export const charnockTrees: DialogueTree[] = [
  // -------------------------------------------------------------- Act I ----
  {
    characterId: 'enid-charnock',
    act: 1,
    greeting:
      'Miss Adare. Nine o’clock. I do the cash books until eleven and I would rather not be interrupted between now and then, if that’s — I’m sure that’s all right.',
    exhausted: 'Is that everything? Only it’s twenty past and the cash books do not do themselves and never have.',
    farewell: 'Pull the door to. It doesn’t catch unless you pull it, and then people say I leave it open.',
    nodes: [
      {
        id: 'eni-a1-01',
        playerLine: 'I need the schedule of outstanding liabilities.',
        reply: [
          'Twenty-two items, all trivial except item 9.',
          'Item 14 is a superannuation squabble — Ferrier-Kyne, S., two thousand one hundred and forty pounds four shillings, in dispute since March. Cross it off. It’s nothing.',
        ],
        once: true,
        effects: [
          { kind: 'giveItem', item: 'liabilities-schedule' },
          { kind: 'giveClue', clue: 'clue-liabilities-item14' },
        ],
      },
      {
        id: 'eni-a1-02',
        playerLine: 'How long have you been cashier?',
        reply:
          'Since 1962. Junior cashier at twenty-seven, cashier at thirty-nine. Thirty-six years and I have never once been a penny out. That is not a boast, Miss Adare. It is a thing you can audit.',
        once: true,
      },
      {
        id: 'eni-a1-03',
        playerLine: 'Tell me about the stationery ledger.',
        reply:
          'Rule 4. No new typewriter ribbon issued until the used spool is returned. Since 1968. People laugh. A ribbon is one and ninepence, there are four machines, and the arithmetic is the arithmetic.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'charnock-rule-4-explained', value: true }],
      },
      {
        id: 'eni-a1-04',
        playerLine: 'What was the Authority’s financial position in 1974?',
        reply: [
          'I’m sure there’s an explanation for all of it.',
          'Difficult. That is the word in the minutes. Difficult. You’d want the Warden for anything before 1991. Truly. The Warden.',
        ],
        once: true,
      },
      {
        id: 'eni-a1-05',
        playerLine: 'I’ve opened the franking meter under warrant.',
        reply: [
          'You’ve — the descending register. Yes. Well.',
          'It reconciles to the post book to the penny every quarter for thirty-six years, and I’d like it minuted that I said so before you looked and not after.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-franking-meter' },
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'enid-charnock',
    act: 2,
    greeting: [
      'Half nine. I’ve put the 1974 cash book back in the press and I would rather it stayed there while the men are on the scaffold.',
      'Dust gets into the gutter of a ledger and never comes out.',
    ],
    exhausted: 'Nothing further? Then I’ll get on. And I’d like it minuted that you asked and I answered.',
    farewell: 'Good morning, Miss Adare. Wipe your feet at the press. I know how that sounds.',
    nodes: [
      {
        id: 'eni-a2-01',
        playerLine: 'Tell me about Sundry Adjustments (Lights).',
        reply:
          'A rounding account. It’s always been there. Four thousand one hundred and eighty pounds, four shillings, nil pence. It hasn’t moved. I’m sure there’s an explanation for it.',
        once: true,
      },
      {
        id: 'eni-a2-02',
        playerLine: 'It was opened on the thirty-first of December 1974. In your hand.',
        reply: 'It has always been there. Always. It is a rounding account and it has always been there.',
        availableIf: { kind: 'hasClue', clue: 'clue-sundries-column' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'eni-a2-02-rule',
            playerLine: 'The column above it is 1963 ruling. Yours is drawn with a steel rule.',
            reply: [
              'I ruled it in. New Year’s Eve, with a steel rule, in my own hand.',
              'It has not moved in ninety-six quarters and I have looked at it in every single one.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'charnock-admitted-column', value: true },
              { kind: 'addCounter', counter: 'trust-enid', by: 1 },
            ],
            children: [
              {
                id: 'eni-a2-02-who',
                playerLine: 'On whose instruction?',
                reply:
                  '— I’m sure there’s an explanation. I would like this minuted: you asked me that question at nine forty-one and I did not answer it. Write the time down. Write it down properly.',
                once: true,
              },
            ],
          },
        ],
      },
      {
        id: 'eni-a2-03',
        playerLine: 'Light dues for the second half of 1974.',
        reply: [
          'Collected weekly, without exception. One thousand one hundred and eighty-two vessels between July and December. Four thousand one hundred and eighty pounds four shillings.',
          'You’ll want oil against that. Don’t ask me for oil.',
        ],
        once: true,
      },
      {
        id: 'eni-a2-04',
        playerLine: 'The Reprax counter jumped 437 on the fifteenth of August 1974.',
        reply:
          'The duplicating book isn’t mine, it’s the Registry’s. But the stencils and the toner are charged to me, and there was a large order that August, and I queried it. Once. In writing.',
        availableIf: { kind: 'hasClue', clue: 'clue-reprax-1974' },
        once: true,
      },
      {
        id: 'eni-a2-05',
        playerLine: 'Who signed the quarterly light-dues returns in 1974?',
        reply: [
          'I did. Junior cashier, aged thirty-nine, four signatures a year.',
          'Countersigned by the Warden’s Office. Not by the Warden. By the Office. There is a rubber stamp for it and I have never liked it.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'charnock-office-not-warden', value: true }],
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'enid-charnock',
    act: 3,
    greeting: 'It won’t take. I’ve been at it forty minutes and it won’t take. The rain gets down the — it won’t take.',
    exhausted: 'I have said what I am going to say. Please don’t stand in the wet asking me it differently.',
    farewell: 'Mind the step. It’s wet and there’s no light on it.',
    nodes: [
      {
        id: 'eni-a3-01',
        playerLine: 'Give me the cash book, Mrs Charnock.',
        reply:
          'I only ever did what I was told. And I have the paper to prove it. That is the worst part. That is the very worst part of the whole of it.',
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-enid', by: 1 }],
      },
      {
        id: 'eni-a3-02',
        playerLine: 'What were you burning?',
        reply: 'Nothing. I was airing the courtyard. The damper’s out, you can’t burn anything in that thing, ask the men.',
        availableIf: { kind: 'hasClue', clue: 'clue-scorched-carbon' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'eni-a3-02-ledger',
            playerLine: 'You’re holding a ledger in the rain, Mrs Charnock. Green spine.',
            reply: [
              'Ledger 74/1. Green spine, water damage to the fore-edge from a leak in 1983 which I reported.',
              'Take it. I’m not saying another word.',
            ],
            once: true,
            effects: [
              { kind: 'giveItem', item: 'cash-book-1974' },
              { kind: 'setFlag', flag: 'charnock-surrendered-cash-book', value: true },
              { kind: 'addCounter', counter: 'trust-enid', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'eni-a3-03',
        playerLine: 'Nobody thinks you took the money.',
        reply:
          'The police will. It sits in a column I ruled with my initials against ninety-six quarters of it. I have done the arithmetic on what that looks like. I did it in 1975 and I have never stopped.',
        availableIf: { kind: 'hasClue', clue: 'clue-sundries-column' },
        once: true,
      },
      {
        id: 'eni-a3-04',
        playerLine: 'Who told you to open the column?',
        reply: [
          '— I am not saying another word for two days, Miss Adare. I have said that and I mean it, and I would like you to go now, please.',
          'Mind the step. It’s wet and there’s no light on it.',
        ],
        once: true,
        isConfrontation: true,
        effects: [{ kind: 'setFlag', flag: 'charnock-two-day-silence', value: true }],
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'enid-charnock',
    act: 4,
    greeting: [
      'Don’t sit down. — No. Sit down.',
      'It was Miss Tain who fetched me off the ferry and I can’t be rude to you with her watching, she’s had a worse life than mine and she knows it.',
    ],
    exhausted: 'That is the whole of it. Thirty-six years and it comes to one sheet of paper and a resignation.',
    farewell: 'Eight fifteen. I’ve a sister in Ilberry. Don’t write to me at the building; there won’t be a building.',
    nodes: [
      {
        id: 'eni-a4-01',
        playerLine: 'The back cover of the cash book.',
        reply: [
          'Sixth of November, seventy-four. Warden’s Office to Cashier. The Nine Bells oil column to be carried to Sundry Adjustments (Lights) pending refit. Initialled p.p.',
          'I have looked at it perhaps four hundred times.',
        ],
        once: true,
        effects: [
          { kind: 'giveItem', item: 'sundries-memo' },
          { kind: 'giveClue', clue: 'clue-sundries-memo' },
          { kind: 'setFlag', flag: 'charnock-handed-memo', value: true },
          { kind: 'addCounter', counter: 'trust-enid', by: 2 },
        ],
      },
      {
        id: 'eni-a4-02',
        playerLine: 'You thought p.p. meant he was too ill to sign.',
        reply:
          'I thought it meant the Warden was unwell. Twenty-four years. It never once occurred to me it meant the Warden had not written it at all. Not once. I am a cashier, not a lawyer.',
        availableIf: { kind: 'hasClue', clue: 'clue-sundries-memo' },
        once: true,
      },
      {
        id: 'eni-a4-03',
        playerLine: 'Your rule 4 has hanged her.',
        reply: [
          'Two hundred and forty spools. Docketed, in date order, second shelf, one and ninepence each.',
          'I was called mean about that for thirty years. Write down that I was called mean.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-ribbon-spool' },
        once: true,
      },
      {
        id: 'eni-a4-04',
        playerLine: 'The GPO trunk account, quarter four, 1974.',
        reply: [
          'One and ninepence. Cardew. Four minutes. The third of November. Initialled EC, because I initialled everything.',
          'Somebody rang somewhere at twenty to eleven and I have been paying for it since.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-gpo-account' },
        once: true,
      },
      {
        id: 'eni-a4-05',
        playerLine: 'You’re resigning.',
        reply: [
          'Eight fifteen. I’ve a sister in Ilberry.',
          'I want it minuted that I raised it. Once. In writing. It’s in the file. It has always been in the file. Say that to them exactly as I said it.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'charnock-resigned', value: true }],
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'enid-charnock',
    act: 5,
    greeting: [
      'This is Enid Charnock speaking from my sister’s house in Ilberry. I can hear you perfectly.',
      'I will not be coming to the building. Ask your questions and speak up.',
    ],
    exhausted: 'Is there anything else for the record? Then I shall hang up and put the kettle on, and I shan’t enjoy it.',
    farewell: 'Goodbye, Miss Adare. Read the figure slowly. They never listen to the first half of a number.',
    nodes: [
      {
        id: 'eni-a5-01',
        playerLine: 'State the balance for the Board, please.',
        reply: [
          'Four thousand one hundred and eighty pounds, four shillings, nil pence. Carried forward ninety-six quarters.',
          'Never queried, never audited, and never a penny of interest, because I put it where interest does not reach.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sundries-column' },
        once: true,
      },
      {
        id: 'eni-a5-02',
        playerLine: 'Who instructed you to open it?',
        reply: [
          'The Warden’s Office. In writing. Sixth of November 1974, initialled p.p.',
          'I do not know whose hand made those initials. I have never known. You are the ones who know that. Not me.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sundries-memo' },
        once: true,
      },
      {
        id: 'eni-a5-03',
        playerLine: 'Item 14. The pension claim.',
        reply:
          'Two thousand one hundred and forty pounds four shillings. Reckonable service from 1959. I processed it in March, I queried the start date, and I was told to leave it. It’s in the file.',
        availableIf: { kind: 'hasClue', clue: 'clue-liabilities-item14' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'charnock-confirmed-item14', value: true }],
      },
      {
        id: 'eni-a5-04',
        playerLine: 'Thank you, Mrs Charnock.',
        reply: [
          'Don’t.',
          'I raised it once. In twenty-four years I could have raised it any Tuesday I liked. I raised it once, and I have been making that sound like courage for a very long time.',
        ],
        once: true,
      },
    ],
  },
];
