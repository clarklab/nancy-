#!/usr/bin/env node
/**
 * The title wordmark.
 *
 * The title screen set its own name in CSS — a gradient over Cormorant with a
 * per-letter reveal. That is good typography and it is not a logo: a shipped
 * adventure game has a *drawn* wordmark, with its own material, its own light
 * and letterforms cut for those particular words. This generates one.
 *
 * TRANSPARENCY IS KEYED, NOT REQUESTED. `gpt-image-2` has no transparent
 * background mode (`gpt-image-1` does, and is worse at type). So the wordmark
 * is rendered as gold on a flat black field and the alpha is derived from
 * luminance here. That is the better matte anyway for this particular object:
 * the logo IS light, so a luminance key gives the glow around each stroke a
 * natural falloff into the plate behind it, where a hard alpha channel would
 * have cut it off at an arbitrary edge. Colour is un-premultiplied on the way
 * out so the gold keeps its saturation in the soft margins instead of going
 * milky where it meets the storm.
 *
 * The prompt lives here rather than in the art manifest because this asset is
 * one-of-one, has to be judged by eye against the key art, and — unlike a room —
 * is worth regenerating a few times to get the word space right.
 *
 *   OPENAI_API_KEY=... node tools/generate-wordmark.mjs [--variant didone]
 *                                                       [--keep-source] [--cook-only <png>]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public', 'art', 'ui', 'wordmark.webp');

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : (args[i + 1] ?? true);
};
const VARIANT = flag('variant', 'engraved');
const COOK_ONLY = flag('cook-only');

const BASE = `A video game title logo — one wordmark lockup, centred, nothing else in frame.

The exact words, spelled exactly, on two lines:
Line 1: THE LAMPLIGHT
Line 2: CIPHER

Set a clear, generous word space between THE and LAMPLIGHT — they must read as two separate words, never as one run of letters.

No other words. No subtitle, no tagline, no author or studio name, no border, no frame, no scene, no illustration, no ornament, no plaque, no rectangle. Only those two lines of lettering floating free.

The logo belongs to an English coastal lighthouse and pilotage authority, autumn 1998 — an archival murder mystery. Restrained, literary, period; prestige detective fiction, not fantasy, not horror.

The background must be pure flat solid black (#000000), perfectly even edge to edge — no texture, no vignette, no gradient, no glow spill. The lettering is the only non-black thing in frame.

Composition: two centred lines filling the width with deliberate optical letterspacing; CIPHER tracked wider so both lines align to the same measure.`;

/**
 * `engraved` is what shipped. The other two were generated and rejected against
 * the key art, recorded so a recast is a judgement rather than a fresh guess:
 * `didone` is handsome but reads gothic-theatrical next to this story, and
 * `foil` sets THE and LAMPLIGHT too tight to separate at title-screen size.
 */
const VARIANTS = {
  engraved: `Warm gold engraved into black, a stately transitional serif in capitals with crisp bracketed serifs and fine hairlines — the lettering of a Victorian brass instrument plate. A single warm lamp low and to the right models every stroke bright on its right flank, falling to deep amber at the left. A faint warm bloom lifts off the letterforms.`,
  didone: `Antique gold foil stamped on black, as on a 1930s crime novel first edition. A high-contrast Didone display serif in capitals — flat unbracketed hairline serifs, dramatic thick-to-thin modulation. A raking light graduates each stroke from bright warm gold on one flank to deep amber on the other, with slight press debossing catching at the stroke edges.`,
  foil: `Antique gold foil stamped on black, as on the cover of a 1930s crime novel first edition. Elegant high-contrast display serif capitals, generously and evenly letterspaced, hairline thin strokes, sharp crisp bracketed serifs. A raking light graduates each stroke from bright warm gold on one flank to deep amber on the other.`,
};

/**
 * Where the key puts its knees.
 *
 * `LO` is above the black field's noise floor — a "flat black" from a diffusion
 * model is not actually 0 — so the plate does not carry a faint grey haze in
 * the shape of the whole frame. `HI` is below the mid-tone of the gold, so the
 * strokes themselves reach full opacity and only their bloom is partial.
 */
const LO = 0.06;
const HI = 0.38;
/** Cap on the un-premultiply gain; without it the softest bloom pixels blow out. */
const MAX_GAIN = 3.2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One generation call.
 *
 * `quality: 'high'` on this model reliably outlives the connection from here —
 * every attempt died with a socket error after several minutes — and 'medium'
 * returns in about forty seconds. For flat lettering on a flat field there is
 * nothing for the extra compute to resolve, so this is not the compromise it
 * looks like.
 */
async function generate(prompt, attempt = 1) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8 * 60 * 1000);
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        size: '1536x1024',
        quality: 'medium',
        n: 1,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const retryable = res.status === 429 || res.status >= 500;
      throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 160)}`), { retryable });
    }
    return Buffer.from((await res.json()).data[0].b64_json, 'base64');
  } catch (err) {
    const retryable = err.retryable ?? (err.name === 'AbortError' || err.name === 'TypeError');
    if (attempt >= 4 || !retryable) throw err;
    const wait = 2 ** attempt * 3000;
    console.warn(`  retry ${attempt}/3 in ${wait / 1000}s — ${String(err.message).slice(0, 100)}`);
    await sleep(wait);
    return generate(prompt, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

/** Luminance -> alpha, un-premultiplied, then trimmed to the ink. */
async function cook(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const out = Buffer.alloc(w * h * 4);

  for (let i = 0, o = 0; i < data.length; i += ch, o += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const a = Math.max(0, Math.min(1, (L - LO) / (HI - LO)));
    const gain = a > 0.02 ? Math.min(1 / Math.max(a, 0.15), MAX_GAIN) : 1;
    out[o] = Math.min(255, r * gain);
    out[o + 1] = Math.min(255, g * gain);
    out[o + 2] = Math.min(255, b * gain);
    out[o + 3] = Math.round(a * 255);
  }

  // Trim on alpha so the asset is the lockup and nothing else — the title
  // screen positions it, so any transparent margin baked in here would be an
  // invisible offset nobody could account for later.
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer()
    .then((png) => sharp(png).trim({ threshold: 6 }).webp({ quality: 92, effort: 6 }).toBuffer());
}

async function main() {
  let raw;

  if (COOK_ONLY) {
    raw = COOK_ONLY;
    console.log(`cooking ${path.basename(String(raw))}`);
  } else {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set.');
      process.exit(1);
    }
    const style = VARIANTS[VARIANT];
    if (!style) {
      console.error(`unknown variant "${VARIANT}" — try ${Object.keys(VARIANTS).join(', ')}`);
      process.exit(1);
    }
    console.log(`generating "${VARIANT}" …`);
    const t0 = Date.now();
    const buf = await generate(`${BASE}\n\nTreatment: ${style}`);
    console.log(`  ${Math.round(buf.length / 1024)}KB in ${Math.round((Date.now() - t0) / 1000)}s`);
    raw = buf;

    if (args.includes('--keep-source')) {
      const p = path.join(ROOT, 'tools', '.artcache', `wordmark-${VARIANT}.png`);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, buf);
      console.log(`  source kept at ${path.relative(ROOT, p)}`);
    }
  }

  const cooked = await cook(raw);
  const meta = await sharp(cooked).metadata();
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, cooked);

  console.log(
    `wrote ${path.relative(ROOT, OUT)} — ${meta.width}x${meta.height}, ${Math.round(cooked.length / 1024)}KB`,
  );
  console.log('Look at it over the key art before committing. Type is the one thing a model');
  console.log('gets wrong in ways no automated check will catch — read the words.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
