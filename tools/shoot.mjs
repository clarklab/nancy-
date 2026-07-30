#!/usr/bin/env node
/**
 * Screenshot harness.
 *
 * Boots the built game in headless Chromium and captures a set of named shots
 * for the visual review loop. Each shot drives the game through the public
 * `window.game` handle rather than clicking blindly, so captures are
 * deterministic and a failing shot points at a real defect.
 *
 *   node tools/shoot.mjs [--out shots] [--only title,scene] [--width 1920]
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const OUT = path.join(ROOT, flag('out', 'shots'));
const WIDTH = Number(flag('width', 1920));
const HEIGHT = Number(flag('height', 1200));
const ONLY = flag('only') ? String(flag('only')).split(',') : null;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

/** Serves `dist/` so the capture exercises the real production bundle. */
function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let p = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
        const s = await stat(p).catch(() => null);
        if (!s || s.isDirectory()) p = path.join(dir, 'index.html');
        const body = await readFile(p);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** Picks the newest pre-installed Chromium, falling back to Playwright's own. */
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dirs = readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (existsSync(p)) return p;
    }
  } catch {
    /* fall through to Playwright's bundled resolution */
  }
  return undefined;
}

/**
 * Each shot: a name, and a driver that leaves the game in the state to capture.
 * Drivers run in the page and must resolve once the UI has settled.
 */
const SHOTS = [
  {
    name: 'title',
    settle: 2600,
    drive: async () => {},
  },
  {
    name: 'scene-first',
    settle: 2200,
    drive: async (page) => {
      await page.evaluate(async () => {
        const g = window.game;
        await g.__test.startNewGameSkippingIntro();
      });
    },
  },
  {
    name: 'journal-case',
    settle: 1400,
    drive: async (page) => {
      await page.evaluate(async () => {
        const g = window.game;
        await g.__test.startNewGameSkippingIntro();
        g.__test.openJournal('case');
      });
    },
  },
  {
    name: 'journal-clues',
    settle: 1400,
    drive: async (page) => {
      await page.evaluate(async () => {
        const g = window.game;
        await g.__test.startNewGameSkippingIntro();
        g.__test.grantAllClues();
        g.__test.openJournal('clues');
      });
    },
  },
  {
    name: 'journal-deduction',
    settle: 1600,
    drive: async (page) => {
      await page.evaluate(async () => {
        const g = window.game;
        await g.__test.startNewGameSkippingIntro();
        g.__test.grantAllClues();
        g.__test.openJournal('deduction');
      });
    },
  },
  {
    name: 'dialogue',
    settle: 2000,
    drive: async (page) => {
      await page.evaluate(async () => {
        const g = window.game;
        await g.__test.startNewGameSkippingIntro();
        await g.__test.openFirstConversation();
      });
    },
  },
  {
    name: 'settings',
    settle: 1200,
    drive: async (page) => {
      await page.evaluate(async () => {
        window.game.__test.openSettings();
      });
    },
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const { server, port } = await serve(DIST);
  const base = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({
    // The image ships a pinned Chromium that will not match whatever build
    // Playwright was installed against, so prefer the one that exists on disk.
    executablePath: process.env.CHROMIUM_PATH || findChromium(),
    args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
  });

  const shots = ONLY ? SHOTS.filter((s) => ONLY.includes(s.name)) : SHOTS;
  const report = [];

  for (const shot of shots) {
    const ctx = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();

    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    try {
      await page.goto(base, { waitUntil: 'networkidle', timeout: 45_000 });
      // Wait for the test hooks rather than a fixed delay.
      await page.waitForFunction(() => window.game?.__test?.ready === true, { timeout: 30_000 });
      await shot.drive(page);
      await page.waitForTimeout(shot.settle);

      const file = path.join(OUT, `${shot.name}.png`);
      await page.screenshot({ path: file, animations: 'disabled' });
      report.push({ shot: shot.name, ok: true, file, errors });
      console.log(`✓ ${shot.name}${errors.length ? ` (${errors.length} console errors)` : ''}`);
    } catch (err) {
      report.push({ shot: shot.name, ok: false, error: String(err), errors });
      console.error(`✗ ${shot.name} — ${String(err).slice(0, 200)}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  server.close();

  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const failed = report.filter((r) => !r.ok).length;
  const noisy = report.filter((r) => r.errors?.length).length;
  console.log(`\n${report.length - failed}/${report.length} captured · ${noisy} with console errors`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
