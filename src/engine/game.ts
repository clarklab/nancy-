/**
 * The orchestrator.
 *
 * `Game` owns the DOM shell, implements the `Presenter` interface that the
 * state machine calls into, and routes player input to the right subsystem.
 * It is the only module that knows about every other module — everything else
 * stays decoupled and testable.
 */

import { GameState, listSlots, readSlot, writeSlot } from './state';
import type { Presenter, SaveSlot } from './state';
import { SceneView, preload } from './scene-view';
import type {
  Character,
  DialogueTree,
  GameContent,
  Hotspot,
  Scene,
  SceneId,
} from './types';
import { audio } from './audio';
import { voice } from './voice';
import voIndex from '@/game/vo-index.json';
import { Hud } from '@/ui/hud';
import { Journal } from '@/ui/journal';
import { DialogueView } from '@/ui/dialogue';
import { PuzzleHost } from '@/ui/puzzle-host';
import { CinematicPlayer } from '@/ui/cinematic';
import { Menus, applySettings, loadSettings } from '@/ui/menus';
import { Narration } from '@/ui/narration';

/** Autosave cadence. Frequent enough to be forgiving, rare enough to be quiet. */
const AUTOSAVE_MS = 45_000;

export class Game implements Presenter {
  private root: HTMLElement;
  private state: GameState;
  private content: GameContent;

  private sceneView!: SceneView;
  private hud!: Hud;
  private journal!: Journal;
  private dialogue!: DialogueView;
  private puzzles!: PuzzleHost;
  private cinematics!: CinematicPlayer;
  private menus!: Menus;
  private narration!: Narration;

  private selectedItem: string | null = null;
  private autosaveTimer = 0;
  private playtimeTimer = 0;
  /** Set while a modal subsystem owns input, so the scene ignores clicks. */
  private busy = false;

  constructor(root: HTMLElement, content: GameContent) {
    this.root = root;
    this.content = content;
    this.state = new GameState(content);
    this.state.attachPresenter(this);
  }

  // -- lifecycle -----------------------------------------------------------

  async boot() {
    applySettings(loadSettings());
    // Only ids present in the generated index have audio; everything else
    // stays text-only and must not produce a 404 per line.
    voice.setAvailable(Object.keys(voIndex));

    this.root.classList.add('app-shell');
    this.root.innerHTML = `
      <div class="stage-frame">
        <div class="stage" id="stage"></div>
      </div>
      <div class="overlay-root" id="overlays"></div>`;

    const stage = this.root.querySelector<HTMLElement>('#stage')!;
    const overlays = this.root.querySelector<HTMLElement>('#overlays')!;

    this.sceneView = new SceneView(this.state, {
      onHotspot: (hs) => void this.interact(hs),
      onItemDropped: (hs, item) => void this.dropItem(hs, item),
      onHover: (hs) => this.hud?.setHovered(hs?.label ?? null),
    });
    stage.appendChild(this.sceneView.el);

    this.narration = new Narration();
    this.narration.mount(overlays);

    this.hud = new Hud(this.state, {
      onOpenJournal: () => this.journal.open(),
      onOpenInventory: () => this.journal.open('clues'),
      onOpenMap: () => this.journal.open('map'),
      onHint: () => void this.giveHint(),
      onMenu: () => void this.openPause(),
      onSelectItem: (id) => this.selectItem(id),
      onExamineItem: (id) => void this.examineItem(id),
      onSound: (n) => audio.playSound(n),
    });
    this.hud.mount(overlays);

    this.journal = new Journal(this.state, { onSound: (n) => audio.playSound(n) });
    this.journal.mount(overlays);

    this.dialogue = new DialogueView({
      onSound: (n: string) => audio.playSound(n),
      onSpeak: (lineId) => voice.play(lineId),
    });
    this.dialogue.mount(overlays);

    this.puzzles = new PuzzleHost({ onSound: (n) => audio.playSound(n) });
    this.puzzles.mount(overlays);

    this.cinematics = new CinematicPlayer();
    this.cinematics.mount(overlays);

    this.menus = new Menus(this.state);
    this.menus.mount(overlays);

    // Re-evaluate conditional hotspots and HUD counts whenever state moves.
    this.state.subscribe(() => {
      this.sceneView.refresh();
      this.hud.refresh();
      if (this.journal.isOpen) this.journal.refresh();
    });

    this.installGlobalKeys();
    this.startTimers();

    // Browsers block audio until a gesture; the title screen provides one.
    const onFirstGesture = () => {
      audio.unlock();
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture);
    window.addEventListener('keydown', onFirstGesture);

    await this.runTitle();
  }

