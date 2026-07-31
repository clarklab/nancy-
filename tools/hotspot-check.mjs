#!/usr/bin/env node
/**
 * Hotspot alignment audit.
 *
 * Renders every scene at 1920x1200 with each hotspot drawn and labelled over the
 * painting, so a box that does not sit on the thing it names is visible rather
 * than something the player discovers by clicking a satchel and being told about
 * a chart.
 *
 * This exists because hotspot coordinates are the one part of the content that
 * nothing can validate. `check:content` proves a hotspot's effects reference real
 * clues and items; the type system proves the numbers are numbers. Neither has
 * any idea where the satchel actually is in the painting, and a rect that is 20%
 * out is indistinguishable from a correct one in a diff.
 *
 * The geometry is worth knowing before reading the output: the hotspot layer and
 * `.scene-bg` are both exactly the 1920x1200 stage, and the plates are 16:10, so
 * `background-size: cover` crops nothing and a hotspot's percentages map 1:1 onto
 * the painting. Any misalignment seen here is an authoring error in the numbers,
 * not a rendering offset.
 *
 *   npm run build && node tools/hotspot-check.mjs [--out shots/hotspots]
 *                                                 [--only the-ardent,strongroom]
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const OUT = path.join(ROOT, flag('out', 'shots/hotspots'));
const ONLY = flag('only') ? String(flag('only')).split(',').map((s) => s.trim()) : null;
/**
 * Which act to review at.
 *
 * Defaults to the last, because that is the only state in which every room can
 * be entered. But eleven hotspots are gated with `untilAct` and do not exist by
 * then, so a complete audit means sweeping: `--act 1` through `--act 5`. The
 * out directory should differ per act or the later pass overwrites the earlier.
 */
const ACT = flag('act') ? Number(flag('act')) : null;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let p = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
        const s = await stat(p).catch(() => null);
        if (!s || s.isDirectory()) p = path.join(dir, 'index.html');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' });
        res.end(await readFile(p));
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** Draws every hotspot box with its label, and returns their pixel geometry. */
const OVERLAY = () => {
  const host = document.querySelector('.scene-hotspots');
  if (!host) return { error: 'no hotspot layer' };
  const hb = host.getBoundingClientRect();
  const bg = document.querySelector('.scene-bg');
  const bb = bg.getBoundingClientRect();
  const boxes = [];
  const PALETTE = ['#ff2d55', '#00e5ff', '#ffd60a', '#32ff6a', '#c77dff', '#ff9f0a'];
  [...host.children].forEach((n, i) => {
    const r = n.getBoundingClientRect();
    const label = n.getAttribute('aria-label') || n.dataset.hotspot || `#${i}`;
    boxes.push({
      label,
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      pct: {
        x: +(r.x / hb.width).toFixed(3), y: +(r.y / hb.height).toFixed(3),
        w: +(r.width / hb.width).toFixed(3), h: +(r.height / hb.height).toFixed(3),
      },
    });
    const c = PALETTE[i % PALETTE.length];
    n.style.outline = `2px solid ${c}`;
    n.style.background = `${c}1f`;
    const t = document.createElement('div');
    t.textContent = `${i}: ${label}`;
    t.style.cssText =
      `position:absolute;left:0;top:-17px;font:11px/1.4 monospace;color:#000;` +
      `background:${c};padding:1px 4px;white-space:nowrap;z-index:9`;
    n.appendChild(t);
  });
  // The stage geometry, so a reader can tell an authoring error from a layout one.
  return {
    boxes,
    stage: { w: Math.round(hb.width), h: Math.round(hb.height) },
    aligned: Math.abs(hb.x - bb.x) < 1 && Math.abs(hb.y - bb.y) < 1 &&
             Math.abs(hb.width - bb.width) < 1 && Math.abs(hb.height - bb.height) < 1,
  };
};

async function main() {
  const { server, port } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => console.error('  page error:', String(e).slice(0, 160)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 60_000 });

  // Everything unlocked, not just clues. Thirteen scenes carry an `enterIf`
  // that wants a later act or a solved puzzle, and `goto` returns silently when
  // it fails — see the landing check below, which is the half of this that
  // actually matters.
  const ids = await page.evaluate(async (act) => {
    const g = window.game;
    await g.__test.startNewGameSkippingIntro();
    g.__test.unlockEverything(act ?? undefined);
    return g.__test.sceneIds ? g.__test.sceneIds() : [];
  }, ACT);

  const scenes = (ONLY ?? ids).filter(Boolean);
  await mkdir(OUT, { recursive: true });
  console.log(`${scenes.length} scenes at act ${ACT ?? 'max'} -> ${path.relative(ROOT, OUT)}\n`);

  const report = [];
  const stuck = [];
  for (const id of scenes) {
    try {
      // Prove the navigation landed before believing anything on screen.
      //
      // This is the whole reason the tool is trustworthy. `goto` is a no-op when
      // a scene's `enterIf` is unmet, so without this check the page still shows
      // the PREVIOUS room and the screenshot gets written under this room's
      // name — a picture of the wrong scene, captioned with the right one, which
      // is worse than no picture at all. Thirteen scenes were audited that way
      // once. A capture that cannot be proved is not written.
      const landed = await page.evaluate(async (s) => {
        await window.game.goto(s, 'none');
        return window.game.__test.currentScene?.() ?? null;
      }, id);

      if (landed !== id) {
        stuck.push({ scene: id, landed });
        report.push({ scene: id, error: `goto did not land (still on "${landed}")` });
        console.error(`  ${id.padEnd(26)} NOT ENTERED — still on "${landed}"`);
        continue;
      }

      await page.waitForTimeout(700);
      const info = await page.evaluate(OVERLAY);
      await page.screenshot({ path: path.join(OUT, `${id}.png`) });
      report.push({ scene: id, ...info });
      const warn = info.aligned === false ? '  LAYER MISALIGNED' : '';
      console.log(`  ${id.padEnd(26)} ${String(info.boxes?.length ?? 0).padStart(2)} hotspots${warn}`);
    } catch (e) {
      report.push({ scene: id, error: String(e.message).slice(0, 200) });
      console.error(`  ${id.padEnd(26)} FAILED — ${String(e.message).slice(0, 90)}`);
    }
  }

  await writeFile(path.join(OUT, 'hotspots.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();

  const captured = report.filter((r) => r.boxes).length;
  const bad = report.filter((r) => r.aligned === false).length;
  console.log(`\n${captured}/${scenes.length} captured · ${bad} with a misaligned layer`);

  if (stuck.length) {
    console.error(`\n${stuck.length} scene(s) could not be entered and were NOT captured:`);
    for (const s of stuck) console.error(`  ${s.scene} (stayed on "${s.landed}")`);
    console.error('\nThese are gated by `enterIf`. The harness already unlocks every act,');
    console.error('clue, item and puzzle, so a scene still refusing entry has a condition');
    console.error('nothing satisfies — which is worth knowing on its own.');
    process.exitCode = 1;
    return;
  }

  console.log('Layer geometry is only half the check — LOOK at the PNGs. A box in');
  console.log('the right layer can still be on the wrong object, and that is the');
  console.log('failure this tool exists to make visible.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
