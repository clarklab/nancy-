import type { DialogueTree } from '@/engine/types';

/**
 * Sabine Ferrier-Kyne — Warden of the Brannock Pilotage Authority.
 *
 * Voice rule, and it is the whole game: PASSIVE for anything she did — "the
 * report was typed", "the requisition was refused" — ACTIVE for everybody else
 * — "Mr Pike removed the boxes". Never "I think"; always "the position is".
 * Dates arrive without hesitation. She refuses nothing and concedes nothing.
 * She calls Wren "Miss Adare" for four days and "Wren" exactly once, on the
 * rock, in the Act V greeting, and never again.
 */
export const sabineTrees: DialogueTree[] = [
  // -------------------------------------------------------------- Act I ----
  {
    characterId: 'sabine-ferrier-kyne',
    act: 1,
    greeting:
      'Miss Adare. Nine days. You will want the strongroom key, a desk with north light, and somebody to stop apologising to you. I can manage two of the three.',
    exhausted:
      'You have run out of questions. I have not run out of answers. In my experience that means the questions were the wrong ones, and I would rather you found the right ones than that I gave them to you.',
    farewell:
      'The desk under the north window has been cleared for you. It was cleared on Tuesday, before you asked.',
    nodes: [
      {
        id: 'sab-a1-01',
        playerLine: 'I’ll need access to every series before I can certify anything.',
        reply:
          'You will have it. The keys are on the board by the wicket, all of them, including mine. The position is that a locked door has never once improved a record.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-offered-every-key', value: true }],
      },
      {
        id: 'sab-a1-02',
        playerLine: 'Could I see something from 1974, so I know your house style?',
        reply: [
          'Better than that. Nine documents from that August — signed, dated, docketed, and a carbon of each.',
          'Read them properly, Miss Adare, before you start dating things at me.',
        ],
        once: true,
        effects: [{ kind: 'giveClue', clue: 'clue-pp-specimen-bundle' }],
      },
      {
        id: 'sab-a1-03',
        playerLine: 'Mrs Verge showed me the countersignature box on the slips.',
        reply:
          'Per procurationem. On behalf of. It has been in Standing Order 4 since the Charter and nobody has ever found it interesting. Mrs Verge is a better teacher than I am.',
        availableIf: { kind: 'hasClue', clue: 'clue-pp-taught' },
        once: true,
      },
      {
        id: 'sab-a1-04',
        playerLine: 'You signed the accident report on Mr Sallow yourself.',
        reply:
          'The report was typed at ten to five and signed, yes. Somebody had to. Mrs Verge was in no state for it and Mr Pike was on the mainland that day.',
        availableIf: { kind: 'hasClue', clue: 'clue-accident-report' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'sabine-pressure', by: 1 }],
      },
      {
        id: 'sab-a1-05',
        playerLine: 'Where were you on the morning of the fourteenth of September?',
        reply:
          'In the Board Room the whole of that morning, with the quantity surveyor. I did not know Mr Sallow was in the building until Mrs Verge came running along the corridor.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-alibi-board-room', value: true }],
      },
      {
        id: 'sab-a1-06',
        playerLine: 'What happens if I can’t certify by the third of November?',
        reply:
          'The series are deemed valueless and the contractors’ skips are booked for the fourth. I have written to the Ministry twice about it. Both letters were acknowledged. Neither was answered.',
        once: true,
      },
      {
        id: 'sab-a1-07',
        playerLine: 'Why would a man who worked here twenty-six years write to strangers?',
        reply:
          'Because Mr Sallow was an institutional man, and an institutional man does not go to a newspaper; he goes to a body with a certificate. The request was granted inside a fortnight. It is why you are standing in my hall.',
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'sabine-ferrier-kyne',
    act: 2,
    greeting:
      'You slept in the Binding Room. There is a kettle in the Rolls Room and Mrs Verge will pretend it is hers. Ask her anyway; she likes being asked.',
    exhausted:
      'Nothing further? Then I shall square these and you will go and count something. Both of us will be more useful for it.',
    farewell:
      'The sump is being seen to. That is not an answer to anything you asked, but it is being seen to.',
    nodes: [
      {
        id: 'sab-a2-01',
        playerLine: 'Forty-seven cards in drawers 214 to 216 have been retyped.',
        reply:
          'Then they were retyped. Cards are retyped constantly, Miss Adare; that is what an index is for. Bring me a stock date and a machine and I will take it seriously.',
        availableIf: { kind: 'hasClue', clue: 'clue-index-gap' },
        once: true,
      },
      {
        id: 'sab-a2-02',
        playerLine: 'Your own reboxing schedule lists twenty-three items in box 17. There are seventeen.',
        reply:
          'Series 14/B was reboxed in 1989 for mould. The memorandum is signed in my own name and nothing was withdrawn. The schedule is the schedule.',
        availableIf: { kind: 'hasClue', clue: 'clue-w-o-89-2' },
        once: true,
        isConfrontation: true,
        effects: [{ kind: 'addCounter', counter: 'sabine-pressure', by: 1 }],
        children: [
          {
            id: 'sab-a2-02-count',
            playerLine: 'Then count them with me. Twenty-three listed. Seventeen on the shelf.',
            reply: [
              'Six items on my own schedule are not on the shelf. I signed that schedule.',
              'I am not going to stand here and tell you the arithmetic is wrong.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'sabine-conceded-six-missing', value: true },
              { kind: 'addCounter', counter: 'sabine-pressure', by: 1 },
            ],
            children: [
              {
                id: 'sab-a2-02-who',
                playerLine: 'Who had box 17 open in 1989?',
                reply:
                  'Mrs Verge worked the index. Mr Pike worked the shelves. The schedule was typed upstairs. You will notice that only one of those three sentences is in the passive, and you will make of it what you like.',
                once: true,
              },
            ],
          },
        ],
      },
      {
        id: 'sab-a2-03',
        playerLine: 'Somebody burned a 1974 notice in your courtyard at twenty past one this morning.',
        reply:
          'The incinerator takes lunch wrappings and confidential waste, and both are permitted. Who was holding the match is a question I cannot answer, and I dislike that considerably more than you do.',
        availableIf: { kind: 'hasClue', clue: 'clue-scorched-carbon' },
        once: true,
      },
      {
        id: 'sab-a2-04',
        playerLine: 'I need the strongroom opened.',
        reply:
          'Three winding movements, no keyhole, and the settings are this building’s own closing hours. The Order Book is in the Registry. I could simply tell you the numbers. You would learn nothing.',
        once: true,
      },
      {
        id: 'sab-a2-05',
        playerLine: 'I was shut in that strongroom all night, in four inches of water.',
        reply:
          'The door was shut at eighteen twenty and the movements will not be argued with. Here is tea, and a written apology for the state of the sump. Mr Sandbach will be told this morning.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-apologised-strongroom', value: true }],
      },
      {
        id: 'sab-a2-06',
        playerLine: 'There’s a deed box on the bottom shelf with your father’s name stencilled on it.',
        reply:
          'Stencilled in 1961 and empty since about 1976. If paper was found in it, it is paper I have never seen. I should like a copy. Formally, in writing, through the Registry.',
        availableIf: { kind: 'hasClue', clue: 'clue-deed-box-flimsy' },
        once: true,
      },
      {
        id: 'sab-a2-07',
        playerLine: 'Did you hear two women arguing on the landing last night?',
        reply:
          'The Wardens’ Hall landing carries sound into the ventilation trunk. It always has. I heard nothing, and I am told the caretaker heard nothing, and neither of those is worth anything to you.',
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'sabine-ferrier-kyne',
    act: 3,
    greeting:
      'Miss Adare. There is a fax on my desk I did not ask for and do not welcome. You will find the building unchanged. You will find me unchanged.',
    exhausted:
      'You are standing in my office with no warrant and no questions. One of those I can remedy. Come back when you have the other.',
    farewell:
      'Take a torch that hoods. The undercroft has no light in it and has not since 1975.',
    nodes: [
      {
        id: 'sab-a3-01',
        playerLine: 'The Deakin letter is a forgery. I have to report it.',
        reply:
          'Then you will report it. You will not enjoy it and you will do it anyway. And it will not stop the telephone call I make at four o’clock. Both of those are duties.',
        availableIf: { kind: 'hasClue', clue: 'clue-deakin-letter' },
        once: true,
      },
      {
        id: 'sab-a3-02',
        playerLine: 'Works Order 75/188 bricked up a room with a tide gauge in it.',
        reply:
          'June 1975. Damp in the north undercroft. My father initialled it, or it was initialled for him — he was in and out of hospital that whole year. The order stands as written.',
        availableIf: { kind: 'hasClue', clue: 'clue-works-order-75188' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'sabine-pressure', by: 1 }],
      },
      {
        id: 'sab-a3-03',
        playerLine: 'You reported Rita Tain to the police within the hour.',
        reply:
          'The forgery was reported at four o’clock, with a covering letter offering every assistance. Miss Tain has called me a murderer in pamphlets since 1976. I have never once refused her the boat contract.',
        once: true,
      },
      {
        id: 'sab-a3-04',
        playerLine: 'Number 33. “Miss S. Ferrier — the Warden’s private secretary — no official capacity — not called.”',
        reply: 'I typed for my father. That is the whole of it.',
        availableIf: { kind: 'hasClue', clue: 'clue-inquiry-rejects' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'sab-a3-04-age',
            playerLine: 'You were thirty-four. You had been running this Authority for three months.',
            reply:
              'No. I was thirty-four in that autumn, and I was not called, and I have never once said in my life that I should have been.',
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'sabine-not-called-admitted', value: true },
              { kind: 'addCounter', counter: 'sabine-pressure', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'sab-a3-05',
        playerLine: 'Am I still allowed in this building?',
        reply:
          'Your warrant is revoked. Your invitation is not. Sleep in the Binding Room, eat in the kitchen, and take nothing off a shelf without asking Mr Pike. He will enjoy refusing you.',
        once: true,
      },
      {
        id: 'sab-a3-06',
        playerLine: 'There’s a chamber under the north undercroft that appears on no plan after 1975.',
        reply: [
          'Then it appears on the 1948 sheet, and you have registered three surveys on their triangulation marks. That is very good work and I am not going to pretend otherwise.',
          'Take a crowbar. Take a coat.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-chart-overlays' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-permits-undercroft', value: true }],
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'sabine-ferrier-kyne',
    act: 4,
    greeting:
      'Miss Adare. You have stopped saying good morning to me. I notice such things, and I do not blame you for it, and I would rather you did not start again out of manners.',
    exhausted:
      'You are holding it all in your hands and you are asking me about the weather. Ask me the one you came up the stairs with.',
    farewell:
      'The lamp on the stair has been left on for you. It will be left on tomorrow as well.',
    nodes: [
      {
        id: 'sab-a4-01',
        playerLine: 'Every document between the eleventh of August and the third of November 1974 is p.p.',
        reply: [
          'Forty-one of them. You counted correctly.',
          'The signature is not forged, Miss Adare — it is lawful, and it was lawful at the time, and that is the part nobody has ever been able to hear.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-pp-sort' },
        once: true,
        effects: [
          { kind: 'setFlag', flag: 'sabine-pp-acknowledged', value: true },
          { kind: 'addCounter', counter: 'sabine-pressure', by: 1 },
        ],
      },
      {
        id: 'sab-a4-02',
        playerLine: 'The Order Book leaves were razored out. The offsets are still on the facing pages.',
        reply:
          'Then the book has outlasted the razor, which is what books do. It was done in the same week as the reboxing, by somebody with a steady hand and a reason. You have not asked me whose hand.',
        availableIf: { kind: 'hasClue', clue: 'clue-order-book-offsets' },
        once: true,
      },
      {
        id: 'sab-a4-03',
        playerLine: '“I know what you mean to send. Please do not send it. S.” Twelfth of September.',
        reply: 'I had no idea what Mr Sallow intended to send.',
        availableIf: { kind: 'hasClue', clue: 'clue-ribbon-spool' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'sab-a4-03-spool',
            playerLine: 'Rule 4. Mrs Charnock keeps every used spool, docketed. This one is September’s.',
            reply: [
              'Rule 4. Mrs Charnock’s rule. Thirty years of it and I never once thought of the spool.',
              'Yes. It was typed. It was not posted.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'sabine-admitted-note', value: true },
              { kind: 'addCounter', counter: 'sabine-pressure', by: 2 },
            ],
            children: [
              {
                id: 'sab-a4-03-why',
                playerLine: 'Why not post it?',
                reply:
                  'Because a letter can be produced and a conversation cannot. It was typed at half past eight and it was still in the machine at nine. That is all the courage there was in me that week.',
                once: true,
              },
            ],
          },
        ],
      },
      {
        id: 'sab-a4-04',
        playerLine: 'R98/2211. Nine ten. Box 17. Issued by S.F-K.',
        reply:
          'Mr Pike was on the eight fifteen. Somebody had to work the counter. You will want the ferry booking book as well — get it yourself, it is not mine to hand you.',
        availableIf: { kind: 'hasClue', clue: 'clue-slip-r982211' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'sabine-pressure', by: 1 }],
      },
      {
        id: 'sab-a4-05',
        playerLine: 'Four of my requisitions came back wrong. All four carry your countersignature.',
        reply: 'Standing Order 7. Every reader’s slip passes the Warden’s pigeonhole. Mine is not the only hand in that pigeonhole.',
        availableIf: { kind: 'hasClue', clue: 'clue-substituted-slips' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'sab-a4-05-stubs',
            playerLine: 'I kept my own stubs. Nine days of them, in my own hand.',
            reply:
              'You have kept your own stubs in your own hand for nine days, out of habit. I did wonder whether you would. That is the answer to your question and I shall not dress it any better.',
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'sabine-admitted-slips', value: true },
              { kind: 'addCounter', counter: 'sabine-pressure', by: 2 },
            ],
          },
        ],
      },
      {
        id: 'sab-a4-06',
        playerLine: 'Your Board working file has twenty-six Reprax copies of box 17 in it.',
        reply: [
          'Correctly foliated, correctly indexed, and docketed the way I was taught in 1958.',
          'Four of them are copies of documents that are not on the shelf. I could not make myself destroy them. Consider what that means.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-board-working-file' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-working-file-owned', value: true }],
      },
      {
        id: 'sab-a4-07',
        playerLine: 'Ask you what?',
        reply:
          'Anything. You have all of it now, or near enough. Ask me and I will tell you the truth, and in the morning you will have to decide what to do with it. That is the harder half.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-invites-the-rock', value: true }],
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'sabine-ferrier-kyne',
    act: 5,
    greeting:
      'Wren. — There. I have used it once and I shall not use it again. Sit nearer the stove. This room takes an hour to warm and we have eleven.',
    exhausted:
      'You have stopped writing. Start again, please. I have not finished and neither, I think, have you.',
    farewell:
      'The tide turns at seven and Miss Tain is a better seaman than she is a witness. Go down carefully. The iron on that ladder is 1873 and it lies about how much of itself is left.',
    nodes: [
      {
        id: 'sab-a5-01',
        playerLine: 'Why didn’t you post it?',
        reply: [
          'Because there was no oil until the winter refit, and a notice saying the light cannot be relied upon is a notice saying the Authority is finished.',
          'I intended to put it right in December.',
        ],
        once: true,
        effects: [
          { kind: 'setFlag', flag: 'sabine-confessed', value: true },
          { kind: 'addCounter', counter: 'sabine-pressure', by: 1 },
        ],
      },
      {
        id: 'sab-a5-02',
        playerLine: 'You let a dead man take the blame for thirty-one people.',
        reply: [
          'I let a Charter take it. Article 9: a man of full age.',
          'Officially I was not there, so I could not be called, questioned, or listed. The contempt that erased me is the thing that acquitted me.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-charter-art9' },
        once: true,
        isConfrontation: true,
      },
      {
        id: 'sab-a5-03',
        playerLine: 'Thirty-one standing orders. Every month since April 1977.',
        reply:
          'Thirty-one, index-linked, because inflation was the one thing I could not sign away. You will want to know whether it helped. It did not. It was simply the only thing available to me.',
        availableIf: { kind: 'hasClue', clue: 'clue-kestrel-mandate' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-bequest-admitted', value: true }],
      },
      {
        id: 'sab-a5-04',
        playerLine: 'You had the rail repaired the next morning. Off programme. Not billed.',
        reply: 'The rail was made good because a rail was dangerous. A man had died on it the day before.',
        availableIf: { kind: 'hasClue', clue: 'clue-site-diary-rail' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'sab-a5-04-baluster',
            playerLine: 'Baluster 3 was recorded loose on the second of September. He fell on the fourteenth.',
            reply: [
              'I knew baluster 3 was loose from the second of September.',
              'And I stood in front of it with him for forty minutes. Write that down. Write it in the citation column, not the other one.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'sabine-admitted-rail-knowledge', value: true },
              { kind: 'addCounter', counter: 'sabine-pressure', by: 3 },
            ],
          },
        ],
      },
      {
        id: 'sab-a5-05',
        playerLine: 'Did you push him?',
        reply:
          'No. You have no evidence that I did and a good deal that I did not, and you will not believe me, and you will still have to word the referral honestly. I would, in your place.',
        once: true,
        isConfrontation: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-denies-push', value: true }],
      },
      {
        id: 'sab-a5-06',
        playerLine: 'The Board will ask on what evidence we name you.',
        reply:
          'They will. Nothing in 187 years of this Authority names me. Except one thing, Miss Adare, which I filed myself in March, and I have been waiting four days to see whether you kept it.',
        availableIf: { kind: 'hasClue', clue: 'clue-liabilities-item14' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'sabine-points-at-item14', value: true }],
      },
      {
        id: 'sab-a5-07',
        playerLine: 'Say you’re sorry. Out loud. Once.',
        reply: [
          'You will want that. I have been sorry every day since the fourth of November 1974 and it has never once been of the slightest use to anybody, so I stopped offering it.',
          'I paid instead. You will find that is worse.',
        ],
        once: true,
      },
    ],
  },
];
