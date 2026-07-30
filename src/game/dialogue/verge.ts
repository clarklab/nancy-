import type { DialogueTree } from '@/engine/types';

/**
 * Ottoline Verge — Registrar of the Rolls, retired 1991, still in six days a
 * week because nobody else alive understands the index.
 *
 * Soft, unhurried, digressive ON PURPOSE: the load-bearing sentence is always
 * buried in the middle of an anecdote. "Oh, now" precedes every evasion,
 * invariably, and a listening player learns to hear it. In Act IV the
 * digressions stop dead and no "oh, now" survives — the change of rhythm is
 * the emotional event, so it is never softened back.
 */
export const vergeTrees: DialogueTree[] = [
  // -------------------------------------------------------------- Act I ----
  {
    characterId: 'ottoline-verge',
    act: 1,
    greeting: [
      'There you are! Oh, you’re soaked through.',
      'Now — kettle’s in 388, biscuits in 388, slippers in 388. Everything anybody needs is in drawer 388, dear. That’s the whole system.',
    ],
    exhausted:
      'Oh, now, you’ve asked me everything twice and I’ve given you the same answers, which is how you know they’re true or how you know I’ve practised. Have a biscuit.',
    farewell: 'Off you go. And put the light out on the stair, dear, the switch is the one that doesn’t look like a switch.',
    nodes: [
      {
        id: 'ott-a1-01',
        playerLine: 'Show me how a requisition slip works.',
        reply: [
          'White top copy goes up the tube, pink carbon stays in the stub, and there’s your countersignature box.',
          'If the Warden’s out, her clerk initials it p.p. — on behalf of. We’ve done it since the Ark.',
        ],
        once: true,
        effects: [{ kind: 'giveClue', clue: 'clue-pp-taught' }],
      },
      {
        id: 'ott-a1-02',
        playerLine: 'How long have you been here?',
        reply:
          'Oh, now — since forty-nine, off and on. Retired in ninety-one and came straight back the Monday after. Six days a week. Nobody else alive understands the index, and that’s not boasting, dear, it’s a nuisance.',
        once: true,
      },
      {
        id: 'ott-a1-03',
        playerLine: 'Did you know Cormac Sallow?',
        reply: [
          'Since he was a young man with all his fingers. He’d ask for the 1962 lamp returns and I’d have them before he’d finished asking.',
          'He signed in at eight fifty-six and I never saw him come down.',
        ],
        once: true,
      },
      {
        id: 'ott-a1-04',
        playerLine: 'Where were you in the autumn of 1974?',
        reply:
          'Oh, now — I couldn’t tell you a thing about that autumn, dear. I was in Accounts in those days. Figures. Terrible at figures. Have a biscuit, they’re the plain ones, the nice ones go by ten.',
        once: true,
        effects: [{ kind: 'setFlag', flag: 'verge-fog-about-1974', value: true }],
      },
      {
        id: 'ott-a1-05',
        playerLine: 'Tell me about Mr Pike.',
        reply:
          'Halvard’s a lamb in a nasty coat. Forty-four years. He has keys to everything, you know — everything — and he was here the evening poor Cormac died. But he’s a lamb, dear, truly.',
        once: true,
      },
      {
        id: 'ott-a1-06',
        playerLine: 'Who typed the index cards?',
        reply:
          'I did, dear, near enough all of them, on the Underwood by the window because the light’s better and the Imperial’s a has been filling up with muck since before you were born. Fifty years of my own hand, all in capitals. You’ll know it when you see it.',
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------- Act II ----
  {
    characterId: 'ottoline-verge',
    act: 2,
    greeting:
      'Kettle’s just gone. Sit on the stool, not the chair — the chair’s had a screw out of it since Michaelmas and Halvard won’t have a man in.',
    exhausted: 'Oh, now, you’re only turning it over. Drink that while it’s hot and think somewhere else, dear.',
    farewell: 'Mind the drawer. 388 sticks in the wet and I’m the only one who knows to lift it.',
    nodes: [
      {
        id: 'ott-a2-01',
        playerLine: 'Forty-seven cards. Stock not made before 1987. Typed on the Underwood four feet from your chair.',
        reply: 'The cards have never been retyped, dear, not in my time. Not one of them.',
        availableIf: { kind: 'hasClue', clue: 'clue-index-gap' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'ott-a2-01-stock',
            playerLine: 'The watermark is a 1987 stock. The cards say 1962.',
            reply: [
              'Oh, now. You’ve dated the stock.',
              'I retyped them. In eighty-nine, during the reboxing. I’ll not say why, and you’ll not make me.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'verge-admitted-cards', value: true },
              { kind: 'addCounter', counter: 'trust-ottoline', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'ott-a2-02',
        playerLine: 'Tell me about the 1989 reboxing.',
        reply:
          'That was the Warden’s own memorandum, signed in her own name, all above board. I volunteered for the index because nobody else would. January to March, and my hand was already going by then.',
        availableIf: { kind: 'hasClue', clue: 'clue-w-o-89-2' },
        once: true,
      },
      {
        id: 'ott-a2-03',
        playerLine: 'The “admitted by” column that morning is initialled S.F-K., not you.',
        reply: [
          'Oh, now — I was on the wicket all morning, in full view, ask anybody.',
          'But I don’t sign the column when the Warden’s standing at my elbow, do I. She did it herself. I thought nothing of it.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-visitors-book' },
        once: true,
      },
      {
        id: 'ott-a2-04',
        playerLine: 'Tell me about your husband.',
        reply: [
          'Cass. Relief keeper. Out on that rock more nights than in his own bed, or so —',
          'He drank, dear. From about seventy-five. Died in eighty-one, never said a word about anything, and I never asked him.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'verge-cass-mentioned', value: true }],
      },
      {
        id: 'ott-a2-05',
        playerLine: 'Who else was in this building in 1974?',
        reply: [
          'All of us! Halvard, Enid, Mr Sallow, Mr Ferrier of course.',
          'And Miss Ferrier as she was then, typing away in the corner. Lovely typist. Never a title to her name, poor lamb, not for years.',
        ],
        once: true,
      },
    ],
  },

  // ------------------------------------------------------------ Act III ----
  {
    characterId: 'ottoline-verge',
    act: 3,
    greeting:
      'You’ve had a week of it and you’ve not eaten. I’m not asking you, dear, I’m telling you there’s soup and you’ll sit down to it.',
    exhausted: 'Oh, now. Eat that. I’ll be here in the morning and so will the drawer.',
    farewell: 'Take the bread as well. It’s only going to go over, and you’ll be glad of it at two in the morning.',
    nodes: [
      {
        id: 'ott-a3-01',
        playerLine: 'Number 29. Mrs O. Verge. There’s a tick beside it in your hand.',
        reply: 'Nobody ever asked me anything, dear. Nobody ever thought to. That’s all that tick is — somebody deciding I wasn’t worth the postage.',
        availableIf: { kind: 'hasClue', clue: 'clue-inquiry-rejects' },
        once: true,
        isConfrontation: true,
        children: [
          {
            id: 'ott-a3-01-hand',
            playerLine: 'It’s your capitals. Your Underwood. Your afternoon.',
            reply: [
              'I typed that list. I typed my own name onto it and I put the tick there myself.',
              'I have been very careful for a very long time.',
            ],
            once: true,
            effects: [
              { kind: 'setFlag', flag: 'verge-admitted-tick', value: true },
              { kind: 'addCounter', counter: 'trust-ottoline', by: 1 },
            ],
          },
        ],
      },
      {
        id: 'ott-a3-02',
        playerLine: 'Number 33 on the same list.',
        reply: [
          '“Miss S. Ferrier. No official capacity.”',
          'That’s the truest sentence anybody ever typed in this building, dear. And I typed that one as well, on the same afternoon, on the same machine.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-inquiry-rejects' },
        once: true,
      },
      {
        id: 'ott-a3-03',
        playerLine: 'The Deakin letter’s a forgery.',
        reply: [
          'Oh, that poor girl.',
          'She’s been right for twenty-four years and now she’s a liar, and both are true at once, which is the very worst arrangement there is. Don’t let them keep her in.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-deakin-letter' },
        once: true,
      },
      {
        id: 'ott-a3-04',
        playerLine: 'Enid’s ruled-in column. “Sundry Adjustments (Lights).”',
        reply:
          'Oh, now. Enid rules a column when she’s frightened. She ruled one in sixty-eight when the pension went wrong. That woman’s never taken a penny and she’ll go to prison sooner than say who told her.',
        availableIf: { kind: 'hasClue', clue: 'clue-sundries-column' },
        once: true,
      },
      {
        id: 'ott-a3-05',
        playerLine: 'Why did you volunteer for the index?',
        reply: [
          'Oh, now — because I love it, dear, and that’s true. Nine weeks and a rubber thimble.',
          'Ask me a different question. Ask me the one you came in here holding.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'verge-invites-the-question', value: true }],
      },
    ],
  },

  // ------------------------------------------------------------- Act IV ----
  {
    characterId: 'ottoline-verge',
    act: 4,
    greeting: [
      'Sit down, Miss Adare. No. No “oh, now.”',
      'I’ve had my tin on the dresser since 1975 and I would like to put it on the table.',
    ],
    exhausted: 'I have said all of it. I am not going to add anything to make it easier to hear.',
    farewell: 'Tell me the day it goes out. That’s all. Tell me the day.',
    nodes: [
      {
        id: 'ott-a4-01',
        playerLine: 'What’s in the tin?',
        reply: [
          'Cass’s letter. Eighteenth of August, seventy-four. Residence deferred, wages to continue, you will not discuss this with the Lamp Superintendent. Initialled p.p.',
          'Twenty-four years. Take it. Take it properly, with both hands.',
        ],
        once: true,
        effects: [
          { kind: 'giveItem', item: 'deferment-letter' },
          { kind: 'giveClue', clue: 'clue-deferment-letter' },
          { kind: 'setFlag', flag: 'verge-tin-opened', value: true },
          { kind: 'addCounter', counter: 'trust-ottoline', by: 2 },
        ],
      },
      {
        id: 'ott-a4-02',
        playerLine: 'You knew the light was out.',
        reply: [
          'Since seventy-five. He told me drunk and never again.',
          'I let a whole town blame a dead man to keep them off mine. I knew it every day. I made the tea and I knew it every day.',
        ],
        availableIf: { kind: 'flag', flag: 'verge-tin-opened' },
        once: true,
      },
      {
        id: 'ott-a4-03',
        playerLine: 'Why the cards?',
        reply: [
          'To break the cross-reference. Stores file to wage sheet. If nobody could get from the oil to my husband’s money, nobody would ask where he had been.',
          'Nine weeks. A rubber thimble. Forty-seven cards.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-index-gap' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'verge-motive-stated', value: true }],
      },
      {
        id: 'ott-a4-04',
        playerLine: 'You thought you were protecting Absalom Ferrier.',
        reply: [
          'I did. Thirty-nine years I have said “Mr Ferrier” inside my own head.',
          'It was her. It was the girl at the typewriter. I made her tea for thirty-nine years and it was her.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-pp-sort' },
        once: true,
        effects: [{ kind: 'setFlag', flag: 'verge-turned', value: true }],
      },
      {
        id: 'ott-a4-05',
        playerLine: 'Your grandson.',
        reply: [
          'Emlyn. Second year at the naval college at Ilberry.',
          'You’ll publish it and you’re right to. Tell me the day it goes out. I want to telephone him first. That’s all I’m asking for.',
        ],
        once: true,
      },
    ],
  },

  // -------------------------------------------------------------- Act V ----
  {
    characterId: 'ottoline-verge',
    act: 5,
    greeting:
      'Best coat and my mother’s brooch. If it’s all to be said out loud in a room with sun in it, I’m not going to be sat there in a cardigan.',
    exhausted: 'That’s enough now. Save the rest for the room; they’ll want it fresher than I am.',
    farewell: 'Go and sit at the front where they can see how young you are. It’ll do them good.',
    nodes: [
      {
        id: 'ott-a5-01',
        playerLine: 'You’re being charged with nothing.',
        reply:
          'I know, dear. That is not the same as being clear and I’ll not be told that it is. There’s a difference between not being called and not being guilty. I’ve lived in it since 1975.',
        once: true,
      },
      {
        id: 'ott-a5-02',
        playerLine: 'Will you give evidence?',
        reply: [
          'Every word, and no anecdotes. I’ve been practising in the kitchen.',
          'Ask me about the cards, ask me about the tick, and don’t be kind about it — kindness is how I got away with it.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'verge-will-testify', value: true }],
      },
      {
        id: 'ott-a5-03',
        playerLine: 'Two hundred pounds four shillings. Eleven weeks.',
        reply: [
          'He drank it. Every week, in the Ship, in front of people who’d lost somebody.',
          'Say the figure to the Board and don’t soften it. It’s the last honest thing he can do now.',
        ],
        availableIf: { kind: 'hasClue', clue: 'clue-reconciliation' },
        once: true,
      },
      {
        id: 'ott-a5-04',
        playerLine: 'There are thirty-one names to be read.',
        reply: [
          'Let me.',
          'I know how to read a list, dear. It’s the only skill I’ve got. I’ll get as far as I can and you’ll take over, and you won’t look at me while I do it.',
        ],
        once: true,
        effects: [{ kind: 'setFlag', flag: 'verge-reads-the-names', value: true }],
      },
    ],
  },
];
