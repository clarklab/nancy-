/**
 * Game state: the single source of truth, plus the interpreters for the
 * `Condition` and `Effect` data languages declared in `types.ts`.
 */

import type {
  Condition,
  Effect,
  GameContent,
  JournalTask,
  SaveData,
  SceneId,
} from './types';

export const SAVE_VERSION = 3;
const SAVE_PREFIX = 'lamplight.save';
const SLOTS = ['auto', '1', '2', '3'] as const;
export type SaveSlot = (typeof SLOTS)[number];

type Listener = () => void;

/**
 * Presentation hooks the engine layer installs. State never touches the DOM
 * itself — it asks the presenter to show things and awaits acknowledgement,
 * which is what lets a `narrate` effect block until the player clicks on.
 */
export interface Presenter {
  narrate(text: string[], speaker?: string): Promise<void>;
  think(text: string[]): Promise<void>;
  toastItem(itemId: string): Promise<void>;
  toastClue(clueId: string): Promise<void>;
  goto(scene: SceneId, transition?: string): Promise<void>;
  openPuzzle(puzzleId: string): Promise<void>;
  talk(characterId: string): Promise<void>;
  playCinematic(id: string): Promise<void>;
  playSound(sound: string): void;
  setAmbience(ambience: string): void;
  shake(intensity: number): void;
  actCard(act: number): Promise<void>;
  endGame(ending: string): Promise<void>;
}

export class GameState {
  readonly content: GameContent;
  private presenter!: Presenter;
  private listeners = new Set<Listener>();

  act = 1;
  scene: SceneId;
  previousScene: SceneId | null = null;
  items = new Set<string>();
  clues = new Set<string>();
  flags: Record<string, boolean> = {};
  counters: Record<string, number> = {};
  solvedPuzzles = new Set<string>();
  visitedScenes = new Set<SceneId>();
  usedDialogueNodes = new Set<string>();
  unlockedScenes = new Set<SceneId>();
  tasks: JournalTask[] = [];
  puzzleState: Record<string, Record<string, unknown>> = {};
  accusations: Record<string, string[]> = {};
  playtime = 0;

  /** Newly-acquired ids, so the journal can badge what the player hasn't read. */
  unreadClues = new Set<string>();
  unreadItems = new Set<string>();

  constructor(content: GameContent) {
    this.content = content;
    this.scene = content.startScene;
  }

  attachPresenter(p: Presenter) {
    this.presenter = p;
  }

