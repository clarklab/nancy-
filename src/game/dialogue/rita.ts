import type { DialogueTree } from '@/engine/types';

/**
 * Marguerite "Rita" Tain — boatwoman, lamp-room curator, and the most honest
 * red herring in the game.
 *
 * Fast, clipped, half-finished sentences she assumes you can complete. Recites
 * the 1975 findings by paragraph number the way other people recite prayers.
 * Cannot accept help without insulting whoever offers it. Goes completely
 * silent when she is frightened or moved — and the silence is the performance.
 */
export const ritaTrees: DialogueTree[] = [
  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'rita-tain',
    act: 2,
    greeting: [
      'You’re the paper girl. Boots.',
      'No. Not those boots. The ones you’ve got on will have you over the side inside a mile.',
    ],
    exhausted: 'That it? Right. Then hold that and don’t drop it in the bilge.',
    farewell: 'Go on. And eat something before you come out on my boat again.',
    nodes: [
      {
        id: 'rit-a2-01',
        playerLine: 'Tell me about the Rossport Inquiry.',
        reply: [
          'Paragraph 214. “The pilot’s judgement was impaired.” A hip flask off a drowned man.',
          'Twenty-four years, that sentence. I can do the whole of section 9 if you want it, and I will.',
        ],
        once: true,
      },
      {
        id: 'rit-a2-02',
        playerLine: 'Your father.',
        reply:
          'Emrys Tain. Forty-eight. Twenty-two years on that Sound and he could steer it in his — don’t. Don’t do the face. Everybody does the face and then they go home.',
        once: true,
      },
      {
        id: 'rit-a2-03',
        playerLine: 'What’s in the lamp-room file?',
        reply:
          'This. Deakin, crewman, March seventy-five. The beacon was dark, we all knew, we were told to say nothing. There. That’s the whole thing. Now go and be useful with it.',
        once: true,
        effects: [
          { kind: 'giveItem', item: 'deakin-letter' },
          { kind: 'giveClue', clue: 'clue-deakin-letter' },
        ],
      },
      {
        id: 'rit-a2-04',
        playerLine: 'I’ll have to authenticate it before I can cite it.',
        reply:
          'Authenticate. Right. Right — twenty-four years and the Conservancy sends me a child with a loupe. Fine. Do your tests. Enjoy them. Take your time, nobody’s drowning.',
        availableIf: { kind: 'hasClue', clue: 'clue-deakin-letter' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-rita', by: -1 }],
      },
      {
        id: 'rit-a2-05',
        playerLine: 'Cormac Sallow.',
        reply: [
          'Tried to tell me something in August. On the slipway. I had the engine apart and I was shouting about paragraph 214 at him.',
          'I didn’t listen. That’s the whole of it.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-spectacles' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'rita-august-slipway', value: true }],
      },
      {
        id: 'rit-a2-06',
        playerLine: 'Do you go out to the rock much?',
        reply: [
          'Not in the off season. Nobody does. Landing’s a joke past September and there’s nothing out there but a dead lamp and gulls.',
          'Why. What’s that face for.',
        ],
        once: true,
      },
      {
        id: 'rit-a2-07',
        playerLine: 'The gallery door was standing open.',
        reply: [
          'Four hundred yards and you saw it through the glasses while you were being sick. Good eyes.',
          'It shouldn’t be open. It hasn’t been open since I don’t know when. Sit down.',
        ],
        once: true,
        effects: [
          { kind: 'setFlag', flag: 'rita-gallery-door-noted', value: true },
          { kind: 'addCounter', counter: 'trust-rita', by: 1 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'rita-tain',
    act: 3,
    greeting: 'Say it. Go on. You’ve got the face on. Say it in words, in front of me, and don’t do it kindly.',
    exhausted: 'Nothing else? Then stand there. I’m not filling the quiet for you.',
    farewell: 'Shut the shed door. It swells if it’s left, and I’ve enough that’s ruined.',
    nodes: [
      {
        id: 'rit-a3-01',
        playerLine: 'Ardwell Bond. Not manufactured before June 1981.',
        reply: 'It came anonymous. Brown envelope, ninety-six, no note. I’ve said this a hundred times and it hasn’t changed.',
        availableIf: { kind: 'hasClue', clue: 'clue-deakin-letter' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'rit-a3-01-adler',
            playerLine: 'There’s an Adler portable in your locker. Black nylon ribbon. Nylon wasn’t sold for that machine until 1979.',
            reply: [
              'There’s an Adler in my locker. You’ll have found it.',
              'I typed it. It says the truth and I typed it.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'rita-admitted-forgery', value: true },
              { kind: 'addCounter', counter: 'trust-rita', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'rit-a3-02',
        playerLine: 'Cadran Point shows three flashes in fifteen seconds. The Nine Bells shows three in twenty.',
        reply: [
          'Fifteen. Not twenty.',
          'Twenty-four years and it was a stopwatch. A stopwatch, and nobody asked a frightened girl to count. Say the numbers again. Slower.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-light-characteristic' },
        once: true,
      },
      {
        id: 'rit-a3-03',
        playerLine: 'On 1974 buoyage your father is exactly where a competent pilot would steer.',
        reply: [
          'Say it slower.',
          'Tracing paper. Dividers. That’s it? I’ve spent eleven thousand pounds and the house on lawyers and it was tracing paper and a light table.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-chart-overlays' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-rita', by: 2 }],
      },
      {
        id: 'rit-a3-04',
        playerLine: 'Why forge it?',
        reply:
          'Because being right isn’t worth anything. Legal aid, four times. Four. I knew what happened and I couldn’t prove it, so I made a paper that said what I knew. Sick with it since ninety-six.',
        availableIf: { kind: 'flag', flag: 'rita-admitted-forgery' },
        once: true,
      },
      {
        id: 'rit-a3-05',
        playerLine: 'There are three boxes of Cormac’s effects in your shed.',
        reply: 'His things. I cleared them after the funeral and I never opened them. Not once. I couldn’t.',
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'rit-a3-05-third',
            playerLine: 'Open the third one.',
            reply: [
              'R.755. His own copy, in my shed, the whole time she was arresting me for the other one.',
              'In my shed.',
            ],
            once: true,
            effects: [
              { kind: 'giveItem', item: 'sallow-r755' },
              { kind: 'giveClue', clue: 'clue-sallow-r755' },
              { kind: 'setFlag', flag: 'rita-shed-opened', value: true },
            ],
          },
        ],
      },
      {
        id: 'rit-a3-06',
        playerLine: 'I have to file the adverse report by four o’clock.',
        reply: [
          'Then file it. — No, file it.',
          'You’re the only person in twenty-four years who’s told me a true thing I didn’t want. Don’t stand there wanting me to say it’s all right.',
        ],
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-rita', by: 1 }],
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'rita-tain',
    act: 4,
    greeting: [
      'I’m on bail. Can’t enter the building, can’t touch the archive, can’t do a single useful thing.',
      'So. Boat.',
    ],
    exhausted: 'Nothing? Good. Watch the water and keep your mouth shut, it helps with the sick.',
    farewell: 'Middle thwart. Both hands. Go.',
    nodes: [
      {
        id: 'rit-a4-01',
        playerLine: 'I need to get to the beacon.',
        reply: [
          'In this? Force eight and building, tide against the swell over the reef.',
          'Dawn. Two hours of water at the landing. You jump on the rise or you don’t jump at all.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'rita-agreed-crossing', value: true }],
      },
      {
        id: 'rit-a4-02',
        playerLine: 'You should hate me.',
        reply:
          'I do. Doesn’t come into it. Sit in the middle, hold the thwart, and don’t apologise when you’re sick. It’s the apologising I can’t stand, not the sick.',
        once: true,
      },
      {
        id: 'rit-a4-03',
        playerLine: 'Enid Charnock gave me this on the quay.',
        reply: [
          'Charnock? Enid Charnock handed you —',
          'Twenty-four years I’ve called that woman a liar to her face in a post office queue. Right. Well. I’ll write to her. I’ll write to her tonight.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-sundries-memo' },
        once: true,
        effects: [{ kind: 'addCounter', counter: 'trust-rita', by: 1 }],
      },
      {
        id: 'rit-a4-04',
        playerLine: 'Tea. Boot polish. A birthday card for Nan.',
        reply: [
          'That’s a man packing up for the week. That’s not a man who knew anything.',
          'Give it here. No. Dry bag. I’ll run it into Cardew myself and you’ll not argue.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-keepers-log' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'rita-carrying-the-log', value: true }],
      },
      {
        id: 'rit-a4-05',
        playerLine: 'You can’t get me off the rock, can you.',
        reply: [
          'No. Sea’s past it and it’ll be past it till morning.',
          'I take the log, you take her. There’s paraffin for the stove and don’t touch the lantern glass with bare hands.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'wren-marooned-on-rock', value: true }],
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'rita-tain',
    act: 5,
    greeting: 'Slipway. Half eleven. Don’t be late, and don’t say a word to me before it happens.',
    exhausted: '— Nothing. Don’t. We’ve four minutes and I want them quiet.',
    farewell: 'Go and stand where you can see it. Not next to me. Just where you can see it.',
    nodes: [
      {
        id: 'rit-a5-01',
        playerLine: 'The 1975 finding is quashed. Your father is named in the document.',
        reply: [
          'Named how. Say the words they’ll actually print.',
          'Say them again. — Again, and don’t look at me while you do it.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-chart-overlays' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'rita-told-of-quashing', value: true }],
      },
      {
        id: 'rit-a5-02',
        playerLine: 'You told me once you’d never had a penny off anybody.',
        reply: 'I haven’t. Thirty-four pound a month since seventy-seven, Dad’s union, it’s in the post office book.',
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'rit-a5-02-not-union',
            playerLine: 'The union wound up in 1979.',
            reply: 'Why are you looking like that. Is there something else. Straight out.',
            once: true,
            children: [
              {
                id: 'rit-a5-02-tell',
                playerLine: 'A standing order. Kestrel Bequest. Thirty-one of them, since April 1977.',
                reply: [
                  '— Thirty-one.',
                  'Right. So she paid me. Every month, for twenty-one years, she paid me, and I bought pamphlets with it and posted them to her.',
                  'Don’t. Don’t say anything kind. Watch the water.',
                ],
                availableIf: { kind: 'hasClue', clue: 'clue-kestrel-mandate' },
                once: true,
                effects: [{ kind: 'setFlag', flag: 'rita-told-about-bequest', value: true }],
              },
              {
                id: 'rit-a5-02-withhold',
                playerLine: 'No. Nothing else.',
                reply:
                  'Then stop pulling that face at me. — Half eleven, slipway. And Adare. Whatever it is you’ve just decided not to say, I hope it keeps you warm.',
                once: true,
                effects: [{ kind: 'setFlag', flag: 'rita-kept-from-bequest', value: true }],
              },
            ],
          },
        ],
      },
      {
        id: 'rit-a5-03',
        playerLine: 'The trust deed doesn’t name who set it up.',
        reply: [
          'Then it doesn’t name them.',
          'You’ve a face like a wet Tuesday, Adare. If you’re going to say a thing, say it on the quay, not in front of the ferry, not in front of people.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-kestrel-mandate' },
        once: true,
      },
      {
        id: 'rit-a5-04',
        playerLine: 'Watch the water.',
        reply: [
          '— One. Two. Three. Twenty seconds. Three flashes in twenty seconds.',
          'That’s it. That’s the character. That’s — hold on. Give me a minute. Give me a minute, will you.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'rita-saw-the-light', value: true }],
      },
    ],
  },
];
