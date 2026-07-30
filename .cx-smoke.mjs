import pw from '/home/user/nancy-/node_modules/playwright/index.js';
const { chromium } = pw;
import path from 'node:path';
const SP = process.argv[2];
const browser = await chromium.launch({ channel: undefined, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const console_errors = [];
page.on('console', (m) => { if (m.type() === 'error') console_errors.push(m.text()); });
page.on('pageerror', (e) => console_errors.push('PAGEERROR ' + e.message));
import http from 'node:http';
import fs from 'node:fs';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const f = path.join(SP, req.url === '/' ? 'page.html' : req.url.slice(1));
  let body;
  try { body = fs.readFileSync(f); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'text/plain' });
  res.end(body);
});
await new Promise((r) => srv.listen(0, r));
await page.goto('http://127.0.0.1:' + srv.address().port + '/page.html');
try { await page.waitForFunction(() => !!window.__run, null, { timeout: 12000 }); } catch (e) { console.log('BOOT FAIL', JSON.stringify(console_errors, null, 1)); await browser.close(); process.exit(1); }
const ids = await page.evaluate(() => window.__ids);
for (const id of ids) {
  const errs = await page.evaluate((i) => window.__run(i), id);
  console.log(id, errs.length ? 'ERRORS: ' + JSON.stringify(errs) : 'ok');
}
if (console_errors.length) console.log('CONSOLE:', JSON.stringify([...new Set(console_errors)], null, 1));
await browser.close();
srv.close();
