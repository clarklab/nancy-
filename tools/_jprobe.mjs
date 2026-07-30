import { chromium } from 'playwright';
import path from 'node:path';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';

const ROOT = '/home/user/nancy-';
const DIST = path.join(ROOT, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    const s = await stat(p).catch(() => null);
    if (!s || s.isDirectory()) p = path.join(DIST, 'index.html');
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (existsSync(p)) return p; }
  } catch { /* ignore */ }
  return undefined;
}
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.game?.__test);
await page.evaluate(async () => { const g = window.game; await g.__test.startNewGameSkippingIntro(); g.__test.openJournal('case'); });
await page.waitForTimeout(3500);
await page.evaluate(() => { document.activeElement?.blur(); });
await page.waitForTimeout(400);
await page.screenshot({ path: '/home/user/nancy-/shots/cur/noblur.png' });
const out = await page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const res = {};
  const ae = document.activeElement;
  res.active = ae ? ae.className || ae.tagName : null;
  res.focusVisible = ae ? ae.matches(':focus-visible') : null;
  res.tabs = [...document.querySelectorAll('.journal-tab')].map((t) => ({ cls: t.className, ...r(t), tf: getComputedStyle(t).transform }));
  const wrap = document.querySelector('.journal__tabs');
  res.tabsBox = wrap ? { ...r(wrap), align: getComputedStyle(wrap).alignItems } : null;
  const close = document.querySelector('.journal__close');
  res.close = close ? r(close) : null;
  for (const sel of ['.journal__book', '.journal__frame', '.journal__leaf--left', '.journal__leaf--right', '.journal__spine', '.jp-col--flyleaf', '.jp-col--ruled', '.journal__page']) {
    const el = document.querySelector(sel); if (el) res[sel] = r(el);
  }
  res.hits = {};
  for (const [k, x, y] of [['tabgap', 1740, 250], ['tabbody', 1770, 250], ['gutterL', 950, 600], ['gutterR', 960, 600]]) {
    res.hits[k] = document.elementsFromPoint(x, y).slice(0, 6).map((e) => e.className || e.tagName);
  }
  const cover = document.querySelector('.journal__board, .journal__cover, .journal__frame');
  res.covers = [...document.querySelectorAll('.journal__book *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 100 && b.right > 1700 && b.right < 1780; }).map((e) => ({ c: e.className, r: Math.round(e.getBoundingClientRect().right), z: getComputedStyle(e).zIndex }));
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
server.close();
