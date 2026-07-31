#!/usr/bin/env node
/**
 * Score pipeline.
 *
 * Reads `docs/design/music-bible.json` and renders every zone bed and dramatic
 * cue with ElevenLabs Music. Resumable and hash-aware in the same way as the art
 * and voice pipelines: a track is only re-rendered when its prompt, length or
 * the shared master style actually changes.
 *
 * LOOPING IS MADE HERE, NOT IN THE ENGINE. A generated track has a beginning and
 * an end and will not loop; butt-joining one to itself gives an audible click
 * every ninety seconds, which on a bed the player hears for an hour is the most
 * annoying sound in the game. Each zone bed is post-processed into a seamless
 * loop by folding its own tail back over its head with an equal-power crossfade,
 * so the file is already circular when it reaches the browser and the engine can
 * just set `loop = true`. Cues are not looped — they play once under a cutscene.
 *
 *   ELEVENLABS_API_KEY=... node tools/generate-music.mjs [--only vaults,sorrow]
 *                                                        [--force] [--concurrency 2]
 */

import { readFile, writeFile, mkdir, access, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import process from 'node:process';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BIBLE = path.join(ROOT, 'docs', 'design', 'music-bible.json');
const CACHE = path.join(ROOT, 'tools', '.artcache', 'music-hashes.json');
const OUT_DIR = path.join(ROOT, 'public', 'audio', 'music');
const TMP_DIR = path.join(ROOT, 'tools', '.artcache', 'music-tmp');

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : (args[i + 1] ?? true);
};
const FORCE = args.includes('--force');
const ONLY = flag('only') ? String(flag('only')).split(',').map((s) => s.trim()) : null;
/** Two at a time. Music generation is minutes-long and the account caps concurrency. */
const CONCURRENCY = Number(flag('concurrency', 2));

/** Seconds of overlap when folding a bed's tail back over its head. */
const LOOP_XFADE_S = 6;

/**
 * Target loudness, in LUFS.
 *
 * The model returns tracks mastered at commercial level — measured between
 * -11 and -16 LUFS — which is thirty-odd dB too loud for something the brief
 * calls sub-audible, and they arrive 4.6 LU apart, so crossing from one zone to
 * the next would read as a volume jump rather than a change of place.
 *
 * Normalising here rather than trimming in the engine keeps one number per kind
 * instead of one per track, and means the mix does not have to be re-tuned every
 * time a bed is regenerated.
 *
 * Beds sit under weather, room tone and dialogue and should be noticed when they
 * stop, not when they start. Cues play in cutscenes where nothing competes, so
 * they get five more.
 */
const LUFS_TARGET = { zone: -32, cue: -27 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const exists = (p) => access(p).then(() => true).catch(() => false);

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE, 'utf8'));
  } catch {
    return {};
  }
}

