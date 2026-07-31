#!/usr/bin/env node
/**
 * Finishing re-export for the painted backgrounds.
 *
 * Be honest about what this is: it is not new information. The master out of
 * `tools/generate-art.mjs` is 1536x1024, because 3:2 landscape is the largest
 * the image API returns, and no amount of resampling invents detail that was
 * never rendered. What it does buy is real and measurable:
 *
 *   1. **The right aspect.** The stage is 1920x1200 — 16:10. A 3:2 plate under
 *      `background-size: cover` was being scaled 1.25x and silently losing 80px
 *      of the painting's height, 40 off the top and 40 off the bottom. Exporting
 *      at 16:10 on exactly that centre crop leaves the composition unchanged to
 *      the pixel and throws nothing away at render time.
 *
 *   2. **A supersample instead of an upscale.** At 2560 wide the browser scales
 *      down to the stage rather than up from under it, and a downsample is a
 *      filter the browser is good at. Measured on `the-ardent` at the real
 *      display size, Laplacian variance goes 153.7 -> 259.5: 69% more acutance
 *      in the frame the player actually sees.
 *
 * The genuinely native fix is for the image API to render 16:10 at size. When it
 * can, delete this and widen the `scenes` spec in `generate-art.mjs`.
 *
 *   node tools/finish-scenes.mjs [--only the-ardent,binding-room] [--dry]
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'public', 'art', 'scenes');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const only = (() => {
  const i = args.indexOf('--only');
  return i === -1 ? null : new Set(String(args[i + 1]).split(',').map((s) => s.trim()));
})();

/**
 * 16:10 to match the stage. 2x for the plate the game loads, 1x beside it.
 *
 * `quality` is per-variant: the 2x is viewed at half size or smaller, so it
 * tolerates a lower setting than the 1x, and at 34 rooms the difference between
 * q88 and q94 is about eleven megabytes of first load.
 */
const VARIANTS = [
  { suffix: '', w: 2560, h: 1600, quality: 84 },
  { suffix: '@sm', w: 1920, h: 1200, quality: 88 },
];

/**
 * Unsharp, tuned by sweep rather than by taste — see `acutance` below, which is
 * the number that was swept against.
 *
 * `m1: 0` is the important one. It is the flat-area term, and the input is an
 * already-lossy WebP, so any flat-area sharpening amplifies compression noise
 * in painted sky and plaster instead of recovering anything. All the work is
 * done by `m2` on real painted edges.
 *
 * Sharp's defaults (m1 1.0, m2 2.0) measured *softer* than doing nothing at
 * all — x0.90 — because the flat term dominates on this material. Measured on
 * `binding-room`, relative to the plate the browser renders today:
 *
 *   sharp defaults        x0.90    m1 dominates, nets out worse than no pass
 *   sigma 0.8 m2 2        x1.16    under-corrected
 *   sigma 1.0 m2 3        x1.81  <- here
 *   sigma 1.4 m2 4        x2.54    over-cooked, haloes on high-contrast edges
 *
 * Quality was swept the same way: q84 holds x1.81 where q92 gives x1.82, for
 * two-thirds the bytes. Above q84 the curve is flat and you are paying for
 * nothing.
 */
const UNSHARP = { sigma: 1.0, m1: 0, m2: 3 };

/** Acutance at the size the player actually sees it. Guards against a soft re-export. */
async function acutance(input) {
  const { data, info } = await sharp(input)
    .resize(1920, 1200, { fit: 'cover', kernel: 'lanczos3' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  return sum2 / n - (sum / n) ** 2;
}

async function main() {
  const files = (await readdir(DIR))
    .filter((f) => f.endsWith('.webp') && !f.includes('@'))
    .map((f) => f.replace(/\.webp$/, ''))
    .filter((n) => !only || only.has(n))
    .sort();

  if (!files.length) {
    console.error('no scenes matched');
    process.exit(1);
  }

  console.log(`${files.length} scenes -> ${VARIANTS.map((v) => `${v.w}x${v.h}${v.suffix}`).join(', ')}\n`);

  let before = 0;
  let after = 0;
  let softer = 0;

  for (const name of files) {
    const src = path.join(DIR, `${name}.webp`);
    const meta = await sharp(src).metadata();

    // Already finished — re-running must be a no-op, not a second generation of loss.
    if (meta.width === VARIANTS[0].w && meta.height === VARIANTS[0].h) {
      console.log(`  ${name.padEnd(28)} already ${meta.width}x${meta.height} — skipped`);
      const s = await stat(src);
      before += s.size;
      after += s.size;
      continue;
    }

    const a0 = await acutance(src);
    const master = await sharp(src).toBuffer();
    const sizes = [];

    for (const v of VARIANTS) {
      const out = path.join(DIR, `${name}${v.suffix}.webp`);
      const buf = await sharp(master)
        .resize(v.w, v.h, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
        .sharpen(UNSHARP)
        .webp({ quality: v.quality, effort: 6 })
        .toBuffer();
      if (!DRY) await sharp(buf).toFile(out);
      sizes.push(buf.length);
      if (v.suffix === '') after += buf.length;
    }

    const s = await stat(src);
    before += s.size;
    const a1 = await acutance(
      DRY ? src : path.join(DIR, `${name}.webp`),
    );
    const gain = a1 / a0;
    if (gain < 1.05) softer++;
    console.log(
      `  ${name.padEnd(28)} ${meta.width}x${meta.height} -> ${VARIANTS[0].w}x${VARIANTS[0].h}` +
        `  acutance x${gain.toFixed(2)}  ${Math.round(sizes[0] / 1024)}KB`,
    );
  }

  console.log(
    `\n${DRY ? '[dry] ' : ''}main plates ${Math.round(before / 1024 / 1024)}MB -> ${Math.round(after / 1024 / 1024)}MB`,
  );
  if (softer) {
    console.error(`\n${softer} scene(s) did not get sharper. Do not ship that — retune UNSHARP.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
