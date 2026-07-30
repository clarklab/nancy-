#!/usr/bin/env node
/**
 * Selects which lines get voiced, and writes `tools/voice-manifest.json`.
 *
 * Full voice-over for 223 dialogue nodes is neither affordable nor useful —
 * most of them are the player asking a follow-up. This selects the lines that
 * carry the performance:
 *
 *   1. every character's greeting, per act — the first thing you hear from
 *      them, and the line that has to establish the voice
 *   2. every lie-trap reply — the dramatic peaks, where a character is caught
 *      and has to change register mid-answer
 *   3. cinematic narration — the cold open and the act transitions
 *
 * Everything else stays as text, which is also how the Nancy Drew games handle
 * incidental barks. Widen the selection by raising `INCLUDE`.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const D = (f) => path.join(ROOT, 'docs', 'design', f);

const INCLUDE = {
  greetings: true,
  lieTraps: true,
  cinematics: true,
};

/** ElevenLabs charges per character, and long paragraphs read worse than short ones. */
const MAX_CHARS = 600;

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** Strips stage directions like "(quietly)" that would be read aloud. */
function clean(text) {
  return String(Array.isArray(text) ? text.join(' ') : text)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const dialogue = JSON.parse(await readFile(D('dialogue.json'), 'utf8'));
  const cast = JSON.parse(await readFile(D('voice-cast.json'), 'utf8'));

  const lines = [];
  const seen = new Set();
  const skipped = { noVoice: new Set(), tooLong: 0 };

  const add = (id, speaker, text, kind) => {
    if (!cast.cast[speaker]) {
      skipped.noVoice.add(speaker);
      return;
    }
    const t = clean(text);
    if (!t) return;
    if (t.length > MAX_CHARS) {
      skipped.tooLong++;
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    lines.push({ id, speaker, kind, text: t });
  };

  for (const tree of dialogue.trees) {
    const speaker = tree.characterId;
    for (const act of tree.acts) {
      if (INCLUDE.greetings) {
        add(`greet-${speaker}-a${act.act}`, speaker, act.greeting, 'greeting');
      }
      if (INCLUDE.lieTraps) {
        for (const node of act.nodes) {
          if (node.isLieTrap) add(`line-${slug(node.id)}`, speaker, node.reply, 'lie-trap');
        }
      }
    }
  }

  if (INCLUDE.cinematics) {
    // Cinematics are authored in code, so read them if they exist yet.
    const cinPath = path.join(ROOT, 'docs', 'design', 'cinematics.json');
    try {
      const cin = JSON.parse(await readFile(cinPath, 'utf8'));
      for (const c of cin.cinematics ?? []) {
        c.beats.forEach((b, i) => {
          if (b.text) add(`cine-${slug(c.id)}-${i}`, b.speaker ?? 'narrator', b.text, 'cinematic');
        });
      }
    } catch {
      // Not authored yet — the manifest can be rebuilt once it is.
    }
  }

  const byKind = lines.reduce((m, l) => ((m[l.kind] = (m[l.kind] || 0) + 1), m), {});
  const bySpeaker = lines.reduce((m, l) => ((m[l.speaker] = (m[l.speaker] || 0) + 1), m), {});
  const chars = lines.reduce((n, l) => n + l.text.length, 0);

  await writeFile(
    path.join(ROOT, 'tools', 'voice-manifest.json'),
    JSON.stringify({ count: lines.length, characters: chars, lines }, null, 2),
  );

  console.log(`wrote ${lines.length} lines (${chars.toLocaleString()} characters)`);
  console.log('  by kind:   ', JSON.stringify(byKind));
  console.log('  by speaker:', JSON.stringify(bySpeaker));
  if (skipped.noVoice.size) console.log('  no cast entry:', [...skipped.noVoice].join(', '));
  if (skipped.tooLong) console.log(`  skipped ${skipped.tooLong} lines over ${MAX_CHARS} chars`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
