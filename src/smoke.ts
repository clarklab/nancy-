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

import { GameState } from './engine/state';
import { SceneView } from './engine/scene-view';
import { Narration } from './ui/narration';
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

const content = {
  title: 'The Lamplight Cipher',
  scenes: { smoke: scene },
  items: {},
  clues: {},
  characters: {},
  dialogue: [],
  puzzles: {},
  cinematics: {},
  acts: [{ number: 1, title: 'Arrival', goal: 'Find the keeper.' }],
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

  // Expose so the screenshot harness can drive states deterministically.
  (window as unknown as Record<string, unknown>).smoke = {
    ready: true,
    view,
    state,
    reveal: () => view.revealHotspots(),
    think: (t: string) => state.run([{ kind: 'think', text: t }]),
    say: (t: string, who: string) => state.run([{ kind: 'narrate', text: t, speaker: who }]),
    actCard: () => narration.actCard(content.acts[0]),
  };
}

void main();
