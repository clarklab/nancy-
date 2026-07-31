#!/usr/bin/env node
/**
 * Art pipeline for The Lamplight Cipher.
 *
 * Reads an asset manifest, generates each image with gpt-image-2, and writes
 * web-optimised derivatives. Resumable: an asset is skipped when its output
 * already exists and its prompt hash is unchanged, so a re-run only redoes
 * what actually changed.
 *
 *   OPENAI_API_KEY=... node tools/generate-art.mjs [--only <id,id>] [--kind scenes]
 *                                                  [--force] [--concurrency 6]
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MANIFEST = path.join(ROOT, 'tools', 'art-manifest.json');
const CACHE = path.join(ROOT, 'tools', '.artcache', 'hashes.json');
const API = 'https://api.openai.com/v1/images/generations';

const MODEL = process.env.ART_MODEL || 'gpt-image-2';
const QUALITY = process.env.ART_QUALITY || 'high';

/** Output treatment per asset kind. Backgrounds stay large; items get alpha. */
const KINDS = {
  scenes: { dir: 'public/art/scenes', size: '1536x1024', out: [{ suffix: '', w: 1920, fmt: 'webp', q: 90 }, { suffix: '@sm', w: 960, fmt: 'webp', q: 82 }] },
  portraits: { dir: 'public/art/portraits', size: '1024x1536', out: [{ suffix: '', w: 900, fmt: 'webp', q: 92 }, { suffix: '@sm', w: 420, fmt: 'webp', q: 86 }] },
  items: { dir: 'public/art/items', size: '1024x1024', out: [{ suffix: '', w: 512, fmt: 'webp', q: 92 }] },
  ui: { dir: 'public/art/ui', size: '1024x1024', out: [{ suffix: '', w: 1024, fmt: 'webp', q: 92 }] },
  keyart: { dir: 'public/art/ui', size: '1536x1024', out: [{ suffix: '', w: 1920, fmt: 'webp', q: 92 }] },
};

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : (args[i + 1] ?? true);
};
const FORCE = args.includes('--force');
const ONLY = flag('only') ? String(flag('only')).split(',').map((s) => s.trim()) : null;
const KIND_FILTER = flag('kind');
const CONCURRENCY = Number(flag('concurrency', 6));

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

/**
 * One generation call. gpt-image-2 at high quality routinely takes >2 minutes,
 * so the timeout is generous and transient failures are retried with backoff.
 */
async function generate(prompt, size, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8 * 60 * 1000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, prompt, size, quality: QUALITY, n: 1 }),
    });
    if (!res.ok) {
      const body = await res.text();
      // 429/5xx are worth waiting out; 4xx usually means the prompt itself is bad.
      const retryable = res.status === 429 || res.status >= 500;
      throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`), { retryable });
    }
    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw Object.assign(new Error('no image in response'), { retryable: true });
    return Buffer.from(b64, 'base64');
  } catch (err) {
    const retryable = err.retryable ?? (err.name === 'AbortError' || err.name === 'TypeError');
    if (attempt >= 4 || !retryable) throw err;
    const wait = 2 ** attempt * 3000;
    console.warn(`  retry ${attempt}/3 in ${wait / 1000}s — ${err.message.slice(0, 120)}`);
    await sleep(wait);
    return generate(prompt, size, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

async function writeDerivatives(buf, kind, id) {
  const spec = KINDS[kind];
  const dir = path.join(ROOT, spec.dir);
  await mkdir(dir, { recursive: true });
  const written = [];
  for (const o of spec.out) {
    const file = path.join(dir, `${id}${o.suffix}.${o.fmt}`);
    let img = sharp(buf).resize({ width: o.w, withoutEnlargement: true });
    img = o.fmt === 'webp' ? img.webp({ quality: o.q, effort: 6 }) : img.png();
    await img.toFile(file);
    written.push(path.relative(ROOT, file));
  }
  return written;
}

async function processAsset(asset, cache) {
  const spec = KINDS[asset.kind];
  if (!spec) throw new Error(`unknown kind "${asset.kind}" for ${asset.id}`);
  const size = asset.size || spec.size;
  const key = `${asset.kind}/${asset.id}`;
  const sig = hash(`${MODEL}|${QUALITY}|${size}|${asset.prompt}`);

  const primary = path.join(ROOT, spec.dir, `${asset.id}${spec.out[0].suffix}.${spec.out[0].fmt}`);
  if (!FORCE && cache[key] === sig && (await exists(primary))) {
    return { id: asset.id, status: 'cached' };
  }

  const t0 = Date.now();
  const buf = await generate(asset.prompt, size);
  const files = await writeDerivatives(buf, asset.kind, asset.id);
  cache[key] = sig;
  return { id: asset.id, status: 'generated', secs: Math.round((Date.now() - t0) / 1000), files };
}

/** Fixed-size worker pool; the API is the bottleneck, not local CPU. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set.');
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  let assets = manifest.assets;
  if (KIND_FILTER) assets = assets.filter((a) => a.kind === KIND_FILTER);
  if (ONLY) assets = assets.filter((a) => ONLY.includes(a.id));

  const cache = await loadCache();
  await mkdir(path.dirname(CACHE), { recursive: true });

  console.log(`${assets.length} assets · model=${MODEL} quality=${QUALITY} concurrency=${CONCURRENCY}`);
  let done = 0;
  const failures = [];

  const results = await pool(assets, CONCURRENCY, async (asset) => {
    try {
      const r = await processAsset(asset, cache);
      done++;
      const tag = r.status === 'cached' ? 'skip' : `${r.secs}s`;
      console.log(`[${done}/${assets.length}] ${r.status === 'cached' ? '·' : '✓'} ${asset.kind}/${asset.id} (${tag})`);
      // Persist after each success so an interrupted run loses nothing.
      await writeFile(CACHE, JSON.stringify(cache, null, 2));
      return r;
    } catch (err) {
      done++;
      failures.push({ id: asset.id, error: err.message });
      console.error(`[${done}/${assets.length}] ✗ ${asset.kind}/${asset.id} — ${err.message.slice(0, 200)}`);
      return { id: asset.id, status: 'failed' };
    }
  });

  const gen = results.filter((r) => r.status === 'generated').length;
  const skip = results.filter((r) => r.status === 'cached').length;
  console.log(`\ngenerated ${gen} · cached ${skip} · failed ${failures.length}`);
  if (failures.length) {
    console.log('failed ids: ' + failures.map((f) => f.id).join(','));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
