import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';

const OUT = '/tmp/claude-0/-home-user-nancy-/be6d0bab-df4a-54e1-bc84-bb23209f4b11/scratchpad/shots';
fs.mkdirSync(OUT, { recursive: true });

const server = await createServer({ root: '/home/user/nancy-', server: { port: 5199 }, logLevel: 'error' });
await server.listen();

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/1-title.png` });

// Settings from the title
await page.click('.title-item:nth-of-type(4)');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/2-settings-audio.png` });

await page.click('.mset__tab:nth-of-type(2)');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/3-settings-display.png` });

await page.click('.mset__tab:nth-of-type(3)');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/4-settings-gameplay.png` });

// Restore defaults -> confirm dialog stacked on settings
await page.click('.mset__foot .menu-btn--ghost');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/5-confirm.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await page.keyboard.press('Escape');
await page.waitForTimeout(800);

// Seed a couple of saves, then open the load browser
await page.evaluate(() => {
  const g = window.game;
  const s = g.gameState;
  s.act = 2; s.playtime = 4231;
  const data = s.toSave();
  localStorage.setItem('lamplight.save.auto', JSON.stringify(data));
  localStorage.setItem('lamplight.save.1', JSON.stringify({ ...data, act: 1, playtime: 900, savedAt: Date.now() - 86400000 }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.click('.title-item:nth-of-type(3)');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/6-load.png` });

// Pause + results via the harness
await page.evaluate(() => window.game.__test.startNewGameSkippingIntro());
await page.waitForTimeout(1500);
await page.keyboard.press('Escape');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/7-pause.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(800);

await page.evaluate(() => {
  const g = window.game;
  g.__menusResults = g;
});
await page.evaluate(async () => {
  const g = window.game;
  // reach the private field through the instance
  const menus = Object.values(g).find((v) => v && typeof v.results === 'function');
  await menus.results('The lamps were never the point. The ledger was, and it named the one person who had no reason to lie about it.', g.gameState);
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/8-results.png` });

await browser.close();
await server.close();
console.log('shots written');
