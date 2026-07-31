import type { DialogueTree } from '@/engine/types';

/**
 * DS Marren Iveson — Rossport. Two officers, one car, four hundred square
 * miles.
 *
 * Procedural, economical, dry to the point of a comedy she does not intend.
 * Writes while you are still talking. Reads documents aloud slowly while she
 * thinks — the reading-aloud is the beat. Signature line: "That's an
 * inference. Bring me an object." She never says anything she could not
 * repeat in a witness box, and she treats Wren as a child until she is handed
 * a properly cited schedule of exhibits, after which she never mentions it.
 */
export const ivesonTrees: DialogueTree[] = [
  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'marren-iveson',
    act: 3,
    greeting: [
      'DS Iveson. Rossport. I arrested Marguerite Tain at seventeen fifteen and I’ve read your report twice.',
      'Sit down. Don’t stand in the doorway, it’s the only warm bit.',
    ],
    exhausted: 'Anything else, or is that the inferences finished? Good. Bring me an object and I’ll find you a chair that doesn’t wobble.',
    farewell: 'Out through the front, and sign the book on the way. Everyone signs the book. It’s the only thing this station does properly.',
    nodes: [
      {
        id: 'ive-a3-01',
        playerLine: 'The forgery doesn’t mean the light was burning.',
        reply:
          'No. It means the only document that said otherwise is a fake. That’s not the same thing, and I know it isn’t, and a file is not made out of things I know.',
        availableIf: { kind: 'hasClue', clue: 'clue-deakin-letter' },
        once: true,
      },
      {
        id: 'ive-a3-02',
        playerLine: 'Your request slip is stapled inside the coroner’s file. Second of October.',
        reply: 'That file’s closed and I’ve never laid eyes on it. Coroner’s officer does three days a week and I do the other four somewhere else.',
        availableIf: { kind: 'hasClue', clue: 'clue-iveson-request-slip' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'ive-a3-02-slip',
            playerLine: 'It’s your collar number. It’s your handwriting. It’s a Friday.',
            reply: [
              'Right. Yes. I pulled it on my own time.',
              'Eleven minutes between the fall and the call. I was told there was nothing in it.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'iveson-admitted-request-slip', value: true },
              { kind: 'addCounter', counter: 'trust-iveson', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'ive-a3-03',
        playerLine: 'Then help me.',
        reply: [
          'I can’t. You’ve a revoked commission and a theory.',
          'Bring me an object. Something with a date on it that a stranger made for their own reasons. Then I’ll spend my weekend on it.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'iveson-wants-objects', value: true }],
      },
      {
        id: 'ive-a3-04',
        playerLine: 'A man died on that gallery.',
        reply: [
          'A seventy-nine-year-old man fell twenty-two feet off a rail. Inquest said accident and the pathologist won’t shift on mechanism.',
          'The eleven minutes bother me. They’ve bothered me since October.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-accident-report' },
        once: true,
      },
      {
        id: 'ive-a3-05',
        playerLine: 'Will you let Rita out?',
        reply: [
          'Bail on the second, if she keeps her mouth shut, which she won’t.',
          'She typed a forgery, Miss Adare. Being right about everything underneath it isn’t a defence. It’s just very sad.',
        ],
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'marren-iveson',
    act: 4,
    greeting: 'Half six in the morning and you’re in my office with wet hair and a box file. Go on, then. Slowly, and in order.',
    exhausted: 'Is that the bundle? Then I’ll type it up and you’ll go and get warm. Both of those are instructions.',
    farewell: 'Go. And Adare — foliate it before you hand it to anybody else. It reads like evidence when it’s foliated.',
    nodes: [
      {
        id: 'ive-a4-01',
        playerLine: 'Pike was on the eight fifteen ferry.',
        reply: [
          'Booking book, garage fuel book, two independent tills nine miles apart. That’s an object.',
          'That’s your obvious man gone. So who worked his counter?',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-ferry-booking-book' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'iveson-objects', by: 1 }],
      },
      {
        id: 'ive-a4-02',
        playerLine: 'R98/2211. Nine ten. Issued by S.F-K.',
        reply: [
          '“Series 14/B, box 17, one item.” Her initials.',
          'That puts her at the counter. It does not put her on the gallery. What puts her on the gallery?',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-slip-r982211' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'iveson-objects', by: 1 }],
      },
      {
        id: 'ive-a4-03',
        playerLine: 'Chalk-wax and salt bloom. North bay only. The same in the ribbon well of her typewriter.',
        reply: [
          'Now that I can put in front of a magistrate.',
          'You took that sample in October, jarred it and labelled it. Nobody taught you to do that for a police matter. You did it because it’s Tuesday.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-dust-jar-6' },
        once: true,
        effects: [
          { kind: 'addCounter', counter: 'iveson-objects', by: 1 },
          { kind: 'addCounter', counter: 'trust-iveson', by: 1 },
        ],
      },
      {
        id: 'ive-a4-04',
        playerLine: 'Eleven windings of the time-switch. Two hundred and twenty minutes.',
        reply:
          'For an eighty-eight-minute visit, and the last one at seventeen forty. Somebody spent an afternoon in that bay with the lights on, doing something they needed to see. Write it exactly like that.',
        availableIf: { kind: 'hasClue', clue: 'clue-gallery-timeswitch' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'iveson-objects', by: 1 }],
      },
      {
        id: 'ive-a4-05',
        playerLine: 'The cottage at Cardew went up at twenty to eleven last night.',
        reply: [
          'Paraffin heater, sixty-six-year-old man asleep in a chair. Fire officer says accidental and I’d want a great deal before I said otherwise.',
          'You went back in twice. Don’t do that again.',
        ],
        once: true,
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'marren-iveson',
    act: 5,
    greeting: 'Adare. Iveson. You’re breaking up — say again. She told you what?',
    exhausted: 'Then that’s the call. I’ve four hundred square miles and you’ve a Board at eleven. Go and be early.',
    farewell: 'Interview room 2, tomorrow, ten o’clock, and bring the bundle. Eat something on the ferry.',
    nodes: [
      {
        id: 'ive-a5-01',
        playerLine: 'She confessed. All of it. Four hours, with dates.',
        reply: [
          'Unrecorded. Uncautioned. Uncorroborated. To one nineteen-year-old on a rock in a gale.',
          'It is worth precisely nothing. Stop crying about it and go and do your job.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'iveson-set-the-rule', value: true }],
      },
      {
        id: 'ive-a5-02',
        playerLine: 'So nothing I heard can be used.',
        reply: [
          'Nothing. Not a syllable. It gets cited or it doesn’t exist.',
          'That’s not me being hard on you. It’s the only reason anybody will believe you instead of her.',
        ],
        once: true,
      },
      {
        id: 'ive-a5-03',
        playerLine: 'I want to make a referral on Cormac Sallow.',
        reply:
          'Then word it yourself and word it small. I can’t charge a feeling. You’ve a grab, a defective rail, eleven minutes and a photocopier. Write what the paper says and it will stand up.',
        availableIf: { kind: 'hasClue', clue: 'clue-site-diary-rail' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'iveson-referral-invited', value: true }],
      },
      {
        id: 'ive-a5-04',
        playerLine: 'Can I write murder?',
        reply: [
          'You can write it. Defence will have it in pieces by lunchtime and everything behind it goes with it.',
          'Unlawful killing. Consciousness of guilt after the fact. That’s the one that puts people in prison.',
        ],
        availableIf: { kind: 'flag', flag: 'iveson-referral-invited' },
        once: true,
      },
      {
        id: 'ive-a5-05',
        playerLine: 'Will any of it stick?',
        reply: [
          'The 1998 count, probably. The 1974 offences, certainly.',
          'And I’ll say the thing nobody says out loud: you did this with a loupe and a stub book. I’ve four hundred square miles. Come and work for me.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'iveson-job-offer', value: true }],
      },
    ],
  },
];
