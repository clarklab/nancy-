#!/usr/bin/env node
/**
 * Cooks the shipped title plate from the generated key art.
 *
 * The generator was asked for a *dark* lantern, which is true to the story's
 * opening but leaves the title screen with no key light at all: the brightest
 * object in the frame was the horizon band, and the one thing the title
 * promises — a burning lamp — was the darkest shape in its own quadrant.
 *
 * Rather than re-prompt (the model tops out at 1536x1024 anyway), this pass
 * relights the existing painting:
 *
 *   1. resample to 1.5x with Lanczos and a light unsharp, so the browser is
 *      not left doing the upscale with a box filter — the masonry, the
 *      gallery rail and the surf edges survive being drawn at ~130% of native;
 *   2. burn the lamp: a blown core inside the glazing, two bloom rings, a
 *      storm halo and a very wide atmospheric lift;
 *   3. let that light *land* — every glow term is also added back modulated by
 *      the local luminance, so foam crests, cloud edges and wet masonry near
 *      the tower pick up a warm specular while the darks stay dark. This is
 *      what stops it reading as a gradient pasted over a photograph;
 *   4. drop a short glitter path onto the water directly under the lantern;
 *   5. lift the one warm window on the headland house so it reads as the
 *      second light in the frame rather than a smudge.
 *
 *   node tools/cook-title-plate.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'public/art/ui/key-art.webp');
const OUT = path.join(ROOT, 'public/art/ui/title-plate.webp');

/** Upscale factor. 1.5x of 1536 = 2304, which covers a 1920 frame plus overscan. */
const K = 1.5;

/** Lantern glazing centre, measured on the 1536x1024 source. */
const LAMP = { x: 1164, y: 389 };
/** Sea horizon, measured on the source. Below this the light can glitter. */
const HORIZON = 524;
/** The lit window on the headland house, measured on the source. */
const WINDOW = { x: 452, y: 886, rx: 26, ry: 42 };

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

async function main() {
  const src = sharp(await readFile(SRC));
  const meta = await src.metadata();
  const W = Math.round(meta.width * K);
  const H = Math.round(meta.height * K);

  const { data, info } = await sharp(await readFile(SRC))
    .resize(W, H, { kernel: 'lanczos3' })
    // Restores the micro-contrast the resample costs. Modest: this is a
    // painting, and an over-sharpened painting reads as a JPEG.
    .sharpen({ sigma: 1.1, m1: 0.4, m2: 0.9 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const lx = LAMP.x * K;
  const ly = LAMP.y * K;
  const horizon = HORIZON * K;

  // Gaussian radii, in cooked pixels. The lamp body is slightly taller than
  // wide because the glazing is.
  const g = (dx, dy, sx, sy) => Math.exp(-(((dx * dx) / (2 * sx * sx)) + ((dy * dy) / (2 * sy * sy))));

  for (let y = 0; y < h; y++) {
    const dy = y - ly;
    for (let x = 0; x < w; x++) {
      const dx = x - lx;
      const i = (y * w + x) * 3;
      const r = data[i];
      const gch = data[i + 1];
      const b = data[i + 2];
      const lum = (0.2126 * r + 0.7152 * gch + 0.0722 * b) / 255;

      // -- the source itself -------------------------------------------------
      const core = g(dx, dy, 11 * K, 8.5 * K);
      const bloomA = g(dx, dy, 26 * K, 24 * K);
      const bloomB = g(dx, dy, 78 * K, 70 * K);
      const halo = g(dx, dy, 250 * K, 210 * K);
      const atm = g(dx, dy, 700 * K, 520 * K);

      let ar = 0;
      let ag = 0;
      let ab = 0;

      // Blown glazing, then two rings of bloom in warm amber.
      ar += core * 252; ag += core * 234; ab += core * 190;
      ar += bloomA * 104; ag += bloomA * 74; ab += bloomA * 32;
      ar += bloomB * 30; ag += bloomB * 19; ab += bloomB * 7;
      ar += halo * 9; ag += halo * 6; ab += halo * 2.2;
      ar += atm * 3.4; ag += atm * 2.3; ab += atm * 0.9;

      // -- what the light lands on -------------------------------------------
      // Modulating by luminance is the whole trick: surf crests, the torn
      // undersides of cloud and the wet gallery ironwork already hold the
      // highlights, so feeding the glow back through lum^2 puts warm speculars
      // exactly where a real lamp would put them and nowhere else.
      const catchStrength = (bloomB * 1.2 + halo * 0.62 + atm * 0.2) * Math.pow(lum, 2.3);
      ar += catchStrength * 205; ag += catchStrength * 142; ab += catchStrength * 58;

      // -- glitter path on the water -----------------------------------------
      if (y > horizon) {
        const fall = Math.exp(-(y - horizon) / (150 * K));
        const across = g(dx, 0, 62 * K, 1);
        const glitter = fall * across * Math.pow(lum, 2.6) * 1.9;
        ar += glitter * 210; ag += glitter * 152; ab += glitter * 74;
      }

      // -- the second light: the house window --------------------------------
      const wx = (x - WINDOW.x * K) / (WINDOW.rx * K);
      const wy = (y - WINDOW.y * K) / (WINDOW.ry * K);
      const wd = wx * wx + wy * wy;
      if (wd < 9) {
        const inner = Math.exp(-wd * 1.5);
        const spill = Math.exp(-wd * 0.42);
        // Inside the frame it burns; outside it only warms what it falls on.
        ar += inner * 78 * Math.pow(lum + 0.15, 0.9) + spill * 16 * Math.pow(lum, 1.6) * 2.2;
        ag += inner * 50 * Math.pow(lum + 0.15, 0.9) + spill * 10 * Math.pow(lum, 1.6) * 2.2;
        ab += inner * 20 * Math.pow(lum + 0.15, 0.9) + spill * 4 * Math.pow(lum, 1.6) * 2.2;
      }

      data[i] = clamp255(r + ar);
      data[i + 1] = clamp255(gch + ag);
      data[i + 2] = clamp255(b + ab);
    }
  }

  await writeFile(
    OUT,
    await sharp(data, { raw: { width: w, height: h, channels: 3 } })
      .webp({ quality: 88, effort: 6 })
      .toBuffer(),
  );

  const out = await sharp(OUT).metadata();
  console.log(`title plate: ${out.width}x${out.height}  ${(out.size / 1024).toFixed(0)}KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
