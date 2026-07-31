/**
 * Visual smoke harness.
 *
 * Mounts whichever subsystems currently exist against a placeholder scene, so
 * the look of the game can be reviewed long before the full content graph is
 * finished. Not shipped — `smoke.html` is excluded from the production build.
 */

import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/narration.css';
import './styles/journal.css';

import { GameState } from './engine/state';
import { SceneView } from './engine/scene-view';
import { Narration } from './ui/narration';
import { Journal } from './ui/journal';
import type { GameContent, Scene } from './engine/types';

const scene: Scene = {
  id: 'smoke',
  name: 'The Keeper’s Library',
  subtitle: 'Grindstone Reach — 11:40 p.m.',
  background: './art/scenes/placeholder.webp',
  weather: 'heavy-rain',
  hotspots: [
    {
      id: 'desk',
      label: 'The writing desk',
      cursor: 'look',
      huntable: true,
      shape: { type: 'rect', rect: { x: 0.45, y: 0.56, w: 0.34, h: 0.26 } },
      onInteract: [{ kind: 'think', text: 'Someone left in a hurry. The blotter is still damp.' }],
    },
    {
      id: 'lamp',
      label: 'Green banker’s lamp',
      cursor: 'use',
      huntable: true,
      shape: { type: 'rect', rect: { x: 0.545, y: 0.475, w: 0.09, h: 0.11 } },
      onInteract: [{ kind: 'think', text: 'Still warm.' }],
    },
    {
      id: 'window',
      label: 'The storm window',
      cursor: 'look',
      shape: { type: 'rect', rect: { x: 0.24, y: 0.11, w: 0.16, h: 0.42 } },
      onInteract: [{ kind: 'think', text: 'The light out on the Reach has not turned in ten days.' }],
    },
    {
      id: 'fire',
      label: 'The hearth',
      cursor: 'look',
      shape: { type: 'rect', rect: { x: 0.0, y: 0.55, w: 0.13, h: 0.3 } },
      onInteract: [{ kind: 'think', text: 'Someone burned paper here. Recently.' }],
    },
    {
      id: 'exit',
      label: 'Back to the landing',
      cursor: 'walk-back',
      shape: { type: 'rect', rect: { x: 0.02, y: 0.82, w: 0.16, h: 0.16 } },
      onInteract: [{ kind: 'think', text: 'Not yet.' }],
    },
    {
      id: 'shelves',
      label: 'Bound survey volumes',
      cursor: 'take',
      huntable: true,
      shape: { type: 'rect', rect: { x: 0.8, y: 0.2, w: 0.18, h: 0.34 } },
      onInteract: [{ kind: 'think', text: 'Forty years of tide tables. One volume is missing.' }],
    },
  ],
};

/** Stand-in case file, dense enough to show the journal at realistic load. */
const content = {
  title: 'The Lamplight Cipher',
  scenes: { smoke: scene },
  items: {
    'tide-ledger': {
      id: 'tide-ledger',
      name: 'Pilotage Ledger',
      icon: './art/items/tide-ledger.webp',
      description: 'A water-swollen ledger, 1974, bound in oilcloth.',
      category: 'document',
    },
    'brass-key': {
      id: 'brass-key',
      name: 'Lamp-Room Key',
      icon: './art/items/brass-key.webp',
      description: 'Brass, worn smooth, stamped with a number nobody has used in fifty years.',
      category: 'key',
    },
  },
  clues: {
    'unsigned-notice': {
      id: 'unsigned-notice',
      name: 'The Unsigned Notice',
      summary:
        'Every notice in those eleven weeks carries the Warden’s hand — except this one, and this one was the one that mattered.',
      act: 1,
      category: 'document',
      bearsOn: ['warden'],
    },
    'damp-blotter': {
      id: 'damp-blotter',
      name: 'A Blotter Still Damp',
      summary: 'Someone wrote at this desk within the hour and took the page with them.',
      act: 1,
      category: 'physical',
      bearsOn: ['keeper'],
    },
    'burnt-paper': {
      id: 'burnt-paper',
      name: 'Ash in the Grate',
      summary: 'Ruled paper, burned in a hurry. The gum binding survived; the words did not.',
      act: 1,
      category: 'physical',
    },
    'keeper-lied': {
      id: 'keeper-lied',
      name: 'The Keeper’s Timeline',
      summary: 'He says he came up at eight. The lamp says otherwise.',
      act: 1,
      category: 'testimony',
      bearsOn: ['keeper'],
    },
  },
  characters: {
    warden: {
      id: 'warden',
      name: 'Absalom Ferrier',
      role: 'Warden of the Pilotage',
      portrait: './art/portraits/warden.webp',
      bio: 'Forty years on the water and not one of them spent explaining himself. He answers the question before the one I asked.',
    },
    keeper: {
      id: 'keeper',
      name: 'Ines Corriveau',
      role: 'Lamp Keeper',
      portrait: './art/portraits/keeper.webp',
      bio: 'Precise about everything except where she was on Tuesday.',
    },
  },
  dialogue: [],
  puzzles: {},
  cinematics: {},
  acts: [{ number: 1, title: 'Arrival', goal: 'Find out why the light stopped turning.' }],
  startScene: 'smoke',
} satisfies GameContent;

