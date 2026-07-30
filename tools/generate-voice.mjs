#!/usr/bin/env node
/**
 * Voice-line pipeline.
 *
 * Reads `tools/voice-manifest.json` (built by `tools/build-voice-manifest.mjs`)
 * and renders each line with the character's cast voice from
 * `docs/design/voice-cast.json`. Resumable and hash-aware in the same way as
 * the art pipeline: a line is only re-rendered when its text, voice or
 * settings actually change, so a re-run costs nothing for unchanged dialogue.
 *
 *   ELEVENLABS_API_KEY=... node tools/generate-voice.mjs [--only id,id]
 *                                                        [--speaker wren]
 *                                                        [--force] [--concurrency 4]
 */

import { readFile, writeFile, mkdir, access, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MANIFEST = path.join(ROOT, 'tools', 'voice-manifest.json');
const CAST = path.join(ROOT, 'docs', 'design', 'voice-cast.json');
const CACHE = path.join(ROOT, 'tools', '.artcache', 'voice-hashes.json');
const OUT_DIR = path.join(ROOT, 'public', 'audio', 'vo');

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : (args[i + 1] ?? true);
};
const FORCE = args.includes('--force');
const ONLY = flag('only') ? String(flag('only')).split(',').map((s) => s.trim()) : null;
const SPEAKER = flag('speaker');
const CONCURRENCY = Number(flag('concurrency', 4));

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

async function synthesize(text, voiceId, settings, model, format, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3 * 60 * 1000);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      // 409 "already_running" is the account's concurrent-request cap, not a
      // bad request — it clears on its own, so it is worth waiting out.
      const retryable = res.status === 429 || res.status === 409 || res.status >= 500;
      throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), { retryable });
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    const retryable = err.retryable ?? (err.name === 'AbortError' || err.name === 'TypeError');
    if (attempt >= 4 || !retryable) throw err;
    const wait = 2 ** attempt * 2000;
    console.warn(`  retry ${attempt}/3 in ${wait / 1000}s — ${err.message.slice(0, 120)}`);
    await sleep(wait);
    return synthesize(text, voiceId, settings, model, format, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

/** Fixed-size worker pool; the API is the bottleneck. */
async function pool(items, limit, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await worker(items[i]);
      }
    }),
  );
  return results;
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY is not set.');
    process.exit(1);
  }

  const cast = JSON.parse(await readFile(CAST, 'utf8'));
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

  let lines = manifest.lines;
  if (SPEAKER) lines = lines.filter((l) => l.speaker === SPEAKER);
  if (ONLY) lines = lines.filter((l) => ONLY.includes(l.id));

  const cache = await loadCache();
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.dirname(CACHE), { recursive: true });

  console.log(`${lines.length} lines · model=${cast.model} concurrency=${CONCURRENCY}`);
  let done = 0;
  let bytes = 0;
  const failures = [];

  await pool(lines, CONCURRENCY, async (line) => {
    const voice = cast.cast[line.speaker];
    if (!voice) {
      failures.push({ id: line.id, error: `no cast entry for speaker "${line.speaker}"` });
      return;
    }
    const settings = { ...cast.defaultSettings, ...(voice.settings ?? {}) };
    const sig = hash(`${voice.voiceId}|${cast.model}|${JSON.stringify(settings)}|${line.text}`);
    const file = path.join(OUT_DIR, `${line.id}.mp3`);

    if (!FORCE && cache[line.id] === sig && (await exists(file))) {
      done++;
      console.log(`[${done}/${lines.length}] · ${line.id} (cached)`);
      return;
    }

    try {
      const t0 = Date.now();
      const buf = await synthesize(
        line.text,
        voice.voiceId,
        settings,
        cast.model,
        cast.outputFormat,
      );
      await writeFile(file, buf);
      cache[line.id] = sig;
      await writeFile(CACHE, JSON.stringify(cache, null, 2));
      bytes += buf.length;
      done++;
      console.log(
        `[${done}/${lines.length}] ✓ ${line.id} (${line.speaker}, ${Math.round((Date.now() - t0) / 1000)}s, ${Math.round(buf.length / 1024)}KB)`,
      );
    } catch (err) {
      done++;
      failures.push({ id: line.id, error: err.message });
      console.error(`[${done}/${lines.length}] ✗ ${line.id} — ${err.message.slice(0, 160)}`);
    }
  });

  console.log(`\n${lines.length - failures.length} rendered · ${Math.round(bytes / 1024)}KB new audio`);
  if (failures.length) {
    console.log('failed: ' + failures.map((f) => `${f.id} (${f.error.slice(0, 60)})`).join('\n        '));
    process.exit(1);
  }

  // Emit the index the runtime uses to find a line's audio.
  const index = {};
  for (const l of manifest.lines) {
    const f = path.join(OUT_DIR, `${l.id}.mp3`);
    if (await exists(f)) index[l.id] = { speaker: l.speaker, bytes: (await stat(f)).size };
  }
  await writeFile(path.join(ROOT, 'src', 'game', 'vo-index.json'), JSON.stringify(index, null, 2));
  console.log(`indexed ${Object.keys(index).length} lines`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
