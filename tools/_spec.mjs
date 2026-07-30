import { chromium } from 'playwright';
import path from 'node:path';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
const DIST = '/home/user/nancy-/dist';
const MIME = { '.html': 'text/html', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  const s = await stat(p).catch(() => null);
  if (!s || s.isDirectory()) p = path.join(p, 'index.html');
  try { const b = await readFile(p); res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404).end('x'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try { const d = readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])); for (const x of d) { const p = path.join(base, x, 'chrome-linux', 'chrome'); if (existsSync(p)) return p; } } catch {}
  return undefined;
}
const b = await chromium.launch({ executablePath: findChromium() });
const pg = await b.newPage({ viewport: { width: 1000, height: 1200 } });
await pg.goto(`http://127.0.0.1:${server.address().port}/_spec/index.html`);
await pg.waitForTimeout(1200);
await pg.screenshot({ path: '/home/user/nancy-/shots/cur/spec.png', fullPage: true });
await b.close(); server.close();