async function main() {
  const root = document.getElementById('app')!;
  root.classList.add('app-shell');
  root.innerHTML = `
    <div class="stage-frame">
      <div class="stage" id="stage"></div>
    </div>
    <div class="overlay-root" id="overlays"></div>`;

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const overlays = root.querySelector<HTMLElement>('#overlays')!;

  const state = new GameState(content);
  const narration = new Narration();
  narration.mount(overlays);

  state.attachPresenter({
    narrate: (t, s) => narration.say(t, s),
    think: (t) => narration.think(t),
    toastItem: async () => {},
    toastClue: async () => {},
    goto: async () => {},
    openPuzzle: async () => {},
    talk: async () => {},
    playCinematic: async () => {},
    playSound: () => {},
    setAmbience: () => {},
    shake: () => {},
    actCard: async () => {},
    endGame: async () => {},
  });

  const view = new SceneView(state, {
    onHotspot: (hs) => void state.run(hs.onInteract),
    onItemDropped: () => {},
    onHover: (hs) => {
      const plate = document.getElementById('smoke-plate')!;
      plate.textContent = hs?.label ?? '';
      plate.classList.toggle('is-on', !!hs);
    },
  });
  stage.appendChild(view.el);

  // A stand-in nameplate until the real HUD is wired in.
  const plate = document.createElement('div');
  plate.id = 'smoke-plate';
  plate.className = 'smoke-plate';
  overlays.appendChild(plate);

  await view.show(scene, 'fade');

  const journal = new Journal(state, { onSound: () => {} });
  journal.mount(overlays);

  // Populate the case file so panels render at realistic density.
  state.tasks.push(
    { id: 'a', text: 'Find out why the light stopped turning.', done: false },
    { id: 'b', text: 'Get a straight answer out of the Warden.', done: false },
    { id: 'c', text: 'Get inside the lamp room.', done: true },
  );
  for (const id of Object.keys(content.clues)) {
    state.clues.add(id);
    state.unreadClues.add(id);
  }
  for (const id of Object.keys(content.items)) state.items.add(id);
  for (const id of Object.keys(content.characters)) state.flags[`met.${id}`] = true;
  state.visitedScenes.add('smoke');
  state.notify();

  // Expose so the screenshot harness can drive states deterministically.
  (window as unknown as Record<string, unknown>).smoke = {
    ready: true,
    view,
    state,
    journal,
    openJournal: (tab?: string) => journal.open(tab as never),
    closeJournal: () => journal.close(),
    reveal: () => view.revealHotspots(),
    think: (t: string) => state.run([{ kind: 'think', text: t }]),
    say: (t: string, who: string) => state.run([{ kind: 'narrate', text: t, speaker: who }]),
    actCard: () => narration.actCard(content.acts[0]),
  };
}

void main();
