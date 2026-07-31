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

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { transform } from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const D = (f) => path.join(ROOT, 'docs', 'design', f);

/**
 * Who says an unattributed cinematic line, and who says an attributed one.
 *
 * The cutscene prose is written in Wren's register — she is the camera — so a
 * beat with no `speaker` is *her*, not a detached narrator. A beat that names a
 * speaker is a document being read or a person on the record, and those are
 * cast individually.
 *
 * Two beats are deliberately left silent. `Through the ventilation trunk` is
 * two women arguing forty feet away through galvanised steel, and the Pargeter
 * exchange is a question and Wren's answer inside one beat. Both carry two
 * voices, and the player gets one audio file per beat — a single reader would
 * flatten an argument into a monologue, which is worse than text alone.
 */
const CINEMATIC_VOICE = {
  __unattributed: 'wren',
  'Cormac Sallow, 11 September 1998': 'cormac-sallow',
  'Notice to Mariners 74/119 — 15 August 1974': 'narrator',
  'Sabine Ferrier-Kyne': 'sabine-ferrier-kyne',
  'Through the ventilation trunk': null,
  'Mr Pargeter, for the Ministry': null,
};

/**
 * Loads the authored cutscenes.
 *
 * They live in `src/game/cinematics.ts` rather than a design JSON, so this
 * strips the types and imports the real module — the manifest can never drift
 * from what actually plays. `cinematics.ts` imports nothing but types, so a
 * transform is enough and no bundling or alias resolution is needed.
 */
async function loadCinematics() {
  const src = path.join(ROOT, 'src', 'game', 'cinematics.ts');
  const tmpDir = path.join(ROOT, 'tools', '.artcache');
  const tmp = path.join(tmpDir, 'cinematics.gen.mjs');
  const ts = await readFile(src, 'utf8');
  const { code } = await transform(ts, { loader: 'ts', format: 'esm' });
  await mkdir(tmpDir, { recursive: true });
  await writeFile(tmp, code);
  try {
    const mod = await import(`${tmp}?v=${Date.now()}`);
    return mod.cinematics ?? {};
  } finally {
    await rm(tmp, { force: true });
  }
}

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

/**
 * Strips stage directions so they are never read aloud.
 *
 * The dialogue uses two conventions: parentheses for a delivery note
 * ("(quietly)") and square brackets for prose that describes the scene rather
 * than something a character says. A few "greetings" are entirely the latter —
 * Sallow is dead and answers only through documents, so his line is a
 * description of a file. Voicing that would have a corpse narrate his own
 * coroner's report, so a line that is nothing but stage direction is dropped.
 */
function clean(text) {
  const raw = String(Array.isArray(text) ? text.join(' ') : text).trim();
  // Nothing but a bracketed description — not a spoken line at all.
  if (/^[[(][^\])]*[\])]$/.test(raw)) return '';
  const spoken = raw
    .replace(/\s*\[[^\]]*\]\s*/g, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Left with punctuation only after stripping — also not a line.
  if (!/[A-Za-z]/.test(spoken)) return '';
  return deshout(spoken);
}

/**
 * Sentence-cases a line that is set entirely in capitals.
 *
 * The Notice to Mariners is displayed in caps because that is how the printed
 * notice looked. Handed to a TTS engine unchanged, a long all-caps string gets
 * read as either shouting or an initialism. Only the audio is folded; the
 * on-screen text is untouched.
 */
function deshout(s) {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length < 12 || letters !== letters.toUpperCase()) return s;
  return s.charAt(0) + s.slice(1).toLowerCase();
}

async function main() {
  const dialogue = JSON.parse(await readFile(D('dialogue.json'), 'utf8'));
  const cast = JSON.parse(await readFile(D('voice-cast.json'), 'utf8'));

  const lines = [];
  const seen = new Set();
  const skipped = { noVoice: new Set(), tooLong: 0, twoVoiced: 0, uncastSpeaker: new Set() };

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
    const cinematics = await loadCinematics();
    for (const c of Object.values(cinematics)) {
      // Every cutscene is registered twice — once as `cin-opening`, once as the
      // bare `opening` the design docs use — and both keys share one beats
      // array. Voicing both would pay twice for identical audio, so only the
      // canonical id is rendered; the player normalises an alias onto it.
      if (!String(c.id).startsWith('cin-')) continue;
      c.beats.forEach((b, i) => {
        if (!b.text) return;
        const speaker = b.speaker
          ? CINEMATIC_VOICE[b.speaker]
          : CINEMATIC_VOICE.__unattributed;
        if (speaker === null) {
          skipped.twoVoiced++;
          return;
        }
        if (speaker === undefined) {
          skipped.uncastSpeaker.add(b.speaker);
          return;
        }
        add(`cine-${slug(c.id)}-${i}`, speaker, b.text, 'cinematic');
      });
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
  if (skipped.twoVoiced) console.log(`  left silent (two voices in one beat): ${skipped.twoVoiced}`);
  if (skipped.uncastSpeaker.size) {
    console.log('  UNCAST cinematic speaker:', [...skipped.uncastSpeaker].join(' | '));
    console.log('  -> add it to CINEMATIC_VOICE in this file, or map it to null to leave it silent.');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
