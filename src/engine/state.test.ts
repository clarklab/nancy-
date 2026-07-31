/**
 * State machine tests.
 *
 * These cover the two things most likely to break a playthrough silently: a
 * condition evaluating the wrong way, and an effect that fails to persist.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GameState } from './state';
import type { Condition, GameContent, Presenter } from './types-test-helpers';
import { makeContent, makePresenter } from './types-test-helpers';

describe('GameState.check', () => {
  let s: GameState;

  beforeEach(() => {
    s = new GameState(makeContent() as GameContent);
    s.attachPresenter(makePresenter() as Presenter);
  });

  const cases: [string, Condition, boolean][] = [
    ['always', { kind: 'always' }, true],
    ['never', { kind: 'never' }, false],
  ];

  for (const [name, cond, expected] of cases) {
    it(`evaluates ${name}`, () => {
      expect(s.check(cond)).toBe(expected);
    });
  }

  it('gates on act ranges inclusively', () => {
    s.act = 3;
    expect(s.check({ kind: 'act', min: 3 })).toBe(true);
    expect(s.check({ kind: 'act', max: 3 })).toBe(true);
    expect(s.check({ kind: 'act', min: 2, max: 4 })).toBe(true);
    expect(s.check({ kind: 'act', min: 4 })).toBe(false);
    expect(s.check({ kind: 'act', max: 2 })).toBe(false);
  });

  it('treats an unset flag as false, not undefined', () => {
    expect(s.check({ kind: 'flag', flag: 'nope' })).toBe(false);
    expect(s.check({ kind: 'flag', flag: 'nope', value: false })).toBe(true);
  });

  it('composes all/any/not', () => {
    s.items.add('lantern');
    const hasLantern: Condition = { kind: 'hasItem', item: 'lantern' };
    const hasRope: Condition = { kind: 'hasItem', item: 'rope' };

    expect(s.check({ kind: 'all', of: [hasLantern, hasRope] })).toBe(false);
    expect(s.check({ kind: 'any', of: [hasLantern, hasRope] })).toBe(true);
    expect(s.check({ kind: 'not', of: hasRope })).toBe(true);
  });

  it('compares counters against both bounds', () => {
    s.counters.trust = 2;
    expect(s.check({ kind: 'counter', counter: 'trust', min: 2 })).toBe(true);
    expect(s.check({ kind: 'counter', counter: 'trust', min: 3 })).toBe(false);
    // A counter never incremented reads as zero.
    expect(s.check({ kind: 'counter', counter: 'unset', max: 0 })).toBe(true);
  });
});

describe('GameState.run', () => {
  let s: GameState;
  let p: ReturnType<typeof makePresenter>;

  beforeEach(() => {
    s = new GameState(makeContent() as GameContent);
    p = makePresenter();
    s.attachPresenter(p as Presenter);
  });

  it('grants an item once and toasts only the first time', async () => {
    await s.run([{ kind: 'giveItem', item: 'lantern' }]);
    await s.run([{ kind: 'giveItem', item: 'lantern' }]);
    expect(s.hasItem('lantern')).toBe(true);
    expect(p.toastItem).toHaveBeenCalledTimes(1);
  });

  it('honours the silent flag', async () => {
    await s.run([{ kind: 'giveClue', clue: 'ledger', silent: true }]);
    expect(s.hasClue('ledger')).toBe(true);
    expect(p.toastClue).not.toHaveBeenCalled();
  });

  it('branches on if/else', async () => {
    await s.run([
      {
        kind: 'if',
        cond: { kind: 'hasItem', item: 'lantern' },
        then: [{ kind: 'setFlag', flag: 'lit', value: true }],
        else: [{ kind: 'setFlag', flag: 'dark', value: true }],
      },
    ]);
    expect(s.flags.dark).toBe(true);
    expect(s.flags.lit).toBeUndefined();
  });

  it('runs effects strictly in order', async () => {
    const order: string[] = [];
    p.narrate.mockImplementation(async (lines: string[]) => {
      order.push(lines[0]);
    });
    await s.run([
      { kind: 'narrate', text: 'one' },
      { kind: 'narrate', text: 'two' },
      { kind: 'narrate', text: 'three' },
    ]);
    expect(order).toEqual(['one', 'two', 'three']);
  });

  it('does not double-fire an act card for the current act', async () => {
    await s.run([{ kind: 'setAct', act: 1 }]);
    expect(p.actCard).not.toHaveBeenCalled();
    await s.run([{ kind: 'setAct', act: 2 }]);
    expect(p.actCard).toHaveBeenCalledOnce();
  });

  it('marks a task done without duplicating it', async () => {
    await s.run([{ kind: 'addTask', id: 't1', text: 'Find the log' }]);
    await s.run([{ kind: 'addTask', id: 't1', text: 'Find the log' }]);
    await s.run([{ kind: 'completeTask', id: 't1' }]);
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0].done).toBe(true);
  });

  it('notifies subscribers after a batch', async () => {
    const fn = vi.fn();
    s.subscribe(fn);
    await s.run([{ kind: 'setFlag', flag: 'a', value: true }]);
    expect(fn).toHaveBeenCalled();
  });
});

describe('save round-trip', () => {
  it('restores every field it serialises', async () => {
    const s = new GameState(makeContent() as GameContent);
    s.attachPresenter(makePresenter() as Presenter);

    s.act = 3;
    s.scene = 'lamp-room';
    s.items.add('lantern');
    s.clues.add('ledger');
    s.flags.lit = true;
    s.counters.trust = 4;
    s.solvedPuzzles.add('tide-table');
    s.visitedScenes.add('quay');
    s.usedDialogueNodes.add('n1');
    s.tasks.push({ id: 't', text: 'x', done: true });
    s.puzzleState.dial = { angle: 42 };
    s.playtime = 999;
    s.accusations.warden = ['ledger'];

    const blob = JSON.parse(JSON.stringify(s.toSave()));

    const restored = new GameState(makeContent() as GameContent);
    restored.attachPresenter(makePresenter() as Presenter);
    restored.loadSave(blob);

    expect(restored.act).toBe(3);
    expect(restored.scene).toBe('lamp-room');
    expect([...restored.items]).toEqual(['lantern']);
    expect([...restored.clues]).toEqual(['ledger']);
    expect(restored.flags.lit).toBe(true);
    expect(restored.counters.trust).toBe(4);
    expect([...restored.solvedPuzzles]).toEqual(['tide-table']);
    expect([...restored.visitedScenes]).toEqual(['quay']);
    expect([...restored.usedDialogueNodes]).toEqual(['n1']);
    expect(restored.tasks).toEqual([{ id: 't', text: 'x', done: true }]);
    expect(restored.puzzleState.dial).toEqual({ angle: 42 });
    expect(restored.playtime).toBe(999);
    expect(restored.accusations.warden).toEqual(['ledger']);
  });

  it('deep-clones puzzle state so a restored save is not aliased', () => {
    const s = new GameState(makeContent() as GameContent);
    s.attachPresenter(makePresenter() as Presenter);
    s.puzzleState.dial = { angle: 1 };
    const blob = s.toSave();
    s.puzzleState.dial.angle = 2;
    expect((blob.puzzleState.dial as { angle: number }).angle).toBe(1);
  });
});
