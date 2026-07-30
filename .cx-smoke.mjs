import pw from '/home/user/nancy-/node_modules/playwright/index.js';
const { chromium } = pw;
import path from 'node:path';
const SP = process.argv[2];
const browser = await chromium.launch({ channel: undefined, executablePath: '/opt/pw-browsers/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox','--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const console_errors = [];
page.on('console', (m) => { if (m.type() === 'error') console_errors.push(m.text()); });
page.on('pageerror', (e) => console_errors.push('PAGEERROR ' + e.message));
await page.goto('file://' + path.join(SP, 'page.html'));
await page.waitForFunction(() => !!window.__run, null, { timeout: 15000 });
const ids = await page.evaluate(() => window.__ids);
for (const id of ids) {
  const errs = await page.evaluate((i) => window.__run(i), id);
  console.log(id, errs.length ? 'ERRORS: ' + JSON.stringify(errs) : 'ok');
}
if (console_errors.length) console.log('CONSOLE:', JSON.stringify([...new Set(console_errors)], null, 1));
await browser.close();