  // -- reactivity ----------------------------------------------------------

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn();
  }

  // -- queries -------------------------------------------------------------

  hasItem(id: string) {
    return this.items.has(id);
  }

  hasClue(id: string) {
    return this.clues.has(id);
  }

  isSolved(id: string) {
    return this.solvedPuzzles.has(id);
  }

  /** Evaluates a content-declared predicate against current state. */
  check(cond: Condition | undefined): boolean {
    if (!cond) return true;
    switch (cond.kind) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'act':
        return (
          (cond.min === undefined || this.act >= cond.min) &&
          (cond.max === undefined || this.act <= cond.max)
        );
      case 'hasItem':
        return this.items.has(cond.item);
      case 'lacksItem':
        return !this.items.has(cond.item);
      case 'hasClue':
        return this.clues.has(cond.clue);
      case 'lacksClue':
        return !this.clues.has(cond.clue);
      case 'flag':
        return (this.flags[cond.flag] ?? false) === (cond.value ?? true);
      case 'puzzleSolved':
        return this.solvedPuzzles.has(cond.puzzle);
      case 'puzzleUnsolved':
        return !this.solvedPuzzles.has(cond.puzzle);
      case 'visited':
        return this.visitedScenes.has(cond.scene);
      case 'counter': {
        const v = this.counters[cond.counter] ?? 0;
        return (
          (cond.min === undefined || v >= cond.min) &&
          (cond.max === undefined || v <= cond.max)
        );
      }
      case 'all':
        return cond.of.every((c) => this.check(c));
      case 'any':
        return cond.of.some((c) => this.check(c));
      case 'not':
        return !this.check(cond.of);
      default: {
        // Exhaustiveness guard: a new Condition kind must be handled here.
        const _never: never = cond;
        void _never;
        return false;
      }
    }
  }

  // -- effects -------------------------------------------------------------

  /** Runs effects in order. Presentation effects block until dismissed. */
  async run(effects: Effect[] | undefined): Promise<void> {
    if (!effects) return;
    for (const e of effects) await this.runOne(e);
    this.notify();
  }

  private async runOne(e: Effect): Promise<void> {
    const lines = (t: string | string[]) => (Array.isArray(t) ? t : [t]);

    switch (e.kind) {
      case 'narrate':
        await this.presenter.narrate(lines(e.text), e.speaker);
        break;
      case 'think':
        await this.presenter.think(lines(e.text));
        break;
      case 'giveItem':
        if (!this.items.has(e.item)) {
          this.items.add(e.item);
          this.unreadItems.add(e.item);
          this.notify();
          if (!e.silent) await this.presenter.toastItem(e.item);
        }
        break;
      case 'takeItem':
        this.items.delete(e.item);
        this.notify();
        break;
      case 'giveClue':
        if (!this.clues.has(e.clue)) {
          this.clues.add(e.clue);
          this.unreadClues.add(e.clue);
          this.notify();
          if (!e.silent) await this.presenter.toastClue(e.clue);
        }
        break;
      case 'setFlag':
        this.flags[e.flag] = e.value;
        this.notify();
        break;
      case 'addCounter':
        this.counters[e.counter] = (this.counters[e.counter] ?? 0) + e.by;
        this.notify();
        break;
      case 'goto':
        await this.presenter.goto(e.scene, e.transition);
        break;
      case 'openPuzzle':
        await this.presenter.openPuzzle(e.puzzle);
        break;
      case 'talk':
        await this.presenter.talk(e.character);
        break;
      case 'setAct':
        if (e.act !== this.act) {
          this.act = e.act;
          this.notify();
          await this.presenter.actCard(e.act);
        }
        break;
      case 'addTask':
        if (!this.tasks.some((t) => t.id === e.id)) {
          this.tasks.push({ id: e.id, text: e.text, done: false });
          this.notify();
        }
        break;
      case 'completeTask': {
        const t = this.tasks.find((x) => x.id === e.id);
        if (t) t.done = true;
        this.notify();
        break;
      }
      case 'playSound':
        this.presenter.playSound(e.sound);
        break;
      case 'setAmbience':
        this.presenter.setAmbience(e.ambience);
        break;
      case 'shake':
        this.presenter.shake(e.intensity ?? 1);
        break;
      case 'cinematic':
        await this.presenter.playCinematic(e.id);
        break;
      case 'unlockScene':
        this.unlockedScenes.add(e.scene);
        this.notify();
        break;
      case 'endGame':
        await this.presenter.endGame(e.ending);
        break;
      case 'if':
        await this.run(this.check(e.cond) ? e.then : (e.else ?? []));
        break;
      case 'sequence':
        await this.run(e.of);
        break;
      default: {
        const _never: never = e;
        void _never;
      }
    }
  }

  // -- persistence ---------------------------------------------------------

  toSave(): SaveData {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      act: this.act,
      scene: this.scene,
      previousScene: this.previousScene,
      items: [...this.items],
      clues: [...this.clues],
      flags: { ...this.flags },
      counters: { ...this.counters },
      solvedPuzzles: [...this.solvedPuzzles],
      visitedScenes: [...this.visitedScenes],
      usedDialogueNodes: [...this.usedDialogueNodes],
      unlockedScenes: [...this.unlockedScenes],
      tasks: this.tasks.map((t) => ({ ...t })),
      puzzleState: structuredClone(this.puzzleState),
      playtime: this.playtime,
      accusations: structuredClone(this.accusations),
    };
  }

  loadSave(data: SaveData) {
    this.act = data.act;
    this.scene = data.scene;
    this.previousScene = data.previousScene;
    this.items = new Set(data.items);
    this.clues = new Set(data.clues);
    this.flags = { ...data.flags };
    this.counters = { ...data.counters };
    this.solvedPuzzles = new Set(data.solvedPuzzles);
    this.visitedScenes = new Set(data.visitedScenes);
    this.usedDialogueNodes = new Set(data.usedDialogueNodes);
    this.unlockedScenes = new Set(data.unlockedScenes);
    this.tasks = data.tasks.map((t) => ({ ...t }));
    this.puzzleState = structuredClone(data.puzzleState);
    this.playtime = data.playtime;
    this.accusations = structuredClone(data.accusations ?? {});
    this.unreadClues.clear();
    this.unreadItems.clear();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Slot storage
// ---------------------------------------------------------------------------

export interface SaveMeta {
  slot: SaveSlot;
  savedAt: number;
  act: number;
  sceneName: string;
  playtime: number;
}

const slotKey = (slot: SaveSlot) => `${SAVE_PREFIX}.${slot}`;

export function writeSlot(slot: SaveSlot, data: SaveData) {
  try {
    localStorage.setItem(slotKey(slot), JSON.stringify(data));
    return true;
  } catch {
    // Quota or private-mode failure: the game must stay playable regardless.
    return false;
  }
}

export function readSlot(slot: SaveSlot): SaveData | null {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    // Saves from an older content build cannot be trusted to resolve ids.
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSlot(slot: SaveSlot) {
  localStorage.removeItem(slotKey(slot));
}

export function listSlots(content: GameContent): SaveMeta[] {
  return SLOTS.flatMap((slot) => {
    const d = readSlot(slot);
    if (!d) return [];
    return [
      {
        slot,
        savedAt: d.savedAt,
        act: d.act,
        sceneName: content.scenes[d.scene]?.name ?? 'Unknown',
        playtime: d.playtime,
      },
    ];
  });
}

export const SAVE_SLOTS = SLOTS;
