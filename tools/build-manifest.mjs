#!/usr/bin/env node
/**
 * Turns the design documents in `docs/design/` into `tools/art-manifest.json`.
 *
 * Every prompt is assembled as: subject + art-bible style suffix + hard negatives.
 * Keeping assembly here (rather than in the design docs) means a change to the
 * house style restyles all ~80 assets in one edit.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const D = (f) => path.join(ROOT, 'docs', 'design', f);

const read = async (f) => JSON.parse(await readFile(D(f), 'utf8'));

/** Applied to every prompt regardless of kind — the things that ruin a game asset. */
const HARD_NEGATIVES =
  'Absolutely no text, no lettering, no words, no numbers, no signatures, no watermarks, ' +
  'no logos, no UI elements, no borders or frames, no modern objects, no photographic ' +
  'lens flare, no visible brush signature.';

const SCENE_NEGATIVES =
  'No people, no human figures, no animals, no faces. The room must be empty of characters.';

function scenePrompt(scene, bible) {
  return [
    scene.artPrompt.trim(),
    bible.masterStyleSuffix.trim(),
    SCENE_NEGATIVES,
    HARD_NEGATIVES,
  ].join(' ');
}

function portraitPrompt(character, bible) {
  const subject =
    `Character portrait for a mystery adventure game. ${character.name}, ${character.role}, ` +
    `${character.age}. ${character.appearance} ` +
    `Expression and bearing: ${character.personality} ` +
    `Three-quarter view bust, shoulders visible, looking toward the viewer.`;
  return [subject, bible.portraitStyleSuffix.trim(), HARD_NEGATIVES].join(' ');
}

function itemPrompt(item, bible) {
  const subject =
    `Inventory object for a mystery adventure game: ${item.name}. ${item.artDescription ?? item.description} ` +
    `Single isolated object, centred, three-quarter angle, filling most of the frame.`;
  return [subject, bible.itemStyleSuffix.trim(), HARD_NEGATIVES].join(' ');
}

async function main() {
  const [scenesDoc, bible, castDoc, itemsDoc] = await Promise.all([
    read('scenes.json'),
    read('art-bible.json'),
    read('story-bible.json'),
    read('items.json').catch(() => ({ items: [] })),
  ]);

  const assets = [];

  for (const scene of scenesDoc.scenes) {
    assets.push({ id: scene.id, kind: 'scenes', prompt: scenePrompt(scene, bible) });
  }

  for (const c of castDoc.cast) {
    assets.push({ id: c.id, kind: 'portraits', prompt: portraitPrompt(c, bible) });
  }

  for (const item of itemsDoc.items ?? []) {
    assets.push({ id: item.id, kind: 'items', prompt: itemPrompt(item, bible) });
  }

  for (const ui of bible.uiAssetPrompts ?? []) {
    // Key art is the one UI asset that wants a cinematic aspect ratio.
    const kind = ui.id.includes('key-art') ? 'keyart' : 'ui';
    assets.push({ id: ui.id, kind, prompt: [ui.prompt, HARD_NEGATIVES].join(' ') });
  }

  const seen = new Set();
  for (const a of assets) {
    const key = `${a.kind}/${a.id}`;
    if (seen.has(key)) throw new Error(`duplicate asset id: ${key}`);
    seen.add(key);
  }

  const out = { generatedFrom: 'docs/design', count: assets.length, assets };
  await writeFile(path.join(ROOT, 'tools', 'art-manifest.json'), JSON.stringify(out, null, 2));

  const byKind = assets.reduce((m, a) => ((m[a.kind] = (m[a.kind] || 0) + 1), m), {});
  console.log(`wrote ${assets.length} assets:`, byKind);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
