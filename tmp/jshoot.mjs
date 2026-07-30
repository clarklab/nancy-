import { chromium } from 'playwright';
import path from 'node:path';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';

const ROOT = '/home/user/nancy-';
const DIST = path.join(ROOT, 'dist');
const OUT = process.argv[2];
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
};
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
      } catch { res.writeHead(404).end('nf'); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (existsSync(p)) return p;
    }
  } catch {}
  return undefined;
}

const SHOTS = [
  { name: 'case', tab: 'case', clues: false },
  { name: 'clues', tab: 'clues', clues: true },
  { name: 'people', tab: 'people', clues: true },
  { name: 'deduction', tab: 'deduction', clues: true },
  { name: 'map', tab: 'map', clues: true },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const { server, port } = await serve(DIST);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || findChromium(),
    args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
  });
  const W = Number(process.argv[3] || 1600);
  const H = Number(process.argv[4] || 1000);
  for (const shot of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction(() => window.game?.__test?.ready === true, { timeout: 30000 });
    await page.evaluate(async (s) => {
      const g = window.game;
      await g.__test.startNewGameSkippingIntro();
      if (s.clues) g.__test.grantAllClues();
    }, shot);
    await page.waitForTimeout(3500);
    await page.evaluate((s) => { window.game.__test.openJournal(s.tab); }, shot);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`), animations: 'disabled' });
    // Focus probe: tab through and report where focus lands.
    const trail = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 9; i++) {
        const a = document.activeElement;
        out.push(a ? `${a.tagName}.${(a.className || '').toString().split(' ')[0]}` : 'none');
        await new Promise((r) => setTimeout(r, 10));
        a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      }
      return out;
    });
    console.log(`✓ ${shot.name}${errs.length ? ' ERRORS: ' + errs.join(' | ') : ''}`);
    if (shot.name === 'deduction') console.log('  focus trail:', trail.join(' -> '));
    await ctx.close();
  }
  await browser.close();
  server.close();
}
main();
