import type { DialogueTree } from '@/engine/types';

/**
 * Cormac Sallow — Lamp Superintendent 1958–1984. Dead before page one.
 *
 * This is not a conversation. It is the interrogation of a paper trail, and
 * the "reply" is the game's reading voice quoting him and then stopping.
 * Sallow's own words are short, unadjectived and numeric — a lamp report has
 * no opinions in it. The reading voice may say what the page says and what the
 * page does not say. It must never say what he felt. If a line ever gives him
 * an emotion, the line is wrong.
 *
 * He answers only in documents the player is physically holding; every node is
 * gated on the paper, and the trees are keyed to where that paper is found.
 */
export const sallowTrees: DialogueTree[] = [
  // -------------------------------------------------------------- Act I ----
  {
    characterId: 'cormac-sallow',
    act: 1,
    greeting: [
      '[The coroner’s file. Green tape, a police photograph face down, and nine typed lines at the front.]',
      '[He answers only in what he wrote.]',
    ],
    exhausted: '[Nothing else in the file is in his hand. The rest is other people writing about him.]',
    farewell: '[Green tape. Bow to the left. The out column is still blank.]',
    nodes: [
      {
        id: 'sal-a1-01',
        playerLine: 'Why did you write to a stranger?',
        reply: [
          'Letter, 11 September 1998: “I would be obliged if series 14/B were read by a stranger before it leaves this building.”',
          'Nine lines. No explanation follows. No reason is given anywhere on the sheet.',
        ],
        availableIf: { kind: 'hasItem', item: 'sallow-letter' },
        once: true,
      },
      {
        id: 'sal-a1-02',
        playerLine: 'What did you do here?',
        reply: [
          'Lamp Superintendent, 1958 to 1984. Fortnightly visits. “No. 1 vaporiser good. No. 2 fair. Reserve oil 340 gallons.”',
          'Thirty years of reports and not one adjective in any of them.',
        ],
        once: true,
      },
      {
        id: 'sal-a1-03',
        playerLine: 'You signed in at eight fifty-six.',
        reply: [
          '“C. SALLOW. 08:56. Business: reader.” The out column is blank. The admitting initials are S.F-K.',
          'The next entry in the book is timed 09:22 and belongs to a scaffolder.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-visitors-book' },
        once: true,
      },
      {
        id: 'sal-a1-04',
        playerLine: 'How does the Authority describe your death?',
        reply: [
          '“At approximately 10:24 Mr C. Sallow, a visitor, fell from the Muniment gallery. Death appeared instantaneous. The gallery rail was inspected and found sound.”',
          'Typed 16:50. One page. Docketed upside down to the tag.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-accident-report' },
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'cormac-sallow',
    act: 2,
    greeting: [
      '[The bound inquiry transcripts, Rossport 1975, Day 9.]',
      '[Balgowan down the left of the page. Sallow down the right.]',
    ],
    exhausted: '[Nineteen days of evidence. He is on four pages of it. There is nothing further in his voice.]',
    farewell: '[The volume closes on a marker. Day 9, folio 211, and the question nobody asked him.]',
    nodes: [
      {
        id: 'sal-a2-01',
        playerLine: 'Was the light exhibited on the night of the third of November?',
        reply: '“The light was not discontinued.”',
        availableIf: { kind: 'hasClue', clue: 'clue-sallow-1975-transcript' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'sal-a2-01-again',
            playerLine: 'Read it again.',
            reply: [
              'He was asked an operational question and gave an administrative answer. Both sentences are true and they are not the same sentence.',
              'A light may be undiscontinued and unlit. It is the sentence the whole finding rests on.',
            ],
            once: true,
            effects: [{ kind: 'setFlag', flag: 'sallow-answer-parsed', value: true }],
          },
        ],
      },
      {
        id: 'sal-a2-02',
        playerLine: 'Where were you in August 1974?',
        reply: [
          'Not in the transcript. Nobody asked. Ilberry Cottage Hospital, 20 August to 10 October — hernia.',
          'Seven weeks with no lamp officer on the coast, and no question about it on any of nineteen days of evidence.',
        ],
        once: true,
      },
      {
        id: 'sal-a2-03',
        playerLine: 'You folded your spectacles.',
        reply:
          'A man reading does not fold his spectacles. He sets them on the slope and stands up, because somebody has come into the bay behind the map presses and he intends to speak to them.',
        availableIf: { kind: 'hasClue', clue: 'clue-spectacles' },
        once: true,
      },
      {
        id: 'sal-a2-04',
        playerLine: 'Did anyone warn you off?',
        reply: [
          'Nothing in his hand says so.',
          'His last written word to anybody outside this building is nine lines long and asks for a reader. There is no draft, no carbon and no second letter.',
        ],
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'cormac-sallow',
    act: 3,
    greeting: [
      '[Pike’s kitchen table, Cardew. A bare bulb, rain on the window.]',
      '[Thirty years of lamp reports, taken out of the building in 1985 and never once opened.]',
    ],
    exhausted: '[The rest of the box is oil returns and vaporiser serials. He is finished answering for tonight.]',
    farewell: '[The lid goes back on. LIGHTS: STORES 1966–80, in a clerk’s capitals, in 1985 ink.]',
    nodes: [
      {
        id: 'sal-a3-01',
        playerLine: 'The report of the fifteenth of August 1974.',
        reply: [
          '“No. 2 vaporiser cracked. Reserve oil 90 gallons. Light cannot be maintained beyond the end of the month.” Signed C. SALLOW.',
          'Notice 74/119 was drafted the same day, on the same floor.',
        ],
        once: true,
        effects: [{ kind: 'giveClue', clue: 'clue-lamp-report-15aug' }],
      },
      {
        id: 'sal-a3-02',
        playerLine: 'You swore you knew of no refused requisition.',
        reply: '“I have no knowledge of any requisition for oil being refused.” Day 9, under oath, in answer to counsel for the Authority.',
        availableIf: { kind: 'hasClue', clue: 'clue-oil-requisition-book' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'sal-a3-02-r741',
            playerLine: 'R.741. Thirteenth of August. Those are his initials on the front.',
            reply: [
              'He raised it himself. He was under anaesthetic in Ilberry when it came back stamped.',
              'Nothing in the file was ever sent on to him. The answer he gave was true and he did not know what it cost.',
            ],
            once: true,
            effects: [{ kind: 'setFlag', flag: 'sallow-oath-explained', value: true }],
          },
        ],
      },
      {
        id: 'sal-a3-03',
        playerLine: 'R.755. Your own file copy.',
        reply: [
          'Seventh of October 1974. REQUISITION NOT SANCTIONED — REFER WINTER REFIT. Initialled p.p.',
          'Found in a drawer at 3 Coastguard Row by a man of seventy-nine, alone, at a kitchen table.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sallow-r755' },
        once: true,
      },
      {
        id: 'sal-a3-04',
        playerLine: 'He helped hang a dead man.',
        reply: [
          'On Day 9, under oath, for his employer, in good faith. He learned it twenty-three years later.',
          'He did not go to the police or the newspapers. He asked for a reader.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sallow-1975-transcript' },
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'cormac-sallow',
    act: 4,
    greeting: [
      '[The oil store, Nine Bells Beacon. Cold paraffin that has not moved in twenty-four years.]',
      '[The keeper’s log still in its rack.]',
    ],
    exhausted: '[Nothing further is written in this tower by anybody. The rack holds one book and the book is finished.]',
    farewell: '[The log goes into the dry bag. Twenty-fourth of August 1974, and then ruled feint paper for eighty pages.]',
    nodes: [
      {
        id: 'sal-a4-01',
        playerLine: 'The last entry.',
        reply: [
          '“22.10. No. 2 vapor. cracked. Oil out. Light down. Nothing more to be done here.” Twenty-fourth of August 1974.',
          'The handwriting does not deteriorate. It is a log, not a letter.',
        ],
        once: true,
        effects: [{ kind: 'giveClue', clue: 'clue-keepers-log' }],
      },
      {
        id: 'sal-a4-02',
        playerLine: 'Turn it over.',
        reply: [
          'On the reverse of the last page, in pencil: tea, boot polish, a birthday card for Nan.',
          'Nobody in this case ever establishes who Nan was. There is no further entry of any kind.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-keepers-log' },
        once: true,
      },
      {
        id: 'sal-a4-03',
        playerLine: 'She wrote to him two days before.',
        reply: [
          '“I know what you mean to send. Please do not send it. There is nothing in it that can help anybody now. S.”',
          'Typed on the twelfth. Never posted. He never read one word of it.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-ribbon-spool' },
        once: true,
      },
      {
        id: 'sal-a4-04',
        playerLine: 'He asked for box 17.',
        reply: [
          'R98/2211. 09:10. Series 14/B box 17, one item.',
          'In the “issued by” column, initials that are not the Chief Clerk’s, on a morning the Chief Clerk was nine miles away on a ferry.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-slip-r982211' },
        once: true,
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'cormac-sallow',
    act: 5,
    greeting: [
      '[The case file, foliated and tied. His letter is bound at the front, before exhibit 1.]',
      '[The whole of this is one requisition slip being filled forty-three days late.]',
    ],
    exhausted: '[Folios 1 to 212. Every one of them cited. He has no more to say and never had much.]',
    farewell: '[Tape. Bow to the left, the way the Registry ties them. Ready for the room.]',
    nodes: [
      {
        id: 'sal-a5-01',
        playerLine: 'Exhibit 4.',
        reply: [
          'Sallow’s file copy of R.755. Refused. Initialled p.p.',
          'The object that made a man of seventy-nine write nine lines to people he had never met, and say nothing whatever to anybody he knew.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sallow-r755' },
        once: true,
      },
      {
        id: 'sal-a5-02',
        playerLine: 'Read the letter to the Board.',
        reply: [
          '“I would be obliged if series 14/B were read by a stranger before it leaves this building.”',
          'That is the whole of it. No explanation, no accusation, no name. He left the rest to the reader.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sallow-letter-read-to-board', value: true }],
      },
      {
        id: 'sal-a5-03',
        playerLine: 'He was called. Others were not.',
        reply: [
          'Day 9, under oath, doing his duty.',
          'Two people who could have contradicted him stayed at home because a list said “not called”. One of them typed the list. The other is No. 33.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-inquiry-rejects' },
        once: true,
      },
      {
        id: 'sal-a5-04',
        playerLine: 'Notice 74/119. Schedule D. Addressee number one.',
        reply: [
          '“The Keeper, Nine Bells Beacon.” Statutory precedence: the light is told about itself first.',
          'Posted 3 November 1998, franked with one fourpenny impression, thirty-one names appended against house style.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-schedule-d' },
        once: true,
      },
    ],
  },
];