  private async runTitle() {
    const choice = await this.menus.title();

    if (choice === 'new') {
      await this.newGame();
    } else if (choice === 'continue') {
      const save = readSlot('auto');
      if (save) this.state.loadSave(save);
      await this.resumeFromState();
    } else {
      const save = readSlot(choice.load);
      if (save) this.state.loadSave(save);
      await this.resumeFromState();
    }
  }

  private async newGame() {
    if (this.content.openingCinematic) {
      await this.playCinematic(this.content.openingCinematic);
    }
    await this.goto(this.content.startScene, 'fade');
    await this.actCard(1);
  }

  private async resumeFromState() {
    await this.goto(this.state.scene, 'fade');
  }

  private startTimers() {
    this.playtimeTimer = window.setInterval(() => {
      if (!document.hidden) this.state.playtime += 1;
    }, 1000);

    this.autosaveTimer = window.setInterval(() => {
      // Never autosave mid-modal: the save would restore into a dead state.
      if (!this.busy) writeSlot('auto', this.state.toSave());
    }, AUTOSAVE_MS);
  }

  // -- input ---------------------------------------------------------------

  private installGlobalKeys() {
    window.addEventListener('keydown', (ev) => {
      if (this.busy) return;
      const k = ev.key.toLowerCase();
      if (k === 'escape') {
        ev.preventDefault();
        if (this.journal.isOpen) this.journal.close();
        else void this.openPause();
      } else if (k === 'j') {
        this.journal.isOpen ? this.journal.close() : this.journal.open('case');
      } else if (k === 'i') {
        this.journal.open('clues');
      } else if (k === 'm') {
        this.journal.open('map');
      } else if (k === 'h') {
        void this.giveHint();
      } else if (k === ' ' || k === 'l') {
        // Hold-to-reveal: the accessibility answer to pixel hunting.
        ev.preventDefault();
        this.sceneView.revealHotspots();
      }
    });
  }

  private selectItem(id: string | null) {
    this.selectedItem = this.selectedItem === id ? null : id;
    this.sceneView.setCarrying(this.selectedItem);
    this.hud.setSelectedItem(this.selectedItem);
    audio.playSound('click-brass');
  }

  private async interact(hs: Hotspot) {
    if (this.busy) return;

    // A selected item turns a click into a "use item on target" gesture.
    if (this.selectedItem) {
      await this.dropItem(hs, this.selectedItem);
      return;
    }

    if (!this.state.check(hs.enabledIf)) {
      await this.state.run(hs.blockedEffects ?? [{ kind: 'think', text: 'Not yet.' }]);
      return;
    }

    audio.playSound(hs.cursor.startsWith('walk') ? 'footstep-wood' : 'click-soft');
    await this.guard(() => this.state.run(hs.onInteract));
  }

  private async dropItem(hs: Hotspot, itemId: string) {
    const match = hs.accepts?.find((a) => a.item === itemId);
    this.selectItem(null);

    if (match) {
      await this.guard(() => this.state.run(match.effects));
    } else {
      audio.playSound('lock-refuse');
      const item = this.content.items[itemId];
      await this.guard(() =>
        this.state.run(
          hs.onWrongItem ?? [
            { kind: 'think', text: `The ${item?.name ?? 'thing'} is no use here.` },
          ],
        ),
      );
    }
  }

  /** Runs a player-triggered action with the input lock held. */
  private async guard(fn: () => Promise<void>) {
    this.busy = true;
    try {
      await fn();
    } finally {
      this.busy = false;
    }
  }

  private async examineItem(id: string) {
    const item = this.content.items[id];
    if (!item) return;
    // Clearing the badge is state the HUD renders, so it has to notify —
    // otherwise the amber "unread" pip survives until some unrelated change.
    if (this.state.unreadItems.delete(id)) this.state.notify();
    await this.guard(() =>
      this.narration.examine(item.name, item.examineText ?? item.description, item.examineImage ?? item.icon),
    );
  }

