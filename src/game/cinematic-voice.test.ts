/**
 * The cutscene voice-over contract.
 *
 * Two independent things build the same string: `tools/build-voice-manifest.mjs`
 * names the mp3 it renders, and `voiceLineId` in the player looks one up. If
 * they ever disagree the game does not fail — it just goes quiet, which is how
 * every cutscene shipped silent once already while the audio sat on disk under
 * names nothing asked for.
 *
 * These tests are the reason that cannot happen again. They need no browser and
 * no build; they compare the authored beats against the generated index.
 */

import { describe, expect, it } from 'vitest';
import { cinematics } from './cinematics';
import { voiceLineId } from '@/ui/cinematic';
import voIndex from './vo-index.json';

const rendered = new Set(Object.keys(voIndex as Record<string, unknown>));

/**
 * Beats that are meant to have no recording, and why.
 *
 * A beat gets one audio file. Both of these carry two speakers, so a single
 * reader would turn an argument into a monologue — worse than the text alone.
 * Kept in step with `CINEMATIC_VOICE` in `tools/build-voice-manifest.mjs`.
 */
const DELIBERATELY_SILENT = new Set([
  'cine-cin-act-3-4', // two women arguing through forty feet of ventilation trunk
  'cine-cin-ending-solved-1', // Pargeter's question and Wren's answer, one beat
  'cine-cin-ending-wrong-1', // the same exchange, on the other ending
]);

/** Only canonical ids are rendered; the bare aliases share their beats. */
const canonical = Object.values(cinematics).filter((c) => c.id.startsWith('cin-'));
const aliases = Object.values(cinematics).filter((c) => !c.id.startsWith('cin-'));

describe('cutscene voice-over', () => {
  it('has cutscenes to check', () => {
    expect(canonical.length).toBeGreaterThan(0);
    expect(rendered.size).toBeGreaterThan(0);
  });

  it('renders a line for every beat that has text', () => {
    const missing: string[] = [];
    for (const c of canonical) {
      c.beats.forEach((beat, i) => {
        if (!beat.text) return;
        const id = voiceLineId(c.id, i);
        if (!rendered.has(id) && !DELIBERATELY_SILENT.has(id)) missing.push(id);
      });
    }
    expect(missing).toEqual([]);
  });

  it('leaves the two-voiced beats silent on purpose', () => {
    for (const id of DELIBERATELY_SILENT) {
      expect(rendered.has(id), `${id} should have no recording`).toBe(false);
    }
  });

  it('renders no audio for a beat that does not exist', () => {
    const authored = new Set(
      canonical.flatMap((c) => c.beats.map((_, i) => voiceLineId(c.id, i))),
    );
    const orphans = [...rendered].filter((id) => id.startsWith('cine-') && !authored.has(id));
    expect(orphans).toEqual([]);
  });

  it('folds an alias onto the canonical id rather than paying for it twice', () => {
    expect(aliases.length).toBeGreaterThan(0);
    for (const alias of aliases) {
      const twin = canonical.find((c) => c.id === `cin-${alias.id}`);
      expect(twin, `no canonical cutscene for alias "${alias.id}"`).toBeDefined();
      alias.beats.forEach((_, i) => {
        expect(voiceLineId(alias.id, i)).toBe(voiceLineId(twin!.id, i));
      });
    }
  });

  it('gives Wren and the narrator a voice', () => {
    // The whole point of the fix: the protagonist and the cutscene narration
    // were the two voices that silently failed while the other ten rendered.
    const speakers = new Set(
      Object.values(voIndex as Record<string, { speaker: string }>).map((l) => l.speaker),
    );
    expect(speakers.has('wren')).toBe(true);
    expect(speakers.has('narrator')).toBe(true);
  });
});
