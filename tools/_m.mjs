import { chromium } from 'playwright';
import path from 'node:path';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
const ROOT = '/home/user/nancy-';
const DIST = path.join(ROOT, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try { let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    const s = await stat(p).catch(() => null); if (!s || s.isDirectory()) p = path.join(DIST, 'index.html');
    const body = await readFile(p); res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
function findChromium(){const base=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers';try{const dirs=readdirSync(base).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1]));for(const d of dirs){const p=path.join(base,d,'chrome-linux','chrome');if(existsSync(p))return p;}}catch{}return undefined;}
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.game?.__test?.ready === true);
await page.evaluate(async () => { const g = window.game; g.__test.setAutoAdvance(40); g.__test.setTextSpeed('instant'); await g.__test.startNewGameSkippingIntro(); g.__test.grantAllClues(); g.__test.openJournal('clues'); });
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const res = {};
  const sc = document.querySelector('.journal-scroll');
  res.scroll = { ...r(sc), scrollH: sc.scrollHeight, clientH: sc.clientHeight };
  res.groups = [...document.querySelectorAll('.clue-group')].map(g => ({ ...r(g), title: g.querySelector('.clue-group__title').textContent }));
  res.grids = [...document.querySelectorAll('.clue-grid')].map(g => ({ ...r(g), cols: getComputedStyle(g).gridTemplateColumns }));
  res.cards = [...document.querySelectorAll('.clue-card')].map(c => ({ ...r(c), n: c.querySelector('.clue-card__name').textContent.slice(0,20), foot: r(c.querySelector('.clue-card__foot')).y }));
  res.panel = r(document.querySelector('.journal__panel'));
  res.book = r(document.querySelector('.journal__book'));
  res.spread = r(document.querySelector('.journal__spread-frame'));
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close(); server.close();