  private async giveHint() {
    // Hints are diegetic: the detective reasons aloud about the open task.
    const open = this.state.tasks.find((t) => !t.done);
    const text = open
      ? `I still need to ${open.text.charAt(0).toLowerCase()}${open.text.slice(1)}`
      : 'Nothing pressing. Look around — something here hasn’t given itself up yet.';
    await this.guard(() => this.state.run([{ kind: 'think', text }]));
  }

  private async openPause() {
    this.busy = true;
    this.hud.setVisible(false);
    try {
      let done = false;
      while (!done) {
        const choice = await this.menus.pause();
        if (choice === 'resume') done = true;
        else if (choice === 'settings') await this.menus.settings();
        else if (choice === 'save') {
          const slot = await this.menus.saveMenu('save');
          if (slot) writeSlot(slot, this.state.toSave());
        } else if (choice === 'load') {
          const slot = await this.menus.saveMenu('load');
          const data = slot ? readSlot(slot) : null;
          if (data) {
            this.state.loadSave(data);
            await this.goto(this.state.scene, 'fade');
            done = true;
          }
        } else if (choice === 'quit') {
          writeSlot('auto', this.state.toSave());
          location.reload();
          return;
        }
      }
    } finally {
      this.hud.setVisible(true);
      this.busy = false;
    }
  }

  // -- Presenter implementation -------------------------------------------

  async narrate(text: string[], speaker?: string) {
    await this.narration.say(text, speaker);
  }

  async think(text: string[]) {
    await this.narration.think(text);
  }

  async toastItem(itemId: string) {
    const item = this.content.items[itemId];
    audio.playSound('item-pickup');
    await this.hud.toast('item', item?.name ?? itemId, item?.icon);
  }

  async toastClue(clueId: string) {
    const clue = this.content.clues[clueId];
    audio.playSound('clue-found');
    await this.hud.toast('clue', clue?.name ?? clueId);
  }

  async goto(sceneId: SceneId, transition = 'fade') {
    const scene: Scene | undefined = this.content.scenes[sceneId];
    if (!scene) {
      console.warn(`goto: unknown scene "${sceneId}"`);
      return;
    }
    if (!this.state.check(scene.enterIf)) return;

    this.state.previousScene = this.state.scene;
    this.state.scene = sceneId;
    this.selectItem(null);

    await this.sceneView.show(scene, transition);
    this.hud.announceLocation(scene.name, scene.subtitle);
    if (scene.ambience) audio.setAmbience(scene.ambience);

    const first = !this.state.visitedScenes.has(sceneId);
    this.state.visitedScenes.add(sceneId);
    this.state.notify();

    // Warm the neighbours so onward travel never waits on a decode.
    this.prefetchNeighbours(scene);

    if (first) await this.state.run(scene.onFirstEnter);
    await this.state.run(scene.onEnter);
  }

  /** Decodes backgrounds reachable in one step from `scene`. */
  private prefetchNeighbours(scene: Scene) {
    const targets = new Set<string>();
    const walk = (effects: unknown): void => {
      if (!Array.isArray(effects)) return;
      for (const e of effects as { kind: string; scene?: string; then?: unknown; else?: unknown; of?: unknown }[]) {
        if (e.kind === 'goto' && e.scene) targets.add(e.scene);
        if (e.kind === 'if') walk(e.then), walk(e.else);
        if (e.kind === 'sequence') walk(e.of);
      }
    };
    for (const hs of scene.hotspots) walk(hs.onInteract);
    for (const id of targets) {
      const bg = this.content.scenes[id]?.background;
      if (bg) void preload(bg);
    }
  }

  async openPuzzle(puzzleId: string) {
    const def = this.content.puzzles[puzzleId];
    if (!def) return;
    this.hud.setVisible(false);
    const solved = await this.puzzles.open(def, this.state);
    this.hud.setVisible(true);
    if (solved && !this.state.isSolved(puzzleId)) {
      this.state.solvedPuzzles.add(puzzleId);
      this.state.notify();
      await this.state.run(def.onSolve);
    }
  }

