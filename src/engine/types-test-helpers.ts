/**
 * Minimal fixtures for the engine tests.
 *
 * Kept separate from the test file so the content-validation tests can reuse
 * the same skeleton without importing vitest matchers.
 */

import { vi } from 'vitest';
import type { GameContent, Presenter } from './types-reexport';

export type { Condition, GameContent } from './types-reexport';
export type { Presenter } from './types-reexport';

/** An empty but structurally valid content graph. */
export function makeContent(overrides: Partial<GameContent> = {}): GameContent {
  return {
    title: 'Test',
    scenes: {},
    items: {
      lantern: { id: 'lantern', name: 'Lantern', icon: '', description: '' },
      rope: { id: 'rope', name: 'Rope', icon: '', description: '' },
    },
    clues: {
      ledger: { id: 'ledger', name: 'Ledger', summary: '', act: 1, category: 'document' },
    },
    characters: {},
    dialogue: [],
    puzzles: {},
    cinematics: {},
    acts: [
      { number: 1, title: 'One', goal: 'a' },
      { number: 2, title: 'Two', goal: 'b' },
    ],
    startScene: 'start',
    ...overrides,
  };
}

/** A presenter whose every method is a spy resolving immediately. */
export function makePresenter() {
  return {
    narrate: vi.fn(async () => {}),
    think: vi.fn(async () => {}),
    toastItem: vi.fn(async () => {}),
    toastClue: vi.fn(async () => {}),
    goto: vi.fn(async () => {}),
    openPuzzle: vi.fn(async () => {}),
    talk: vi.fn(async () => {}),
    playCinematic: vi.fn(async () => {}),
    playSound: vi.fn(),
    setAmbience: vi.fn(),
    shake: vi.fn(),
    actCard: vi.fn(async () => {}),
    endGame: vi.fn(async () => {}),
  } satisfies Record<keyof Presenter, unknown>;
}