async function compose(prompt, lengthMs, format, attempt = 1) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10 * 60 * 1000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/music?output_format=${format}`, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, music_length_ms: lengthMs }),
    });
    if (!res.ok) {
      const body = await res.text();
      const retryable = res.status === 429 || res.status === 409 || res.status >= 500;
      throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), { retryable });
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    const retryable = err.retryable ?? (err.name === 'AbortError' || err.name === 'TypeError');
    if (attempt >= 4 || !retryable) throw err;
    const wait = 2 ** attempt * 4000;
    console.warn(`  retry ${attempt}/3 in ${wait / 1000}s — ${String(err.message).slice(0, 110)}`);
    await sleep(wait);
    return compose(prompt, lengthMs, format, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Folds the tail back over the head so the file loops without a seam.
 *
 * Takes the last `LOOP_XFADE_S` and crossfades them over the first
 * `LOOP_XFADE_S`, then drops that much off the end. The result is shorter by
 * one crossfade and its last sample leads naturally into its first, because
 * they are the same material summed at complementary gains. `acrossfade` uses
 * equal-power curves by default, which is what keeps a sustained drone from
 * dipping in the middle of the join.
 */
async function makeSeamless(src, dst) {
  const { stdout } = await run('ffprobe', [
    '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', src,
  ]);
  const dur = parseFloat(stdout.trim());
  if (!Number.isFinite(dur) || dur <= LOOP_XFADE_S * 2) {
    throw new Error(`track too short to loop (${dur}s)`);
  }
  const head = dur - LOOP_XFADE_S;

  // Two copies of the same file: everything but the tail, and just the tail.
  // acrossfade then joins them, which lands the tail on top of the head.
  await run('ffmpeg', [
    '-v', 'error', '-y',
    '-i', src, '-i', src,
    '-filter_complex',
    `[0:a]atrim=0:${head},asetpts=N/SR/TB[a];` +
      `[1:a]atrim=${head},asetpts=N/SR/TB[b];` +
      `[a][b]acrossfade=d=${LOOP_XFADE_S}[out]`,
    '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '64k', dst,
  ]);
  return dur;
}

/** Integrated loudness of a file, in LUFS. */
async function measureLufs(file) {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-',
  ]).catch((e) => e);
  const m = String(stderr).match(/I:\s+(-?[\d.]+) LUFS/);
  if (!m) throw new Error('could not measure loudness');
  return parseFloat(m[1]);
}

/**
 * Brings a track to target with a single static gain.
 *
 * Deliberately not `loudnorm`. That filter is dynamic by default, and any
 * compression applied after the tail has been folded over the head would pull
 * the two halves of the join to different gains and put back the seam the fold
 * exists to remove. A flat `volume` shift cannot do that: every sample moves by
 * the same amount, so a seamless file stays seamless.
 */
async function normalise(src, dst, targetLufs) {
  const measured = await measureLufs(src);
  const deltaDb = targetLufs - measured;
  await run('ffmpeg', [
    '-v', 'error', '-y', '-i', src,
    '-af', `volume=${deltaDb.toFixed(2)}dB`,
    '-c:a', 'libmp3lame', '-b:a', '64k', dst,
  ]);
  return { measured, deltaDb };
}

async function pool(items, limit, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) await worker(items[cursor++]);
    }),
  );
}

/**
 * Re-levels what is already on disk, without regenerating anything.
 *
 * `LUFS_TARGET` is a mixing decision and will be argued about; the tracks it
 * applies to cost real money and minutes to compose. So the target is
 * deliberately NOT part of the cache signature — changing it must not invalidate
 * eleven generations — and this is the cheap path for acting on a change. The
 * gain is flat, so re-levelling a bed cannot reopen its loop seam.
 */
async function relevel(bible) {
  const kinds = [
    ...Object.keys(bible.zones).map((id) => ({ id, kind: 'zone' })),
    ...Object.keys(bible.cues).map((id) => ({ id, kind: 'cue' })),
  ].filter((t) => !ONLY || ONLY.includes(t.id));

  await mkdir(TMP_DIR, { recursive: true });
  for (const t of kinds) {
    const file = path.join(OUT_DIR, `${t.id}.mp3`);
    if (!(await exists(file))) {
      console.log(`  ${t.id} — not rendered yet, skipped`);
      continue;
    }
    const tmp = path.join(TMP_DIR, `${t.id}.lvl.mp3`);
    const { measured, deltaDb } = await normalise(file, tmp, LUFS_TARGET[t.kind]);
    await writeFile(file, await readFile(tmp));
    await rm(tmp, { force: true });
    console.log(
      `  ${t.id.padEnd(18)} ${measured.toFixed(1)} -> ${LUFS_TARGET[t.kind]} LUFS (${deltaDb.toFixed(1)}dB)`,
    );
  }
}

async function main() {
  const bible = JSON.parse(await readFile(BIBLE, 'utf8'));

  if (args.includes('--relevel')) {
    console.log(`re-levelling to zone ${LUFS_TARGET.zone} / cue ${LUFS_TARGET.cue} LUFS`);
    await relevel(bible);
    return;
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY is not set.');
    process.exit(1);
  }
  const tracks = [
    ...Object.entries(bible.zones).map(([id, z]) => ({ id, ...z, kind: 'zone', loop: true })),
    ...Object.entries(bible.cues).map(([id, c]) => ({ id, ...c, kind: 'cue', loop: false })),
  ].filter((t) => !ONLY || ONLY.includes(t.id));

  if (!tracks.length) {
    console.error('nothing matched --only');
    process.exit(1);
  }

  const cache = await loadCache();
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(path.dirname(CACHE), { recursive: true });

  console.log(`${tracks.length} tracks · ${bible.model} · concurrency=${CONCURRENCY}`);
  let done = 0;
  let bytes = 0;
  const failures = [];

  await pool(tracks, CONCURRENCY, async (t) => {
    const prompt = `${t.prompt}\n\n${bible.masterStyle}`;
    const sig = hash(`${bible.model}|${bible.outputFormat}|${t.lengthMs}|${t.loop}|${prompt}`);
    const file = path.join(OUT_DIR, `${t.id}.mp3`);

    if (!FORCE && cache[t.id] === sig && (await exists(file))) {
      done++;
      console.log(`[${done}/${tracks.length}] · ${t.id} (cached)`);
      return;
    }

    const raw = path.join(TMP_DIR, `${t.id}.raw.mp3`);
    try {
      const t0 = Date.now();
      const buf = await compose(prompt, t.lengthMs, bible.outputFormat);
      await writeFile(raw, buf);

      // Fold the loop first, level second: the fold is the only step that can
      // introduce a seam, and a flat gain afterwards cannot reopen one.
      const looped = path.join(TMP_DIR, `${t.id}.loop.mp3`);
      if (t.loop) await makeSeamless(raw, looped);
      const { measured, deltaDb } = await normalise(
        t.loop ? looped : raw,
        file,
        LUFS_TARGET[t.kind],
      );
      await rm(looped, { force: true });

      const size = (await stat(file)).size;
      cache[t.id] = sig;
      await writeFile(CACHE, JSON.stringify(cache, null, 2));
      bytes += size;
      done++;
      console.log(
        `[${done}/${tracks.length}] ✓ ${t.id} (${t.kind}${t.loop ? ', looped' : ''}, ` +
          `${Math.round((Date.now() - t0) / 1000)}s, ${Math.round(size / 1024)}KB, ` +
          `${measured.toFixed(1)} -> ${LUFS_TARGET[t.kind]} LUFS, ${deltaDb.toFixed(1)}dB)`,
      );
    } catch (err) {
      done++;
      failures.push({ id: t.id, error: String(err.message) });
      console.error(`[${done}/${tracks.length}] ✗ ${t.id} — ${String(err.message).slice(0, 160)}`);
    } finally {
      await rm(raw, { force: true });
    }
  });

  console.log(`\n${tracks.length - failures.length} rendered · ${Math.round(bytes / 1024)}KB`);
  if (failures.length) {
    console.log('failed:\n  ' + failures.map((f) => `${f.id} (${f.error.slice(0, 90)})`).join('\n  '));
    process.exit(1);
  }

  // The index the runtime uses to decide whether a composed track exists for a
  // name. A miss is not an error: the engine still has its procedural plan for
  // every cue, and falls back to it.
  const index = {};
  for (const t of [
    ...Object.entries(bible.zones).map(([id, z]) => ({ id, loop: true, scenes: z.scenes })),
    ...Object.entries(bible.cues).map(([id]) => ({ id, loop: false })),
  ]) {
    const f = path.join(OUT_DIR, `${t.id}.mp3`);
    if (await exists(f)) {
      index[t.id] = { loop: t.loop, bytes: (await stat(f)).size };
      if (t.scenes) index[t.id].scenes = t.scenes;
    }
  }
  await writeFile(
    path.join(ROOT, 'src', 'game', 'music-index.json'),
    JSON.stringify(index, null, 2),
  );
  console.log(`indexed ${Object.keys(index).length} tracks`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