  async talk(characterId: string) {
    const character: Character | undefined = this.content.characters[characterId];
    if (!character) return;

    // Pick the richest tree the player currently qualifies for: latest act first.
    const tree: DialogueTree | undefined = this.content.dialogue
      .filter((t) => t.characterId === characterId && t.act <= this.state.act)
      .filter((t) => this.state.check(t.availableIf))
      .sort((a, b) => b.act - a.act)[0];

    if (!tree) {
      await this.think(['They have nothing more to say to me right now.']);
      return;
    }

    this.state.flags[`met.${characterId}`] = true;
    this.hud.setVisible(false);
    try {
      await this.dialogue.converse(character, tree, this.state);
    } finally {
      // A conversation that ends early must not leave a read playing over
      // whatever the player walked into next.
      voice.stop();
      this.hud.setVisible(true);
    }
  }

  async playCinematic(id: string) {
    const c = this.content.cinematics[id];
    if (!c) return;
    this.hud.setVisible(false);
    await this.cinematics.play(c);
    this.hud.setVisible(true);
  }

  playSound(sound: string) {
    audio.playSound(sound);
  }

  setAmbience(ambience: string) {
    audio.setAmbience(ambience);
  }

  shake(intensity: number) {
    const stage = this.root.querySelector<HTMLElement>('.stage-frame');
    if (!stage) return;
    stage.style.setProperty('--shake', String(intensity));
    stage.classList.remove('is-shaking');
    void stage.offsetWidth;
    stage.classList.add('is-shaking');
  }

  async actCard(act: number) {
    const def = this.content.acts.find((a) => a.number === act);
    if (!def) return;
    audio.setMusic('discovery');
    await this.narration.actCard(def);
    // The act's goal becomes the standing objective in the journal.
    this.state.tasks.push({ id: `act-${act}`, text: def.goal, done: false });
    this.state.notify();
  }

  async endGame(ending: string) {
    this.busy = true;
    this.hud.setVisible(false);
    audio.setMusic('sorrow');
    await this.menus.results(ending, this.state);
    location.reload();
  }

  // -- teardown ------------------------------------------------------------

  destroy() {
    clearInterval(this.autosaveTimer);
    clearInterval(this.playtimeTimer);
    this.sceneView.destroy();
    this.hud.destroy();
    this.journal.destroy();
    this.dialogue.destroy();
    this.puzzles.destroy();
    this.cinematics.destroy();
    this.menus.destroy();
    this.narration.destroy();
  }

  /** Exposed for the dev harness and tests. */
  get gameState() {
    return this.state;
  }

  get saves() {
    return listSlots(this.content);
  }

  /**
   * Deterministic hooks for the screenshot harness.
   *
   * The visual review loop needs to land on an exact UI state without
   * simulating clicks through cinematics and dialogue, so each hook drives
   * the game the same way the player would but skips the waiting.
   */
  get __test() {
    return {
      ready: true,

      /** Jumps straight into the first playable scene. */
      startNewGameSkippingIntro: async () => {
        this.menus.forceClose();
        await this.goto(this.content.startScene, 'none');
      },

      openJournal: (tab?: string) => {
        this.journal.open(tab as never);
      },

      openSettings: () => {
        void this.menus.settings();
      },

      /** Fills the case file so clue-heavy panels render at full density. */
      grantAllClues: () => {
        for (const id of Object.keys(this.content.clues)) this.state.clues.add(id);
        for (const id of Object.keys(this.content.items)) this.state.items.add(id);
        for (const c of Object.keys(this.content.characters)) {
          this.state.flags[`met.${c}`] = true;
        }
        this.state.notify();
      },

      openFirstConversation: async () => {
        const first = this.content.dialogue.find((t) => t.act === 1);
        if (first) await this.talk(first.characterId);
      },

      openPuzzle: (id: string) => this.openPuzzle(id),

      goto: (id: SceneId) => this.goto(id, 'none'),

      /** Every scene id, so the harness can sweep the whole game's art. */
      sceneIds: () => Object.keys(this.content.scenes),
    };
  }
}

export type { SaveSlot };
