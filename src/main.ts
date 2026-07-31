/**
 * Entry point. Loads styles and content, boots the game, and gets the inline
 * boot screen out of the way once there is something worth looking at.
 */

import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/narration.css';
import './styles/journal.css';
import './styles/dialogue.css';
import './styles/puzzle.css';
import './styles/cinematic.css';
import './styles/menus.css';

import { Game } from './engine/game';
import { loadContent } from './game/content';

const bootStatus = document.getElementById('boot-status');
const setStatus = (s: string) => {
  if (bootStatus) bootStatus.textContent = s;
};

async function main() {
  const root = document.getElementById('app');
  if (!root) throw new Error('missing #app');

  setStatus('Opening the case file…');
  const content = await loadContent();

  setStatus('Setting the scene…');
  const game = new Game(root, content);

  // Expose for the screenshot harness and manual debugging.
  (window as unknown as { game: Game }).game = game;

  // Fade the boot screen out just before the title screen paints, so the two
  // never overlap and the transition reads as one continuous fade-up.
  const boot = document.getElementById('boot');
  requestAnimationFrame(() => {
    boot?.classList.add('is-out');
    setTimeout(() => boot?.remove(), 800);
  });

  await game.boot();
}

main().catch((err) => {
  console.error(err);
  setStatus('Something went wrong. Check the console.');
  const boot = document.getElementById('boot');
  boot?.classList.add('has-error');
});
